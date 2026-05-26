import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AvroField {
  name: string;
  type: any;
  doc?: string;
  default?: any;
  aliases?: string[];
}

interface AvroSchema {
  type: string;
  name?: string;
  namespace?: string;
  fields?: AvroField[];
  items?: any;
  values?: any;
}

interface ValidationFinding {
  severity: "info" | "warning" | "error";
  category: "missing_field" | "type_mismatch" | "rename_candidate" | "nullability" | "duplicate_type" | "unmapped_field" | "open_question";
  field_path: string;
  message: string;
  recommendation: string;
}

interface MappingCandidate {
  inbound_field: string;
  outbound_field: string;
  mapping_type: "direct" | "transform" | "rename" | "inferred" | "unresolved";
  confidence: "high" | "medium" | "low";
  transform_notes: string;
  ai_generated: boolean;
}

// Flatten Avro schema fields into dot-notation paths
function flattenAvroFields(schema: any, prefix = "", namedTypes = new Map<string, any>()): Map<string, any> {
  const result = new Map<string, any>();

  if (!schema) return result;

  // Resolve named type references
  if (typeof schema === "string") {
    const resolved = namedTypes.get(schema);
    if (resolved) return flattenAvroFields(resolved, prefix, namedTypes);
    return result;
  }

  if (Array.isArray(schema)) {
    // Union type — find the non-null type
    for (const t of schema) {
      if (t !== "null" && t !== null) {
        const inner = flattenAvroFields(t, prefix, namedTypes);
        inner.forEach((v, k) => result.set(k, v));
      }
    }
    return result;
  }

  if (schema.type === "record") {
    if (schema.name) namedTypes.set(schema.name, schema);
    if (schema.namespace && schema.name) namedTypes.set(`${schema.namespace}.${schema.name}`, schema);
    for (const field of (schema.fields || [])) {
      const path = prefix ? `${prefix}.${field.name}` : field.name;
      result.set(path, field);
      const nested = flattenAvroFields(field.type, path, namedTypes);
      nested.forEach((v, k) => result.set(k, v));
    }
  } else if (schema.type === "array") {
    flattenAvroFields(schema.items, prefix ? `${prefix}[]` : "[]", namedTypes).forEach((v, k) => result.set(k, v));
  } else if (schema.type === "map") {
    flattenAvroFields(schema.values, prefix ? `${prefix}{}` : "{}", namedTypes).forEach((v, k) => result.set(k, v));
  }

  return result;
}

// Collect all named record definitions to detect duplicates
function collectNamedTypes(schema: any, found = new Map<string, number>()): Map<string, number> {
  if (!schema || typeof schema === "string") return found;
  if (Array.isArray(schema)) {
    schema.forEach(s => collectNamedTypes(s, found));
    return found;
  }
  if (schema.type === "record" && schema.name) {
    found.set(schema.name, (found.get(schema.name) || 0) + 1);
    for (const field of (schema.fields || [])) {
      collectNamedTypes(field.type, found);
    }
  }
  return found;
}

// Normalize type to a simple string for comparison
function normalizeType(t: any): string {
  if (typeof t === "string") return t;
  if (Array.isArray(t)) {
    const nonNull = t.filter(x => x !== "null" && x !== null);
    return nonNull.length === 1 ? normalizeType(nonNull[0]) : nonNull.map(normalizeType).join("|");
  }
  if (t && typeof t === "object") {
    if (t.type === "record") return `record:${t.name || "anonymous"}`;
    if (t.type === "array") return `array<${normalizeType(t.items)}>`;
    if (t.type === "map") return `map<${normalizeType(t.values)}>`;
    return t.type || "unknown";
  }
  return "unknown";
}

// Is a field nullable (union with null)?
function isNullable(t: any): boolean {
  if (!Array.isArray(t)) return false;
  return t.includes("null") || t.includes(null);
}

