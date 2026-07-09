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
    let javaMapper = "";
    let jsMapper = "";

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
You analyze inbound and outbound Avro schemas plus Interface Control Documents (ICDs) to produce precise field mapping tables, Java mapper classes, and JavaScript mapper modules.
Always respond with valid JSON only — no markdown, no extra text outside the JSON.`
            },
            { role: "user", content: prompt }
          ],
          max_tokens: 4000,
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
          javaMapper = parsed.java_mapper || "";
          jsMapper = parsed.js_mapper || generateJsMapper(aiMappingRows, inbound_schema, outbound_schema);
        } catch {
          aiNotes = raw.slice(0, 500);
        }
      } else {
        const errText = await aiRes.text();
        console.error("Databricks AI error:", errText);
      }
    } else {
      // Fallback: generate mapping rows deterministically, then build both scaffolds
      aiMappingRows = buildDeterministicMappingRows(inbound_schema, outbound_schema, existing_mappings);
      javaMapper = generateJavaMapper(aiMappingRows, inbound_schema, outbound_schema);
      jsMapper = generateJsMapper(aiMappingRows, inbound_schema, outbound_schema);
    }

    // Guarantee both mappers are populated even if AI omitted them
    if (!javaMapper) javaMapper = generateJavaMapper(aiMappingRows, inbound_schema, outbound_schema);
    if (!jsMapper) jsMapper = generateJsMapper(aiMappingRows, inbound_schema, outbound_schema);

    // Normalize and insert mapping candidates
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

    // Store java + js mapper in session summary
    if (javaMapper || jsMapper) {
      const { data: session } = await supabase
        .from("validation_sessions")
        .select("summary")
        .eq("id", session_id)
        .maybeSingle();

      await supabase
        .from("validation_sessions")
        .update({
          summary: { ...(session?.summary || {}), java_mapper: javaMapper, js_mapper: jsMapper },
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
        java_mapper: javaMapper,
        js_mapper: jsMapper,
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

function avroTypeToJava(avroType: string): string {
  const map: Record<string, string> = {
    string: "String",
    int: "Integer",
    long: "Long",
    float: "Float",
    double: "Double",
    boolean: "Boolean",
    bytes: "byte[]",
    null: "Object",
  };
  const lower = avroType.toLowerCase().replace(" (nullable)", "");
  if (map[lower]) return map[lower];
  if (lower.startsWith("record:")) return lower.replace("record:", "");
  if (lower.startsWith("array<")) return `List<Object>`;
  if (lower.startsWith("map<")) return `Map<String, Object>`;
  if (lower.includes("timestamp") || lower.includes("date")) return "String";
  return "Object";
}

function toCamelCase(dotPath: string): string {
  return dotPath.split(".").map((p, i) =>
    i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)
  ).join("");
}

function toClassName(name: string): string {
  if (!name) return "Event";
  const clean = name.replace(/[^a-zA-Z0-9]/g, " ").trim();
  return clean.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
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

function generateJavaMapper(mappingRows: MappingRow[], inboundSchema: any, outboundSchema: any): string {
  const inboundRaw = inboundSchema?.name || "InboundEvent";
  const outboundRaw = outboundSchema?.name || "OutboundEvent";
  const inboundClass = toClassName(inboundRaw);
  const outboundClass = toClassName(outboundRaw);
  const mapperClass = `${inboundClass}To${outboundClass}Mapper`;

  const directLines: string[] = [];
  const renameLines: string[] = [];
  const transformLines: string[] = [];
  const derivedLines: string[] = [];
  const unresolvedLines: string[] = [];

  for (const row of mappingRows) {
    const ib = row.inbound_field;
    const ob = row.outbound_field;
    const note = row.notes ? ` // ${row.notes}` : "";

    const ibGetter = ib
      ? ib.split(".").reduce((acc, p) => `${acc}.get${p.charAt(0).toUpperCase() + p.slice(1)}()`, "inbound")
      : "null";

    const obSetter = ob
      ? `outbound.set${ob.split(".").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("_")}(${ibGetter});`
      : "";

    const javaType = avroTypeToJava(row.outbound_type || "string");

    switch (normalizeMappingType(row.mapping_type)) {
      case "direct":
        directLines.push(`        ${obSetter}${note}`);
        break;
      case "rename":
        renameLines.push(`        ${obSetter}${note}`);
        break;
      case "transform":
        transformLines.push(
          `        // TODO TRANSFORM: ${ib} -> ${ob}${note ? note.replace(" //", " |") : ""}`,
          `        // outbound.set${ob ? ob.split(".").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("_") : "Field"}(transform(${ibGetter}));`
        );
        break;
      case "inferred":
        derivedLines.push(`        // DERIVED: ${ob} — ${row.notes || "set by system"}${note}`);
        break;
      case "unresolved":
        unresolvedLines.push(
          `        // TODO UNRESOLVED: ${ob} (${javaType}) — ${row.notes || "source unknown"}`
        );
        break;
    }
  }

  return `package com.eeb.mapper;

import org.springframework.stereotype.Component;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.HashMap;

/**
 * ${mapperClass}
 *
 * Generated by EEB Schema Validator
 * Source schema : ${inboundRaw}
 * Target schema : ${outboundRaw}
 *
 * WARNING: This is a draft scaffold. Review all TODO sections before
 * deploying to production. Unresolved fields MUST be addressed.
 */
@Component
public class ${mapperClass} {

    private static final DateTimeFormatter ISO_FMT =
        DateTimeFormatter.ISO_OFFSET_DATE_TIME.withZone(ZoneOffset.UTC);

    /**
     * Map a ${inboundClass} record to ${outboundClass}.
     *
     * @param inbound parsed inbound Avro record (use generated specific record or GenericRecord)
     * @return populated ${outboundClass} object
     */
    public ${outboundClass} map(${inboundClass} inbound) {
        ${outboundClass} outbound = new ${outboundClass}();

        // ── Direct mappings ──────────────────────────────────────────────────
${directLines.length ? directLines.join("\n") : "        // (none detected)"}

        // ── Renames ──────────────────────────────────────────────────────────
${renameLines.length ? renameLines.join("\n") : "        // (none detected)"}

        // ── Transforms (implement manually) ─────────────────────────────────
${transformLines.length ? transformLines.join("\n") : "        // (none detected)"}

        // ── Derived / system fields ──────────────────────────────────────────
${derivedLines.length ? derivedLines.join("\n") : "        // (none detected)"}

        // ── UNRESOLVED — must be filled in before production ─────────────────
${unresolvedLines.length ? unresolvedLines.join("\n") : "        // (none)"}

        return outbound;
    }

    /**
     * Convert a timestamp string to ISO-8601 UTC string.
     * Adjust this to match your actual timestamp handling.
     */
    private String toUtcIso(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return ISO_FMT.format(Instant.parse(value));
        } catch (Exception e) {
            return value;
        }
    }
}
`;
}

