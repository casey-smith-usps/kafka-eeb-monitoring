import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-access-token",
};

interface GitFile {
  path: string;
  content: string;
}

interface PushRequest {
  owner: string;          // GitHub org/user
  repo: string;           // repo name
  branch: string;         // new branch to create (e.g. "feature/mid-owner-history")
  baseBranch?: string;    // default: "main"
  commitMessage?: string;
  files: GitFile[];
  openPr?: boolean;
  prTitle?: string;
  prBody?: string;
}

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const BASE_URL = "https://api.github.com";

async function ghFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  return res;
}

async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const res = await ghFetch(`/repos/${owner}/${repo}`);
  if (!res.ok) throw new Error(`Repo not found: ${owner}/${repo} (${res.status})`);
  const data = await res.json();
  return data.default_branch ?? "main";
}

async function getRef(owner: string, repo: string, branch: string): Promise<string> {
  const res = await ghFetch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`);
  if (!res.ok) throw new Error(`Branch '${branch}' not found (${res.status})`);
  const data = await res.json();
  return data.object.sha;
}

async function createBranch(owner: string, repo: string, newBranch: string, sha: string): Promise<void> {
  // Check if branch already exists
  const check = await ghFetch(`/repos/${owner}/${repo}/git/refs/heads/${newBranch}`);
  if (check.ok) return; // already exists, reuse it

  const res = await ghFetch(`/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create branch: ${err}`);
  }
}

async function getTreeSha(owner: string, repo: string, commitSha: string): Promise<string> {
  const res = await ghFetch(`/repos/${owner}/${repo}/git/commits/${commitSha}`);
  if (!res.ok) throw new Error(`Failed to get commit ${commitSha}`);
  const data = await res.json();
  return data.tree.sha;
}

async function createBlob(owner: string, repo: string, content: string): Promise<string> {
  const res = await ghFetch(`/repos/${owner}/${repo}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({
      content: btoa(unescape(encodeURIComponent(content))), // base64-encode UTF-8
      encoding: "base64",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create blob: ${err}`);
  }
  const data = await res.json();
  return data.sha;
}

async function createTree(
  owner: string,
  repo: string,
  baseTreeSha: string,
  blobs: { path: string; sha: string }[]
): Promise<string> {
  const res = await ghFetch(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: blobs.map(b => ({
        path: b.path,
        mode: "100644",
        type: "blob",
        sha: b.sha,
      })),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create tree: ${err}`);
  }
  const data = await res.json();
  return data.sha;
}

async function createCommit(
  owner: string,
  repo: string,
  message: string,
  treeSha: string,
  parentSha: string
): Promise<string> {
  const res = await ghFetch(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: treeSha,
      parents: [parentSha],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create commit: ${err}`);
  }
  const data = await res.json();
  return data.sha;
}

async function updateRef(
  owner: string,
  repo: string,
  branch: string,
  commitSha: string
): Promise<void> {
  const res = await ghFetch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commitSha, force: false }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update ref: ${err}`);
  }
}

async function isRepoEmpty(owner: string, repo: string): Promise<boolean> {
  const res = await ghFetch(`/repos/${owner}/${repo}`);
  if (!res.ok) return false;
  const data = await res.json();
  return data.size === 0;
}

async function initializeRepo(owner: string, repo: string, defaultBranch: string): Promise<string> {
  // Create a README as the initial commit so the repo is no longer empty
  const res = await ghFetch(`/repos/${owner}/${repo}/contents/README.md`, {
    method: "PUT",
    body: JSON.stringify({
      message: "chore: initialize repository",
      content: btoa("# EEB Kafka Schemas\n\nAvro schemas and DataSpec mappings generated by the EEB ICD Assistant.\n"),
      branch: defaultBranch,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to initialize repo: ${err}`);
  }
  const data = await res.json();
  return data.commit.sha;
}

async function createPullRequest(
  owner: string,
  repo: string,
  branch: string,
  base: string,
  title: string,
  body: string
): Promise<{ number: number; url: string }> {
  const res = await ghFetch(`/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title, body, head: branch, base }),
  });
  if (!res.ok) {
    const text = await res.text();
    // PR may already exist — treat as non-fatal
    console.warn("PR creation response:", text);
    return { number: 0, url: `https://github.com/${owner}/${repo}/pulls` };
  }
  const data = await res.json();
  return { number: data.number, url: data.html_url };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!GITHUB_TOKEN) {
    return new Response(
      JSON.stringify({ error: "GITHUB_TOKEN secret not configured. Add it via Supabase secrets." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: PushRequest = await req.json();
    const {
      owner,
      repo,
      branch,
      files,
      commitMessage = "chore: generated ingest scaffold from EEB ICD Builder",
      openPr = true,
      prTitle,
      prBody,
    } = body;

    if (!owner || !repo || !branch || !files?.length) {
      return new Response(
        JSON.stringify({ error: "owner, repo, branch, and files are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseBranch = (body.baseBranch && body.baseBranch !== branch)
      ? body.baseBranch
      : (await getDefaultBranch(owner, repo));

    // 1. Get base branch tip — bootstrap repo if empty
    let baseSha: string;
    try {
      baseSha = await getRef(owner, repo, baseBranch);
    } catch {
      // Repo may be empty (no commits yet) — initialize it with a README then retry
      const empty = await isRepoEmpty(owner, repo);
      if (!empty) {
        throw new Error(`Base branch '${baseBranch}' not found in ${owner}/${repo}. Make sure the repo exists and has at least one commit on '${baseBranch}'.`);
      }
      baseSha = await initializeRepo(owner, repo, baseBranch);
    }

    // 2. Create feature branch (idempotent)
    await createBranch(owner, repo, branch, baseSha);

    // 3. Get current tip of the feature branch (may be ahead if we're updating)
    const branchSha = await getRef(owner, repo, branch);

    // 4. Get the tree from current branch tip
    const baseTreeSha = await getTreeSha(owner, repo, branchSha);

    // 5. Create blobs for all files (in parallel, batched)
    const BATCH = 5;
    const blobEntries: { path: string; sha: string }[] = [];
    for (let i = 0; i < files.length; i += BATCH) {
      const slice = files.slice(i, i + BATCH);
      const shas = await Promise.all(
        slice.map(f => createBlob(owner, repo, f.content))
      );
      slice.forEach((f, idx) => blobEntries.push({ path: f.path, sha: shas[idx] }));
    }

    // 6. Create tree
    const newTreeSha = await createTree(owner, repo, baseTreeSha, blobEntries);

    // 7. Commit
    const newCommitSha = await createCommit(owner, repo, commitMessage, newTreeSha, branchSha);

    // 8. Advance branch ref
    await updateRef(owner, repo, branch, newCommitSha);

    // 9. Open PR (optional)
    let pr: { number: number; url: string } | null = null;
    if (openPr) {
      pr = await createPullRequest(
        owner,
        repo,
        branch,
        baseBranch,
        prTitle ?? commitMessage,
        prBody ?? `Generated by EEB ICD Builder on ${new Date().toISOString()}\n\n${files.length} files committed to \`${branch}\`.`
      );
    }

    const branchUrl = `https://github.com/${owner}/${repo}/tree/${branch}`;
    const actionsUrl = `https://github.com/${owner}/${repo}/actions`;

    return new Response(
      JSON.stringify({
        success: true,
        commit_sha: newCommitSha,
        branch_url: branchUrl,
        actions_url: actionsUrl,
        pr: pr ?? null,
        files_committed: files.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("push-to-github error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