// Detect likely rename candidates using common patterns
function detectRenameCandidates(inboundFields: Map<string, any>, outboundFields: Map<string, any>): { inbound: string; outbound: string; confidence: "high" | "medium" | "low" }[] {
  const candidates: { inbound: string; outbound: string; confidence: "high" | "medium" | "low" }[] = [];
  const outboundPaths = Array.from(outboundFields.keys());
  const inboundPaths = Array.from(inboundFields.keys());

  const unmappedInbound = inboundPaths.filter(p => !outboundFields.has(p));
  const unmappedOutbound = outboundPaths.filter(p => !inboundFields.has(p));

  for (const ib of unmappedInbound) {
    const ibLeaf = ib.split(".").pop()!.toLowerCase();
    for (const ob of unmappedOutbound) {
      const obLeaf = ob.split(".").pop()!.toLowerCase();
      // Exact leaf name match (different path = structural rename)
      if (ibLeaf === obLeaf) {
        candidates.push({ inbound: ib, outbound: ob, confidence: "high" });
        continue;
      }
      // One is a camelCase abbreviation of the other
      const expanded = expandCamel(obLeaf);
      if (ibLeaf.includes(expanded) || expanded.includes(ibLeaf)) {
        candidates.push({ inbound: ib, outbound: ob, confidence: "medium" });
        continue;
      }
      // Edit distance for short names
      if (ibLeaf.length <= 20 && obLeaf.length <= 20 && levenshtein(ibLeaf, obLeaf) <= 3) {
        candidates.push({ inbound: ib, outbound: ob, confidence: "low" });
      }
    }
  }
  return candidates;
}