function generateJsMapper(mappingRows: MappingRow[], inboundSchema: any, outboundSchema: any): string {
  const inboundRaw = inboundSchema?.name || "InboundEvent";
  const outboundRaw = outboundSchema?.name || "OutboundEvent";

  const directLines: string[] = [];
  const renameLines: string[] = [];
  const transformLines: string[] = [];
  const derivedLines: string[] = [];
  const unresolvedLines: string[] = [];

  for (const row of mappingRows) {
    const ib = row.inbound_field;
    const ob = row.outbound_field;
    const note = row.notes ? ` // ${row.notes}` : "";

    const getter = ib ? buildJsGetter("inbound", ib) : "undefined";
    const setter = ob ? `  ${buildJsSetter("outbound", ob, getter)};${note}` : "";

    switch (normalizeMappingType(row.mapping_type)) {
      case "direct":
        if (setter) directLines.push(setter);
        break;
      case "rename":
        if (setter) renameLines.push(setter);
        break;
      case "transform":
        transformLines.push(
          `  // TODO TRANSFORM: ${ib || "?"} -> ${ob || "?"}${note ? note.replace(" //", " |") : ""}`,
          `  // ${ob ? buildJsSetter("outbound", ob, `transform(${getter})`) : "outbound.field = transform(...)"}; `
        );
        break;
      case "inferred":
        derivedLines.push(`  // DERIVED: ${ob} — ${row.notes || "set by system"}`);
        break;
      case "unresolved":
        unresolvedLines.push(
          `  // TODO UNRESOLVED: ${ob} — ${row.notes || "source unknown"}`
        );
        break;
    }
  }

  return `'use strict';

/**
 * ${inboundRaw} -> ${outboundRaw} mapper
 *
 * Generated by EEB Schema Validator
 * Source schema : ${inboundRaw}
 * Target schema : ${outboundRaw}
 *
 * WARNING: Draft scaffold — review all TODO sections before deploying.
 * Unresolved fields MUST be addressed before production use.
 *
 * Usage (Kafka Streams / Node consumer):
 *   const { mapEvent } = require('./${inboundRaw}To${outboundRaw}Mapper');
 *   const outbound = mapEvent(inboundRecord);
 */

/**
 * @param {Object} inbound - Parsed inbound Avro record (plain JS object)
 * @returns {Object} outbound - Populated outbound record
 */
function mapEvent(inbound) {
  const outbound = {};

  // -- Direct mappings ----------------------------------------------------------
${directLines.length ? directLines.join("\n") : "  // (none detected)"}

  // -- Renames ------------------------------------------------------------------
${renameLines.length ? renameLines.join("\n") : "  // (none detected)"}

  // -- Transforms (implement manually) -----------------------------------------
${transformLines.length ? transformLines.join("\n") : "  // (none detected)"}

  // -- Derived / system fields --------------------------------------------------
${derivedLines.length ? derivedLines.join("\n") : "  // (none detected)"}

  // -- UNRESOLVED — must be filled in before production ------------------------
${unresolvedLines.length ? unresolvedLines.join("\n") : "  // (none)"}

  return outbound;
}

/**
 * Example timestamp transform — adjust to match your ICD format.
 * @param {string|number} value
 * @returns {string} ISO-8601 UTC string
 */
function toUtcIso(value) {
  if (value == null) return null;
  return new Date(value).toISOString();
}

module.exports = { mapEvent, toUtcIso };
`;
}

