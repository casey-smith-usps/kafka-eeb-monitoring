import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DATABRICKS_HOST = Deno.env.get('DATABRICKS_HOST')?.trim();
const DATABRICKS_TOKEN = Deno.env.get('DATABRICKS_TOKEN')?.trim();
const DATABRICKS_SQL_WAREHOUSE_ID = Deno.env.get('DATABRICKS_SQL_WAREHOUSE_ID')?.trim();

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  messages: Message[];
  max_tokens?: number;
  user_id?: string;
  request_type?: string;
}

async function logUsage(
  userId: string | undefined,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
  requestType: string,
  success: boolean,
  errorMessage?: string
) {
  try {
    const estimatedCost = (totalTokens / 1_000_000) * 2.0;
    await supabase.from('ai_usage_log').insert({
      user_id: userId || 'anonymous',
      endpoint_name: 'databricks-sql-serverless',
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_cost: estimatedCost,
      request_type: requestType || 'chat',
      success,
      error_message: errorMessage,
    });
  } catch (err) {
    console.error('Failed to log AI usage:', err);
  }
}

async function executeStatementWithPolling(sqlStatement: string): Promise<string> {
  const headers = {
    'Authorization': `Bearer ${DATABRICKS_TOKEN}`,
    'Content-Type': 'application/json',
  };

  // Submit with max inline wait
  const submitRes = await fetch(`${DATABRICKS_HOST}/api/2.0/sql/statements`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      warehouse_id: DATABRICKS_SQL_WAREHOUSE_ID,
      statement: sqlStatement,
      wait_timeout: '50s',
    }),
  });

  if (!submitRes.ok) {
    const err = await submitRes.text();
    throw new Error(`Databricks SQL submit error (${submitRes.status}): ${err}`);
  }

  let result = await submitRes.json();
  let state: string = result.status?.state ?? 'UNKNOWN';

  // Poll if still running (warehouse cold-start can take time)
  if (state === 'PENDING' || state === 'RUNNING') {
    const statementId: string = result.statement_id;
    const pollUrl = `${DATABRICKS_HOST}/api/2.0/sql/statements/${statementId}`;
    const maxPolls = 8;

    for (let i = 0; i < maxPolls; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const pollRes = await fetch(pollUrl, { headers });
      if (!pollRes.ok) {
        const err = await pollRes.text();
        throw new Error(`Poll error (${pollRes.status}): ${err}`);
      }
      result = await pollRes.json();
      state = result.status?.state ?? 'UNKNOWN';
      if (state !== 'PENDING' && state !== 'RUNNING') break;
    }
  }

  if (state === 'FAILED' || state === 'CANCELLED') {
    const msg = result.status?.error?.message ?? state;
    throw new Error(`SQL query ${state}: ${msg}`);
  }

  if (state !== 'SUCCEEDED') {
    throw new Error(`SQL query did not complete in time (state: ${state}). The SQL warehouse may be starting up — please try again in a moment.`);
  }

  const aiResponse: string = result.result?.data_array?.[0]?.[0] ?? '';
  if (!aiResponse) {
    console.error('Empty data_array in result:', JSON.stringify(result));
    throw new Error('AI query returned no response. Check that ai_query() is enabled on your SQL warehouse.');
  }

  return aiResponse;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!DATABRICKS_HOST || !DATABRICKS_TOKEN || !DATABRICKS_SQL_WAREHOUSE_ID) {
      throw new Error('Databricks SQL configuration missing: DATABRICKS_HOST, DATABRICKS_TOKEN, and DATABRICKS_SQL_WAREHOUSE_ID are required.');
    }

    const { messages, user_id, request_type }: RequestBody = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error('Invalid request: messages array is required');
    }

    const systemMessage = messages.find(m => m.role === 'system')?.content ??
      'You are a helpful AI assistant for the Enterprise Event Bus platform.';
    const conversationHistory = messages.filter(m => m.role !== 'system');
    const userQuestion = conversationHistory[conversationHistory.length - 1]?.content ?? '';
    const context = conversationHistory.slice(0, -1).map(m => `${m.role}: ${m.content}`).join('\n');

    const rawPrompt = context
      ? `${systemMessage}\n\nConversation History:\n${context}\n\nUser: ${userQuestion}`
      : `${systemMessage}\n\nUser: ${userQuestion}`;

    // Strip binary/control chars that break SQL string literals, escape single quotes
    const sanitized = rawPrompt
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
      .replace(/\r/g, '')
      .replace(/'/g, "''");

    const sqlStatement = `SELECT ai_query('databricks-meta-llama-3-3-70b-instruct', '${sanitized}')`;

    const aiResponse = await executeStatementWithPolling(sqlStatement);

    const promptTokens = Math.round(rawPrompt.length / 4);
    const completionTokens = Math.round(aiResponse.length / 4);
    const totalTokens = promptTokens + completionTokens;

    await logUsage(user_id, promptTokens, completionTokens, totalTokens, request_type || 'chat', true);

    return new Response(
      JSON.stringify({
        choices: [{ message: { role: 'assistant', content: aiResponse }, finish_reason: 'stop' }],
        usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: totalTokens },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in databricks-sql-ai:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    await logUsage(undefined, 0, 0, 0, 'chat', false, message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