function expandCamel(s: string): string {
  return s.replace(/([A-Z])/g, "$1").toLowerCase();
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

// Extract field mentions from ICD text
function extractIcdFields(icdText: string): string[] {
  const lines = icdText.split("\n");
  const fields: string[] = [];
  // Look for lines that describe fields: camelCase words, field: descriptions, table rows
  const patterns = [
    /\b([a-z][a-zA-Z0-9]{2,})\b/g,  // camelCase identifiers
    /`([^`]+)`/g,                      // backtick-quoted names
    /\*\*([^*]+)\*\*/g,               // bold text
  ];
  for (const line of lines) {
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const candidate = match[1].trim();
        if (candidate.length > 2 && candidate.length < 60) {
          fields.push(candidate);
        }
      }
    }
  }
  return [...new Set(fields)];
}

function runValidation(
  inboundSchema: any,
  outboundSchema: any,
  inboundIcd: string,
  outboundIcd: string
): { findings: ValidationFinding[]; mappings: MappingCandidate[] } {
  const findings: ValidationFinding[] = [];
  const mappings: MappingCandidate[] = [];

  // Parse schemas
  const inboundFields = inboundSchema ? flattenAvroFields(inboundSchema) : new Map<string, any>();
  const outboundFields = outboundSchema ? flattenAvroFields(outboundSchema) : new Map<string, any>();

  // 1. Duplicate named types within each schema
  if (inboundSchema) {
    const named = collectNamedTypes(inboundSchema);
    named.forEach((count, name) => {
      if (count > 1) {
        findings.push({
          severity: "error",
          category: "duplicate_type",
          field_path: name,
          message: `Inbound schema defines named type "${name}" ${count} times`,
          recommendation: "Extract into a shared named type or use a $ref pattern to avoid Avro serialization errors"
        });
      }
    });
  }
  if (outboundSchema) {
    const named = collectNamedTypes(outboundSchema);
    named.forEach((count, name) => {
      if (count > 1) {
        findings.push({
          severity: "error",
          category: "duplicate_type",
          field_path: name,
          message: `Outbound schema defines named type "${name}" ${count} times`,
          recommendation: "Extract into a shared named type or use a $ref pattern to avoid Avro serialization errors"
        });
      }
    });
  }

  // 2. Direct mappings — fields present in both
  const directMapped: Set<string> = new Set();
  for (const [path, field] of inboundFields) {
    if (outboundFields.has(path)) {
      directMapped.add(path);
      const inType = normalizeType(field.type);
      const outType = normalizeType(outboundFields.get(path)!.type);

      // Type mismatch
      if (inType !== outType && !inType.includes(outType) && !outType.includes(inType)) {
        findings.push({
          severity: "warning",
          category: "type_mismatch",
          field_path: path,
          message: `Field "${path}" type differs: inbound=${inType}, outbound=${outType}`,
          recommendation: `Verify if a conversion is intentional. If outbound is timestamp and inbound is string, add a parse transform.`
        });
      }

      // Nullability mismatch
      const inNull = isNullable(field.type);
      const outNull = isNullable(outboundFields.get(path)!.type);
      if (inNull !== outNull) {
        findings.push({
          severity: "warning",
          category: "nullability",
          field_path: path,
          message: `Field "${path}" nullability differs: inbound=${inNull ? "nullable" : "required"}, outbound=${outNull ? "nullable" : "required"}`,
          recommendation: inNull && !outNull
            ? `Outbound requires a non-null value but inbound may be null. Add a null-guard or default value.`
            : `Outbound allows null but inbound is required. This is safe but verify it is intentional.`
        });
      }

      mappings.push({
        inbound_field: path,
        outbound_field: path,
        mapping_type: "direct",
        confidence: "high",
        transform_notes: inType !== outType ? `Type conversion: ${inType} → ${outType}` : "",
        ai_generated: false
      });
    }
  }

  // 3. Fields in inbound but not outbound
  for (const [path] of inboundFields) {
    if (!outboundFields.has(path) && !directMapped.has(path)) {
      findings.push({
        severity: "info",
        category: "unmapped_field",
        field_path: path,
        message: `Inbound field "${path}" has no direct match in outbound schema`,
        recommendation: "Check rename candidates below or confirm this field is intentionally dropped"
      });
    }
  }

  // 4. Fields in outbound but not inbound
  for (const [path] of outboundFields) {
    if (!inboundFields.has(path)) {
      const field = outboundFields.get(path)!;
      const nullable = isNullable(field.type);
      const hasDefault = field.default !== undefined;
      findings.push({
        severity: nullable || hasDefault ? "warning" : "error",
        category: "missing_field",
        field_path: path,
        message: `Outbound field "${path}" has no source in inbound schema`,
        recommendation: nullable
          ? "Field is nullable — confirm null is acceptable or identify an inbound source"
          : hasDefault
          ? `Field has default value "${field.default}" — confirm this is correct for all records`
          : "Required outbound field with no inbound source — this WILL cause mapping failures"
      });
    }
  }

  // 5. Rename candidates
  const renameCandidates = detectRenameCandidates(inboundFields, outboundFields);
  for (const rc of renameCandidates) {
    const inType = normalizeType(inboundFields.get(rc.inbound)?.type);
    const outType = normalizeType(outboundFields.get(rc.outbound)?.type);
    const sameType = inType === outType || inType.includes(outType) || outType.includes(inType);

    findings.push({
      severity: "info",
      category: "rename_candidate",
      field_path: rc.inbound,
      message: `"${rc.inbound}" → "${rc.outbound}" appears to be a rename (${rc.confidence} confidence)`,
      recommendation: sameType
        ? `Same type (${inType}). Likely a direct rename — confirm with data owner.`
        : `Type differs: ${inType} vs ${outType}. Rename with type conversion needed.`
    });
    mappings.push({
      inbound_field: rc.inbound,
      outbound_field: rc.outbound,
      mapping_type: "rename",
      confidence: rc.confidence,
      transform_notes: sameType ? "" : `Type conversion: ${inType} → ${outType}`,
      ai_generated: false
    });
  }

  // 6. ICD cross-reference — fields mentioned in ICD but not in either schema
  if (inboundIcd) {
    const icdFields = extractIcdFields(inboundIcd);
    const allSchemaFields = new Set([
      ...Array.from(inboundFields.keys()).map(p => p.split(".").pop()!.toLowerCase()),
      ...Array.from(outboundFields.keys()).map(p => p.split(".").pop()!.toLowerCase())
    ]);
    const schemaFieldNames = new Set([
      ...Array.from(inboundFields.keys()),
      ...Array.from(outboundFields.keys())
    ]);
    for (const f of icdFields) {
      if (!allSchemaFields.has(f.toLowerCase()) && !schemaFieldNames.has(f) && f.length > 4) {
        findings.push({
          severity: "info",
          category: "open_question",
          field_path: f,
          message: `"${f}" appears in the ICD but not in any schema`,
          recommendation: "Verify if this is a field name, an alias, or a documentation term. May need to be added to schema."
        });
      }
    }
  }

  return { findings, mappings };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      session_id,
      inbound_schema,
      outbound_schema,
      inbound_icd_text = "",
      outbound_icd_text = "",
    } = body;

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "session_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Mark session as running
    await supabase
      .from("validation_sessions")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .eq("id", session_id);

    // Run deterministic validation
    const { findings, mappings } = runValidation(
      inbound_schema,
      outbound_schema,
      inbound_icd_text,
      outbound_icd_text
    );

    // Insert findings
    if (findings.length > 0) {
      await supabase.from("validation_findings").insert(
        findings.map(f => ({ ...f, session_id }))
      );
    }

    // Insert mappings
    if (mappings.length > 0) {
      await supabase.from("mapping_candidates").insert(
        mappings.map(m => ({ ...m, session_id }))
      );
    }

    const summary = {
      total_findings: findings.length,
      errors: findings.filter(f => f.severity === "error").length,
      warnings: findings.filter(f => f.severity === "warning").length,
      info: findings.filter(f => f.severity === "info").length,
      direct_mappings: mappings.filter(m => m.mapping_type === "direct").length,
      rename_candidates: mappings.filter(m => m.mapping_type === "rename").length,
      unresolved: mappings.filter(m => m.mapping_type === "unresolved").length,
      inbound_field_count: inbound_schema ? (flattenAvroFields(inbound_schema)).size : 0,
      outbound_field_count: outbound_schema ? (flattenAvroFields(outbound_schema)).size : 0,
    };

    // Update session as complete
    await supabase
      .from("validation_sessions")
      .update({ status: "complete", summary, updated_at: new Date().toISOString() })
      .eq("id", session_id);

    return new Response(
      JSON.stringify({ success: true, findings, mappings, summary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("validate-schema error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Re-export flattenAvroFields for summary calculation in the handler above
function flattenAvroFields(schema: any, prefix = "", namedTypes = new Map<string, any>()): Map<string, any> {
  const result = new Map<string, any>();
  if (!schema) return result;
  if (typeof schema === "string") {
    const resolved = namedTypes.get(schema);
    if (resolved) return flattenAvroFields(resolved, prefix, namedTypes);
    return result;
  }
  if (Array.isArray(schema)) {
    for (const t of schema) {
      if (t !== "null" && t !== null) {
        flattenAvroFields(t, prefix, namedTypes).forEach((v, k) => result.set(k, v));
      }
    }
    return result;
  }
  if (schema.type === "record") {
    if (schema.name) namedTypes.set(schema.name, schema);
    if (schema.namespace && schema.name) namedTypes.set(`${schema.namespace}.${schema.name}`, schema);
    for (const field of (schema.fields || [])) {
      const path = prefix ? `${prefix}.${field.name}` : field.name;
      result.set(path, field);
      flattenAvroFields(field.type, path, namedTypes).forEach((v, k) => result.set(k, v));
    }
  } else if (schema.type === "array") {
    flattenAvroFields(schema.items, prefix ? `${prefix}[]` : "[]", namedTypes).forEach((v, k) => result.set(k, v));
  } else if (schema.type === "map") {
    flattenAvroFields(schema.values, prefix ? `${prefix}{}` : "{}", namedTypes).forEach((v, k) => result.set(k, v));
  }
  return result;
}