function buildJsGetter(root: string, dotPath: string): string {
  return dotPath.split(".").reduce((acc, p) => `${acc}?.${p}`, root).replace(/^\?\./, root + ".");
}

function buildJsSetter(root: string, dotPath: string, value: string): string {
  const parts = dotPath.split(".");
  if (parts.length === 1) return `${root}.${parts[0]} = ${value}`;
  const nested = parts.slice(0, -1).map((p, i) => {
    const path = `${root}.${parts.slice(0, i + 1).join(".")}`;
    return `  if (!${path}) ${path} = {};`;
  });
  return `${nested.join("\n")}\n  ${root}.${dotPath} = ${value}`;
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

  const inboundName = inboundSchema?.name || "InboundEvent";
  const outboundName = outboundSchema?.name || "OutboundEvent";
  const mapperClass = `${toClassName(inboundName)}To${toClassName(outboundName)}Mapper`;

  return `Analyze these Avro schemas and ICD documents to produce a complete field mapping table and a Java mapper class scaffold.

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
  "java_mapper": "complete Java class string with proper newlines (Spring @Component, package com.eeb.mapper)",
  "js_mapper": "complete Node.js CommonJS module string — function mapEvent(inbound) returning outbound object, with TODO comments for transforms/unresolved, module.exports at bottom",
  "notes": "Overall mapping assessment in 2-3 sentences"
}

Rules for mapping_rows:
1. Include every inbound field — even if unresolved
2. Include every required outbound field — mark as derived/system if no inbound source
3. For reshape+rename: inbound_field is the original flat path, outbound_field is the nested dot path
4. For timestamp transforms: note the ISO-8601 UTC conversion to String target
5. For derived/system fields (appln.*, evSrc, arrDtm etc): inbound_field = "" or "n/a"
6. Confidence: high=exact match or clear rename, medium=inferred from ICD, low=guessed
7. java_mapper: a complete ready-to-extend Java class named ${mapperClass} using Spring @Component, with proper getters/setters based on field names. Include TODO comments for transforms and unresolved fields. Use com.eeb.mapper package.`;
}
