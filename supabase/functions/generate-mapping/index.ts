import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DATABRICKS_HOST = Deno.env.get("DATABRICKS_HOST")?.trim();
const DATABRICKS_TOKEN = Deno.env.get("DATABRICKS_TOKEN")?.trim();
const DATABRICKS_ENDPOINT_NAME = Deno.env.get("DATABRICKS_ENDPOINT_NAME")?.trim();

interface MappingRow {
  inbound_field: string;
  inbound_type: string;
  outbound_field: string;
  outbound_type: string;
  mapping_type: string;
  notes: string;
  confidence: string;
  ai_generated: boolean;
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
      existing_findings = [],
      existing_mappings = [],
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

    const aiAvailable = !!(DATABRICKS_HOST && DATABRICKS_TOKEN && DATABRICKS_ENDPOINT_NAME);
    let aiMappingRows: MappingRow[] = [];
    let aiQuestions: string[] = [];
    let aiNotes = "";
    let pythonScript = "";

    if (aiAvailable) {
      const prompt = buildMappingPrompt(
        inbound_schema,
        outbound_schema,
        inbound_icd_text,
        outbound_icd_text,
        existing_findings,
        existing_mappings
      );

      const aiUrl = `${DATABRICKS_HOST}/serving-endpoints/${DATABRICKS_ENDPOINT_NAME}/invocations`;
      const aiRes = await fetch(aiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DATABRICKS_TOKEN}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `You are an expert data engineer specializing in Apache Avro schema mapping and ETL pipeline design for enterprise event-driven systems (EEB/Kafka).
You analyze inbound and outbound Avro schemas plus Interface Control Documents (ICDs) to produce precise field mapping tables and Python ETL scripts.
Always respond with valid JSON only — no markdown, no extra text outside the JSON.`
            },
            { role: "user", content: prompt }
          ],
          max_tokens: 3000,
          temperature: 0.1,
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const raw = aiData?.choices?.[0]?.message?.content ?? "";
        try {
          const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);
          aiMappingRows = parsed.mapping_rows || [];
          aiQuestions = parsed.open_questions || [];
          aiNotes = parsed.notes || "";
          pythonScript = parsed.python_mapper || "";
        } catch {
          aiNotes = raw.slice(0, 500);
        }
      } else {
        const errText = await aiRes.text();
        console.error("Databricks AI error:", errText);
      }
    } else {
      // Fallback: generate mapping rows from deterministic mappings
      aiMappingRows = buildDeterministicMappingRows(inbound_schema, outbound_schema, existing_mappings);
      pythonScript = generatePythonScript(aiMappingRows, inbound_schema, outbound_schema);
    }

    // Insert AI-generated mapping candidates
    const mappingsToInsert = aiMappingRows.map((m) => ({
      session_id,
      inbound_field: m.inbound_field || "",
      outbound_field: m.outbound_field || "",
      mapping_type: normalizeMappingType(m.mapping_type),
      confidence: normalizeConfidence(m.confidence),
      transform_notes: m.notes || "",
      ai_generated: true,
    }));

    if (mappingsToInsert.length > 0) {
      await supabase.from("mapping_candidates").insert(mappingsToInsert);
    }

    // Insert open questions as findings
    const questionFindings = aiQuestions.map((q: string) => ({
      session_id,
      severity: "info" as const,
      category: "open_question" as const,
      field_path: "",
      message: q,
      recommendation: "Clarify with data owner or ICD author before finalizing schema",
    }));

    if (questionFindings.length > 0) {
      await supabase.from("validation_findings").insert(questionFindings);
    }

    // Store python script as a generated artifact in session summary
    if (pythonScript) {
      const { data: session } = await supabase
        .from("validation_sessions")
        .select("summary")
        .eq("id", session_id)
        .maybeSingle();

      await supabase
        .from("validation_sessions")
        .update({
          summary: { ...(session?.summary || {}), python_mapper: pythonScript },
          updated_at: new Date().toISOString(),
        })
        .eq("id", session_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ai_mappings: mappingsToInsert,
        mapping_rows: aiMappingRows,
        open_questions: aiQuestions,
        notes: aiNotes,
        python_script: pythonScript,
        ai_available: aiAvailable,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-mapping error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function normalizeMappingType(t: string): string {
  const valid = ["direct", "transform", "rename", "inferred", "unresolved"];
  const lower = (t || "").toLowerCase();
  if (valid.includes(lower)) return lower;
  if (lower.includes("reshape") || lower.includes("transform")) return "transform";
  if (lower.includes("rename") || lower.includes("direct rename")) return "rename";
  if (lower.includes("direct")) return "direct";
  if (lower.includes("derived") || lower.includes("system") || lower.includes("constant")) return "inferred";
  return "unresolved";
}

function normalizeConfidence(c: string): string {
  const lower = (c || "").toLowerCase();
  if (["high", "medium", "low"].includes(lower)) return lower;
  return "medium";
}

function flattenSchema(schema: any, prefix = "", namedTypes = new Map<string, any>()): Map<string, string> {
  const result = new Map<string, string>();
  if (!schema) return result;
  if (typeof schema === "string") {
    const resolved = namedTypes.get(schema);
    if (resolved) return flattenSchema(resolved, prefix, namedTypes);
    result.set(prefix, schema);
    return result;
  }
  if (Array.isArray(schema)) {
    const nonNull = schema.filter(t => t !== "null" && t !== null);
    const inner = nonNull[0];
    if (inner) flattenSchema(inner, prefix, namedTypes).forEach((v, k) => result.set(k, v));
    return result;
  }
  if (schema.type === "record") {
    if (schema.name) namedTypes.set(schema.name, schema);
    for (const field of (schema.fields || [])) {
      const path = prefix ? `${prefix}.${field.name}` : field.name;
      const typeStr = getTypeString(field.type);
      result.set(path, typeStr);
      if (isRecordType(field.type)) {
        flattenSchema(field.type, path, namedTypes).forEach((v, k) => result.set(k, v));
      }
    }
  }
  return result;
}

function getTypeString(t: any): string {
  if (typeof t === "string") return t;
  if (Array.isArray(t)) {
    const nonNull = t.filter(x => x !== "null" && x !== null);
    const inner = nonNull[0];
    const base = getTypeString(inner);
    return t.includes("null") ? `${base} (nullable)` : base;
  }
  if (t && typeof t === "object") {
    if (t.type === "record") return `record:${t.name || "object"}`;
    if (t.type === "array") return `array<${getTypeString(t.items)}>`;
    if (t.type === "map") return `map<${getTypeString(t.values)}>`;
    if (t.logicalType) return `${t.type}/${t.logicalType}`;
    return t.type || "unknown";
  }
  return "unknown";
}

function isRecordType(t: any): boolean {
  if (!t) return false;
  if (Array.isArray(t)) return t.some(isRecordType);
  return typeof t === "object" && t.type === "record";
}

function buildDeterministicMappingRows(inboundSchema: any, outboundSchema: any, existingMappings: any[]): MappingRow[] {
  const rows: MappingRow[] = [];
  const inboundFlat = flattenSchema(inboundSchema);
  const outboundFlat = flattenSchema(outboundSchema);

  for (const m of existingMappings) {
    rows.push({
      inbound_field: m.inbound_field || "",
      inbound_type: m.inbound_field ? (inboundFlat.get(m.inbound_field) || "unknown") : "n/a",
      outbound_field: m.outbound_field || "",
      outbound_type: m.outbound_field ? (outboundFlat.get(m.outbound_field) || "unknown") : "n/a",
      mapping_type: m.mapping_type,
      notes: m.transform_notes || "",
      confidence: m.confidence,
      ai_generated: false,
    });
  }

  // Add unresolved outbound fields not yet in mappings
  const mappedOut = new Set(existingMappings.map(m => m.outbound_field).filter(Boolean));
  for (const [path, type] of outboundFlat) {
    if (!mappedOut.has(path)) {
      rows.push({
        inbound_field: "",
        inbound_type: "n/a",
        outbound_field: path,
        outbound_type: type,
        mapping_type: "unresolved",
        notes: "No inbound source identified yet",
        confidence: "low",
        ai_generated: false,
      });
    }
  }

  return rows;
}

function generatePythonScript(mappingRows: MappingRow[], inboundSchema: any, outboundSchema: any): string {
  const inboundName = inboundSchema?.name || "InboundEvent";
  const outboundName = outboundSchema?.name || "OutboundEvent";

  const directLines: string[] = [];
  const renameLines: string[] = [];
  const transformLines: string[] = [];
  const derivedLines: string[] = [];
  const unresolvedLines: string[] = [];

  for (const row of mappingRows) {
    const ib = row.inbound_field;
    const ob = row.outbound_field;
    const note = row.notes ? `  # ${row.notes}` : "";

    const ibParts = ib.split(".");
    const obParts = ob.split(".");
    const ibAccess = ibParts.length > 1
      ? ibParts.slice(1).reduce((acc, p) => `${acc}.get("${p}", {})`, `inbound.get("${ibParts[0]}", {})`)
      : `inbound.get("${ib}")`;
    const obSet = buildNestedSet("outbound", obParts, ibAccess);

    switch (normalizeMappingType(row.mapping_type)) {
      case "direct":
        directLines.push(`    ${obSet}${note}`);
        break;
      case "rename":
        renameLines.push(`    ${obSet}${note}`);
        break;
      case "transform":
        transformLines.push(`    # TRANSFORM: ${ib} -> ${ob}${note ? note.replace("  #", " |") : ""}`);
        transformLines.push(`    # ${ob} = transform_${ob.replace(/\./g, "_")}(inbound.get("${ib}"))`);
        break;
      case "inferred":
        derivedLines.push(`    ${buildNestedSet("outbound", obParts, `"DERIVED"  # ${row.notes || ob}`)}  `);
        break;
      case "unresolved":
        unresolvedLines.push(`    # TODO: ${ob} (${row.outbound_type}) — ${row.notes || "source unknown"}`);
        break;
    }
  }

  return `"""
${outboundName} Mapper
Generated by EEB Schema Validator
Source: ${inboundName} -> ${outboundName}

WARNING: This is a draft scaffold. Review all TODOs and TRANSFORM sections
before deploying to production. Unresolved fields must be addressed.
"""
from datetime import datetime, timezone
from typing import Optional
import uuid


def parse_timestamp(value: Optional[str]) -> Optional[dict]:
    """Convert a date/datetime string to EEB timestamp object {dtm, dtmUtc}."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        dtm_utc = dt.astimezone(timezone.utc)
        return {
            "dtm": dt.isoformat(),
            "dtmUtc": dtm_utc.isoformat(),
        }
    except (ValueError, AttributeError):
        return None


def map_${inboundName.toLowerCase()}_to_${outboundName.toLowerCase()}(inbound: dict) -> dict:
    """
    Map ${inboundName} to ${outboundName}.

    Args:
        inbound: Parsed inbound Avro record as a Python dict

    Returns:
        outbound: Dict conforming to ${outboundName} schema
    """
    outbound = {}

    # ── Direct mappings ────────────────────────────────────────────────────
${directLines.length ? directLines.join("\n") : "    # (none detected)"}

    # ── Renames ────────────────────────────────────────────────────────────
${renameLines.length ? renameLines.join("\n") : "    # (none detected)"}

    # ── Transforms (implement these manually) ─────────────────────────────
${transformLines.length ? transformLines.join("\n") : "    # (none detected)"}

    # ── Derived / system fields ────────────────────────────────────────────
${derivedLines.length ? derivedLines.join("\n") : "    # (none detected)"}

    # ── UNRESOLVED — must be filled in before production ──────────────────
${unresolvedLines.length ? unresolvedLines.join("\n") : "    # (none)"}

    return outbound
`;
}

function buildNestedSet(root: string, parts: string[], valueExpr: string): string {
  if (parts.length === 1) return `${root}["${parts[0]}"] = ${valueExpr}`;
  // For nested: ensure parent dicts exist
  const parent = parts.slice(0, -1).join('"]["');
  return `${root}.setdefault("${parts.slice(0, -1).join('", {}).setdefault("')}",  {}); ${root}["${parent}"]["${parts[parts.length - 1]}"] = ${valueExpr}`;
}

function buildMappingPrompt(
  inboundSchema: any,
  outboundSchema: any,
  inboundIcd: string,
  outboundIcd: string,
  existingFindings: any[],
  existingMappings: any[]
): string {
  const unmapped = existingFindings.filter(
    (f: any) => f.category === "unmapped_field" || f.category === "missing_field"
  );
  const renames = existingFindings.filter((f: any) => f.category === "rename_candidate");

  return `Analyze these Avro schemas and ICD documents to produce a complete field mapping table and a Python mapper script scaffold.

INBOUND SCHEMA:
${JSON.stringify(inboundSchema, null, 2)}

OUTBOUND SCHEMA:
${JSON.stringify(outboundSchema, null, 2)}

${inboundIcd ? `INBOUND ICD (excerpt, may contain additional field definitions):\n${inboundIcd.slice(0, 4000)}` : ""}
${outboundIcd ? `OUTBOUND ICD (excerpt):\n${outboundIcd.slice(0, 4000)}` : ""}

DETERMINISTIC ANALYSIS FOUND:
- Directly matched fields: ${existingMappings.filter((m: any) => m.mapping_type === "direct").length}
- Unmapped inbound: ${unmapped.filter((f: any) => f.category === "unmapped_field").map((f: any) => f.field_path).join(", ") || "none"}
- Missing outbound sources: ${unmapped.filter((f: any) => f.category === "missing_field").map((f: any) => f.field_path).join(", ") || "none"}
- Rename candidates: ${renames.map((f: any) => f.message).join("; ") || "none"}

Respond with ONLY valid JSON — no markdown fences, no preamble — in this exact structure:
{
  "mapping_rows": [
    {
      "inbound_field": "dot.path or empty if derived/system",
      "inbound_type": "avro type string or n/a",
      "outbound_field": "dot.path",
      "outbound_type": "avro type string",
      "mapping_type": "direct | direct rename | reshape + rename | transform | derived | system-generated | conditional | unresolved",
      "notes": "brief human-readable note (max 120 chars)",
      "confidence": "high | medium | low"
    }
  ],
  "open_questions": [
    "Question requiring stakeholder clarification"
  ],
  "python_mapper": "complete Python script string with proper newlines",
  "notes": "Overall mapping assessment in 2-3 sentences"
}

Rules for mapping_rows:
1. Include every inbound field — even if unresolved
2. Include every required outbound field — mark as derived/system if no inbound source
3. For reshape+rename: inbound_field is the original flat path, outbound_field is the nested dot path
4. For timestamp transforms: note the {dtm, dtmUtc} target structure
5. For derived/system fields (appln.*, evSrc, arrDtm etc): inbound_field = "" or "n/a"
6. Confidence: high=exact match or clear rename, medium=inferred from ICD, low=guessed
7. python_mapper: a complete ready-to-extend Python function using the mapping_rows above`;
}
