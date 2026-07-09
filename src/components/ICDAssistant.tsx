import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Sparkles, ChevronRight, ChevronDown, Download, Plus, Trash2, RefreshCw, CheckCircle, AlertCircle, FileText, ArrowRight, Info, CreditCard as Edit3, Save, X, Wand2, Github, ExternalLink, GitBranch, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callServerlessAI(
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  userId?: string
): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/databricks-sql-ai`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, user_id: userId, request_type: 'icd-proposal' }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `AI error: HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AvroBaseType = 'string' | 'int' | 'long' | 'float' | 'double' | 'boolean' | 'bytes' | 'null';

type TransformRule =
  | 'direct'
  | 'rename'
  | 'normalize-timestamp'
  | 'utc-convert'
  | 'external-lookup'
  | 'derive'
  | 'fallback'
  | 'omit';

interface InboundField {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  description: string;
}

interface MappingRow {
  id: string;
  inboundField: string;
  outboundField: string;
  avroType: AvroBaseType;
  nullable: boolean;
  transformRule: TransformRule;
  transformNote: string;
  isPii: boolean;
  required: boolean;
}

type Step = 'input' | 'reviewing' | 'approved';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function downloadText(filename: string, content: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  a.download = filename;
  a.click();
}

const EEB_APPLN_HEADER = {
  name: 'appln',
  type: {
    fields: [
      { name: 'id', type: 'string' },
      { name: 'refreshId', type: 'string' },
      { default: null, name: 'refreshRecCnt', type: ['null', 'int'] },
      { default: null, name: 'replayId', type: ['null', 'string'] },
      { name: 'srce', type: 'string' },
      {
        name: 'srceInfo',
        type: {
          items: {
            fields: [
              { default: null, name: 'applnId', type: ['null', 'string'] },
              { name: 'applnName', type: 'string' },
              {
                default: null,
                name: 'arrDtm',
                type: [
                  'null',
                  {
                    fields: [
                      { name: 'dtm', type: 'string' },
                      { default: null, name: 'dtmUtc', type: ['null', { logicalType: 'local-timestamp-micros', type: 'long' }] },
                    ],
                    name: 'Timestamp',
                    namespace: 'gov.usps.enterprise.eventbroker.kafka.persistent.common.util',
                    type: 'record',
                  },
                ],
              },
              { default: null, name: 'id', type: ['null', 'string'] },
              { name: 'prcsdDtm', type: 'gov.usps.enterprise.eventbroker.kafka.persistent.common.util.Timestamp' },
              { default: null, name: 'ver', type: ['null', 'string'] },
            ],
            name: 'ReferenceSourceInformation',
            type: 'record',
          },
          'java-class': 'java.util.List',
          type: 'array',
        },
      },
      { name: 'type', type: 'string' },
    ],
    name: 'RefreshReferenceApplication',
    namespace: 'gov.usps.enterprise.eventbroker.kafka.persistent.common.application',
    type: 'record',
  },
};

interface KeyField {
  id: string;
  fieldName: string;
  avroType: AvroBaseType;
  nullable: boolean;
}

function buildKeyAvroSchema(topicName: string, namespace: string, keyFields: KeyField[]): string {
  const fields = keyFields.filter(f => f.fieldName.trim()).map(f => ({
    name: f.fieldName,
    type: f.nullable ? ['null', f.avroType] : f.avroType,
    default: f.nullable ? null : undefined,
  }));
  if (fields.length === 0) {
    fields.push({ name: 'key', type: 'string' as any, default: undefined });
  }
  return JSON.stringify(
    {
      type: 'record',
      name: topicName.replace(/[^a-zA-Z0-9]/g, '_') + '_key',
      namespace,
      doc: `Key schema for ${topicName}`,
      fields,
    },
    null,
    2
  );
}

function buildAvroSchema(topicName: string, namespace: string, rows: MappingRow[]): string {
  const dataFields = rows
    .filter(r => r.transformRule !== 'omit' && r.outboundField.trim())
    .map(r => {
      // Timestamp fields use the EEB common Timestamp type (already defined inside appln header)
      const isTimestamp = r.transformRule === 'normalize-timestamp' || r.transformRule === 'utc-convert';
      const avroType = isTimestamp
        ? 'gov.usps.enterprise.eventbroker.kafka.persistent.common.util.Timestamp'
        : r.avroType;
      return {
        name: r.outboundField,
        type: r.nullable ? ['null', avroType] : avroType,
        default: r.nullable ? null : undefined,
        doc: r.transformNote || undefined,
      };
    });

  return JSON.stringify(
    {
      type: 'record',
      name: topicName.replace(/[^a-zA-Z0-9]/g, '_'),
      namespace,
      doc: `Outbound schema for ${topicName}`,
      fields: [EEB_APPLN_HEADER, ...dataFields],
    },
    null,
    2
  );
}

function buildDataSpec(rows: MappingRow[]): string {
  const header = 'Outbound Field,Avro Type,Nullable,PII,Transform Rule,Source Field,Notes';
  const dataRows = rows
    .filter(r => r.transformRule !== 'omit' && r.outboundField.trim())
    .map(r =>
      [
        r.outboundField,
        r.avroType,
        r.nullable ? 'Y' : 'N',
        r.isPii ? 'Y' : 'N',
        r.transformRule,
        r.inboundField,
        r.transformNote,
      ].join(',')
    );
  return [header, ...dataRows].join('\n');
}

function parseInboundSchema(raw: string): InboundField[] {
  const trimmed = raw.trim();

  // Try Avro JSON
  try {
    const json = JSON.parse(trimmed);
    const fields = json.fields ?? json[0]?.fields ?? [];
    if (Array.isArray(fields) && fields.length > 0) {
      return fields.map((f: any, i: number) => {
        const type = Array.isArray(f.type)
          ? f.type.find((t: any) => t !== 'null') ?? 'string'
          : f.type ?? 'string';
        return {
          id: String(i),
          name: f.name ?? '',
          type: typeof type === 'object' ? type.type ?? 'string' : String(type),
          nullable: Array.isArray(f.type) && f.type.includes('null'),
          description: f.doc ?? '',
        };
      });
    }
  } catch {
    // not JSON
  }

  // Try CSV (header row + data or just field list)
  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    // Detect if first line looks like a header with multiple comma-separated tokens
    const firstLine = lines[0];
    if (firstLine.includes(',')) {
      // Header + rows CSV: first column = field name
      const headers = firstLine.split(',').map(h => h.trim().toLowerCase());
      const nameIdx = headers.findIndex(h => h.includes('field') || h.includes('name') || h === 'column');
      const typeIdx = headers.findIndex(h => h.includes('type'));
      const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('note'));
      return lines.slice(1).map((line, i) => {
        const cols = line.split(',').map(c => c.trim());
        return {
          id: String(i),
          name: cols[nameIdx >= 0 ? nameIdx : 0] ?? '',
          type: cols[typeIdx >= 0 ? typeIdx : 1] ?? 'string',
          nullable: true,
          description: cols[descIdx >= 0 ? descIdx : -1] ?? '',
        };
      }).filter(f => f.name);
    }
    // Plain list of field names, one per line
    return lines.map((name, i) => ({ id: String(i), name, type: 'string', nullable: true, description: '' }));
  }

  return [];
}

const TRANSFORM_LABELS: Record<TransformRule, string> = {
  direct: 'Direct copy',
  rename: 'Rename',
  'normalize-timestamp': 'Normalize timestamp',
  'utc-convert': 'UTC convert',
  'external-lookup': 'External lookup',
  derive: 'Derive / compute',
  fallback: 'Fallback selection',
  omit: 'Omit (not mapped)',
};

const AVRO_TYPES: AvroBaseType[] = ['string', 'int', 'long', 'float', 'double', 'boolean', 'bytes', 'null'];

function toAvroBaseType(type: string): AvroBaseType {
  if (type === 'long' || type.toLowerCase().includes('timestamp')) return 'long';
  if (type === 'int') return 'int';
  if (type === 'boolean') return 'boolean';
  if (type === 'float') return 'float';
  if (type === 'double') return 'double';
  if (type === 'bytes') return 'bytes';
  return 'string';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ICDAssistant() {
  const { userProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('input');
  const [rawSchema, setRawSchema] = useState('');
  const [actualOutboundSchema, setActualOutboundSchema] = useState('');
  const [businessRules, setBusinessRules] = useState('');
  const [outboundTopicName, setOutboundTopicName] = useState('');
  const [namespace, setNamespace] = useState('gov.usps.enterprise.eventbroker.kafka.persistent.event');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [showGithubModal, setShowGithubModal] = useState(false);
  const [githubConfig, setGithubConfig] = useState({ owner: '', repo: 'eeb-kafka-schemas', branch: '', baseBranch: 'main', openPr: true });
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'success' | 'error'>('idle');
  const [pushResult, setPushResult] = useState<{ branchUrl: string; actionsUrl: string; prUrl?: string } | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [keyFields, setKeyFields] = useState<KeyField[]>([
    { id: crypto.randomUUID(), fieldName: '', avroType: 'string', nullable: false },
  ]);

  useEffect(() => {
    if (outboundTopicName.trim()) {
      const slug = outboundTopicName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      setGithubConfig(c => ({ ...c, branch: `schema/${slug}` }));
    }
  }, [outboundTopicName]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);

    const isExcel = /\.(xlsx|xls)$/i.test(file.name);

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const workbook = XLSX.read(ev.target?.result, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
          if (rows.length === 0) {
            setParseError('Excel file appears to be empty.');
            return;
          }
          // Convert to CSV so the existing parseInboundSchema handles it
          const csv = rows
            .map(row => (row as any[]).map(cell => String(cell ?? '').replace(/,/g, ';')).join(','))
            .join('\n');
          setRawSchema(csv);
        } catch {
          setParseError('Could not read Excel file. Try saving as CSV and uploading that instead.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = ev => setRawSchema(ev.target?.result as string ?? '');
      reader.readAsText(file);
    }
  };

  const handleAnalyze = async () => {
    setAiError(null);
    setParseError(null);

    const fields = parseInboundSchema(rawSchema);
    if (fields.length === 0) {
      setParseError('Could not detect any fields. Paste an Avro .avsc (JSON), a CSV with a header row, or a plain list of field names.');
      return;
    }

    const actualOutboundFields = actualOutboundSchema.trim() ? parseInboundSchema(actualOutboundSchema) : null;

    setIsAnalyzing(true);
    try {
      let systemPrompt: string;
      let userContent: string;

      if (actualOutboundFields && actualOutboundFields.length > 0) {
        // ── Two-schema match mode ──────────────────────────────────────────
        systemPrompt = `You are a Kafka ICD documentation expert.
You are given an INBOUND schema (source system) and an OUTBOUND schema (actual EEB Kafka topic, already deployed).
Match each OUTBOUND field to its INBOUND source field and identify the transformation.

RULES:
- Use the EXACT outbound field names provided — do not invent or rename them.
- Use the EXACT inbound field names when referencing source fields — do not invent them.
- EEB infrastructure fields with no inbound source (like "appln"): inboundField="" and transformRule="derive".
- Renamed fields (e.g. sequenceNumber→seqNbr, mailerId→mlrId): transformRule="rename".
- Timestamp/date fields converting to epoch millis: transformRule="normalize-timestamp", avroType="long".
- Nullable: set true/false to exactly match the OUTBOUND field's nullability.
- Mark isPii true for names, SSNs, emails, addresses.

Respond ONLY with a valid JSON array, no markdown:
[
  {
    "inboundField": "exact_inbound_name_or_empty_string",
    "outboundField": "exact_outbound_name",
    "avroType": "string|int|long|float|double|boolean|bytes",
    "nullable": false,
    "transformRule": "direct|rename|normalize-timestamp|utc-convert|external-lookup|derive|fallback|omit",
    "transformNote": "brief description",
    "isPii": false,
    "required": true
  }
]`;

        userContent = `INBOUND fields (source system):\n${fields.map(f => `- ${f.name} (${f.type}, ${f.nullable ? 'nullable' : 'REQUIRED'}${f.description ? ': ' + f.description : ''})`).join('\n')}\n\nOUTBOUND fields (actual EEB schema to match against):\n${actualOutboundFields.map(f => `- ${f.name} (${f.type}, ${f.nullable ? 'nullable' : 'REQUIRED'}${f.description ? ': ' + f.description : ''})`).join('\n')}${businessRules ? `\n\nAdditional notes:\n${businessRules}` : ''}`;
      } else {
        // ── Generate mode (single schema, no actual outbound provided) ─────
        systemPrompt = `You are an expert in Kafka ingest mapping for the USPS Enterprise Event Broker (EEB) platform.
You receive inbound schema fields from a source system and must propose outbound EEB Kafka topic field mappings.

NULLABILITY (critical — follow exactly):
- If the inbound field is labeled "REQUIRED": set nullable=false and required=true. Do NOT add null to the Avro union.
- If the inbound field is labeled "nullable": set nullable=true and required=false.
- Never make a REQUIRED inbound field nullable in the outbound.

TYPE PRESERVATION:
- Preserve the inbound Avro type whenever possible. Do not silently convert boolean to string.
- Map Timestamp record types (gov.usps...Timestamp or similar) to long (epoch millis) with transform "normalize-timestamp".
- For plain string/int/long/float/double/boolean/bytes — keep the same type.

EEB OUTBOUND FIELD NAMING CONVENTION (apply to all outbound field names):
EEB schemas use abbreviated camelCase names. Apply these abbreviations:
- Number/Nbr: sequenceNumber → seqNbr, recordNumber → recNbr
- Identifier/Id: mailerId → mlrId, applicationId → applnId
- Previous/Prv: previousCrid → prvCrid, previousOwner → prvOwnr
- Current/Curr: currentCrid → currCrid, currentOwner → currOwnr
- Change/Chg: changeReason → chgRsn, changeDate → chgDtm
- Reason/Rsn: changeReason → chgRsn, requestReason → rqstRsn
- Date/Time/Dtm: lastUpdatedTimestamp → lastUpdDtm, processedDateTime → prcsdDtm
- Last Updated/LastUpd: lastUpdatedByUser → lastUpdUserId, lastUpdatedDate → lastUpdDtm
- Application/Appln: applicationId → applnId, applicationName → applnName
- Source/Srce: sourceSystem → srceSys, sourceInfo → srceInfo
- Processed/Prcsd: processedDate → prcsdDtm
- Record/Rec: recordCount → recCnt
- Message/Msg: messageId → msgId, messageType → msgType
- Status/Sts: statusIndicator → stsInd
- Indicator/Ind: statusIndicator → stsInd, activeIndicator → actInd
When in doubt, abbreviate to the shortest unambiguous token and combine with camelCase.

EEB INFRASTRUCTURE FIELDS (handle specially):
- Fields named "refreshId", "refreshRecCnt", "replayId", "srce", "srceInfo" belong to the EEB "appln" header block, which is injected by the EEB framework and NOT part of the field mapping. Set these to transformRule="omit" with transformNote="EEB appln header — framework-injected, not a source mapping".

TRANSFORM RULES:
- direct: field passes through unchanged
- rename: field is renamed but value is unchanged
- normalize-timestamp: convert date/time string or Timestamp record to epoch millis long
- utc-convert: convert timestamp to UTC epoch long
- external-lookup: ID/code field requiring a service lookup
- derive: field is computed or derived from other fields
- omit: field is not included in the outbound

Mark PII fields (names, SSNs, emails, addresses) as isPii: true.

Respond ONLY with a valid JSON array (no markdown, no explanation):
[
  {
    "inboundField": "SOURCE_FIELD_NAME",
    "outboundField": "eebAbbreviatedCamelCaseName",
    "avroType": "string",
    "nullable": false,
    "transformRule": "direct",
    "transformNote": "brief note",
    "isPii": false,
    "required": true
  }
]`;

        userContent = `Inbound fields:\n${fields.map(f => `- ${f.name} (${f.type}, ${f.nullable ? 'nullable' : 'REQUIRED'}${f.description ? ': ' + f.description : ''})`).join('\n')}${businessRules ? `\n\nBusiness rules / notes:\n${businessRules}` : ''}${outboundTopicName ? `\n\nOutbound topic: ${outboundTopicName}` : ''}`;
      }

      const response = await callServerlessAI(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        userProfile?.id
      );

      // Extract JSON from response (strip any markdown code fences)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('AI response did not contain a valid JSON array.');

      const proposed: Omit<MappingRow, 'id'>[] = JSON.parse(jsonMatch[0]);

      // Build lookups for post-processing enforcement
      const inboundByName = new Map(fields.map(f => [f.name, f]));
      const outboundByName = actualOutboundFields ? new Map(actualOutboundFields.map(f => [f.name, f])) : null;
      const validTransforms = Object.keys(TRANSFORM_LABELS) as TransformRule[];

      setMappings(
        proposed.map(r => {
          const inbound = inboundByName.get(r.inboundField);
          const outbound = outboundByName?.get(r.outboundField);

          // In two-schema mode: outbound field name/type/nullable come from actual schema, not AI
          const isRequired = outbound
            ? !outbound.nullable
            : inbound !== undefined && !inbound.nullable;

          // Avro type: prefer actual outbound type when available, else preserve boolean
          let avroType: AvroBaseType;
          if (outbound) {
            avroType = toAvroBaseType(outbound.type);
          } else {
            avroType = AVRO_TYPES.includes(r.avroType as AvroBaseType) ? r.avroType as AvroBaseType : 'string';
            const inboundType = inbound?.type as AvroBaseType | undefined;
            const isTimestampTransform = r.transformRule === 'normalize-timestamp' || r.transformRule === 'utc-convert';
            if (inboundType === 'boolean' && !isTimestampTransform) avroType = 'boolean';
          }

          return {
            ...r,
            id: crypto.randomUUID(),
            avroType,
            transformRule: validTransforms.includes(r.transformRule as TransformRule)
              ? (r.transformRule as TransformRule)
              : 'direct',
            nullable: isRequired ? false : true,
            required: isRequired,
          };
        })
      );
      setStep('reviewing');
    } catch (err: any) {
      setAiError(err?.message ?? 'AI analysis failed. Check your connection and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateMapping = (id: string, patch: Partial<MappingRow>) => {
    setMappings(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const deleteMapping = (id: string) => {
    setMappings(prev => prev.filter(r => r.id !== id));
  };

  const addMapping = () => {
    setMappings(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        inboundField: '',
        outboundField: '',
        avroType: 'string',
        nullable: true,
        transformRule: 'direct',
        transformNote: '',
        isPii: false,
        required: false,
      },
    ]);
  };

  const handleApprove = () => {
    setStep('approved');
    setSuccessMsg('Mapping approved. Download the Avro schema and DataSpec below.');
  };

  const handleDownloadAvro = () => {
    const topic = outboundTopicName || 'outbound';
    downloadText(`${topic}-value.avsc`, buildAvroSchema(topic, namespace, mappings));
  };

  const handleDownloadKeyAvro = () => {
    const topic = outboundTopicName || 'outbound';
    downloadText(`${topic}-key.avsc`, buildKeyAvroSchema(topic, namespace, keyFields));
  };

  const handleDownloadDataSpec = () => {
    downloadText('DataSpec.csv', buildDataSpec(mappings));
  };

  const handlePushToGithub = async () => {
    if (!githubConfig.owner || !githubConfig.repo || !githubConfig.branch) return;
    setPushStatus('pushing');
    setPushError(null);
    setPushResult(null);
    const topic = outboundTopicName || 'outbound';
    try {
      const res = await supabase.functions.invoke('push-to-github', {
        body: {
          owner: githubConfig.owner,
          repo: githubConfig.repo,
          branch: githubConfig.branch,
          baseBranch: githubConfig.baseBranch || 'main',
          openPr: githubConfig.openPr,
          commitMessage: `chore: generated schema and mapping for ${topic}`,
          prTitle: `[EEB ICD] ${topic} — generated Avro schema + DataSpec`,
          prBody: `## Generated by EEB ICD Assistant\n\n**Outbound topic:** \`${topic}\`\n**Namespace:** \`${namespace}\`\n\nFiles included:\n- \`schemas/${topic}-key.avsc\` — Avro key schema\n- \`schemas/${topic}-value.avsc\` — Avro value schema\n- \`specs/DataSpec_${topic}.csv\` — Field mapping spec\n\nGitHub Actions will validate the schema on push.`,
          files: [
            { path: `schemas/${topic}-key.avsc`, content: buildKeyAvroSchema(topic, namespace, keyFields) },
            { path: `schemas/${topic}-value.avsc`, content: buildAvroSchema(topic, namespace, mappings) },
            { path: `specs/DataSpec_${topic}.csv`, content: buildDataSpec(mappings) },
          ],
        },
      });
      if (res.error) throw new Error(res.error.message);
      const result = res.data as { success: boolean; branch_url: string; actions_url: string; pr?: { url: string }; error?: string };
      if (!result.success) throw new Error(result.error ?? 'Push failed');
      setPushResult({ branchUrl: result.branch_url, actionsUrl: result.actions_url, prUrl: result.pr?.url });
      setPushStatus('success');
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Push failed');
      setPushStatus('error');
    }
  };

  const handleReset = () => {
    setStep('input');
    setMappings([]);
    setRawSchema('');
    setActualOutboundSchema('');
    setBusinessRules('');
    setOutboundTopicName('');
    setAiError(null);
    setParseError(null);
    setSuccessMsg(null);
    setKeyFields([{ id: crypto.randomUUID(), fieldName: '', avroType: 'string', nullable: false }]);
  };

  const activeMappings = mappings.filter(r => r.transformRule !== 'omit');
  const omittedCount = mappings.length - activeMappings.length;
  const piiCount = activeMappings.filter(r => r.isPii).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-gradient-to-br from-violet-500 to-blue-600 p-2 rounded-lg">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">ICD Assistant</h1>
          </div>
          <p className="text-slate-500 text-sm ml-14">
            Paste your inbound schema — AI proposes the outbound field mapping for review.
          </p>
        </div>
        {step !== 'input' && (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Start over
          </button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {(['input', 'reviewing', 'approved'] as Step[]).map((s, i) => {
          const labels: Record<Step, string> = { input: '1. Inbound Schema', reviewing: '2. Review Mapping', approved: '3. Export' };
          const active = s === step;
          const done = ['input', 'reviewing', 'approved'].indexOf(step) > i;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                active ? 'bg-blue-600 text-white' : done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
              }`}>
                {done ? <CheckCircle className="w-3.5 h-3.5" /> : null}
                {labels[s]}
              </div>
              {i < 2 && <ChevronRight className="w-4 h-4 text-slate-300" />}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Input ── */}
      {step === 'input' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Outbound topic / schema name
              </label>
              <input
                type="text"
                value={outboundTopicName}
                onChange={e => setOutboundTopicName(e.target.value)}
                placeholder="e.g. ShippingServiceValidation"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Avro namespace
              </label>
              <input
                type="text"
                value={namespace}
                onChange={e => setNamespace(e.target.value)}
                placeholder="gov.usps.enterprise.eventbroker.kafka.persistent.event"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">
                Inbound schema <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Avro .avsc, CSV, or field list</span>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload file
                </button>
                <input ref={fileRef} type="file" accept=".json,.avsc,.csv,.txt,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
              </div>
            </div>
            <textarea
              rows={10}
              value={rawSchema}
              onChange={e => setRawSchema(e.target.value)}
              placeholder={`Paste any of:\n• Avro schema JSON  {"type":"record","fields":[...]}\n• CSV with header   FieldName,Type,Nullable,Description\n• Plain field list  one field name per line`}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
            {parseError && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />{parseError}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">
                Actual outbound schema <span className="text-slate-400 font-normal">(optional — paste the real EEB schema to validate mapping)</span>
              </label>
            </div>
            <textarea
              rows={6}
              value={actualOutboundSchema}
              onChange={e => setActualOutboundSchema(e.target.value)}
              placeholder={`Paste the deployed EEB outbound Avro schema here.\nWhen provided, the AI will match inbound → outbound fields instead of generating new names.\nOutbound field names, types, and nullability will be taken directly from this schema.`}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
            {actualOutboundSchema.trim() && (
              <p className="mt-1 text-xs text-green-700 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Match mode active — AI will map inbound fields to your exact outbound schema.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Business rules / transformation notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={businessRules}
              onChange={e => setBusinessRules(e.target.value)}
              placeholder="e.g. lastUpdatedTimestamp is an Oracle date string — normalize to epoch millis. FACILITY_CODE requires a CommonWebService lookup. refreshId and refreshRecCnt are EEB appln header fields — omit from mapping."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          {/* Key schema fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-mono">
                  <Key className="w-3 h-3" />
                  KEY
                </span>
                Key schema fields
                <span className="text-slate-400 font-normal text-xs">— defines {outboundTopicName ? `${outboundTopicName}-key.avsc` : 'topic-key.avsc'}</span>
              </label>
              <button
                onClick={() => setKeyFields(kf => [...kf, { id: crypto.randomUUID(), fieldName: '', avroType: 'string', nullable: false }])}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Add key field
              </button>
            </div>
            <div className="border border-amber-200 rounded-lg overflow-hidden bg-amber-50/30">
              <table className="w-full text-sm">
                <thead className="bg-amber-50 border-b border-amber-200">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-amber-700 w-56">Field Name</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-amber-700 w-32">Avro Type</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-amber-700 w-20">Nullable</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 bg-white">
                  {keyFields.map(kf => (
                    <tr key={kf.id} className="group hover:bg-amber-50/50 transition-colors">
                      <td className="px-3 py-1.5">
                        <input
                          value={kf.fieldName}
                          onChange={e => setKeyFields(prev => prev.map(f => f.id === kf.id ? { ...f, fieldName: e.target.value } : f))}
                          placeholder="e.g. barCode"
                          className="w-full text-sm border border-slate-200 rounded px-2 py-1 font-mono focus:ring-1 focus:ring-amber-400 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={kf.avroType}
                          onChange={e => setKeyFields(prev => prev.map(f => f.id === kf.id ? { ...f, avroType: e.target.value as AvroBaseType } : f))}
                          className="text-sm border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-amber-400 focus:outline-none"
                        >
                          {AVRO_TYPES.filter(t => t !== 'null').map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={kf.nullable}
                          onChange={e => setKeyFields(prev => prev.map(f => f.id === kf.id ? { ...f, nullable: e.target.checked } : f))}
                          className="rounded text-amber-500"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {keyFields.length > 1 && (
                          <button
                            onClick={() => setKeyFields(prev => prev.filter(f => f.id !== kf.id))}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Typically 1 field (e.g. <code className="bg-slate-100 px-1 rounded">barCode</code>, <code className="bg-slate-100 px-1 rounded">trackingNumber</code>). This becomes the Confluent Schema Registry key subject.
            </p>
          </div>

          {aiError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {aiError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleAnalyze}
              disabled={!rawSchema.trim() || isAnalyzing}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {actualOutboundSchema.trim() ? 'Match schemas' : 'Propose outbound mapping'}
                </>
              )}
            </button>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              {actualOutboundSchema.trim()
                ? 'AI will match your inbound fields to the exact outbound schema you provided.'
                : 'AI will propose field names, types, and transform rules for your review.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Step 2: Review mapping table ── */}
      {step === 'reviewing' && (
        <div className="space-y-4">

          {/* Summary chips */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1 rounded-full">
              {activeMappings.length} mapped fields
            </span>
            {omittedCount > 0 && (
              <span className="bg-slate-100 text-slate-500 text-xs font-medium px-3 py-1 rounded-full">
                {omittedCount} omitted
              </span>
            )}
            {piiCount > 0 && (
              <span className="bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1 rounded-full">
                {piiCount} PII fields
              </span>
            )}
            <span className="text-xs text-slate-400 ml-auto">
              Edit any row, then approve to export.
            </span>
          </div>

          {/* Mapping table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Inbound field</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Outbound field</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Transform</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Note</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">Null</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-12">PII</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mappings.map(row => {
                  const isEditing = editingId === row.id;
                  const isOmitted = row.transformRule === 'omit';
                  return (
                    <tr key={row.id} className={`group transition-colors ${isOmitted ? 'opacity-40 bg-slate-50' : 'hover:bg-slate-50'}`}>
                      {isEditing ? (
                        <>
                          <td className="px-2 py-1.5">
                            <input className="w-full border border-blue-300 rounded px-2 py-1 text-xs font-mono" value={row.inboundField} onChange={e => updateMapping(row.id, { inboundField: e.target.value })} />
                          </td>
                          <td className="px-2 py-1.5">
                            <input className="w-full border border-blue-300 rounded px-2 py-1 text-xs font-mono" value={row.outboundField} onChange={e => updateMapping(row.id, { outboundField: e.target.value })} />
                          </td>
                          <td className="px-2 py-1.5">
                            <select className="border border-blue-300 rounded px-2 py-1 text-xs" value={row.avroType} onChange={e => updateMapping(row.id, { avroType: e.target.value as AvroBaseType })}>
                              {AVRO_TYPES.filter(t => t !== 'null').map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select className="border border-blue-300 rounded px-2 py-1 text-xs" value={row.transformRule} onChange={e => updateMapping(row.id, { transformRule: e.target.value as TransformRule })}>
                              {(Object.entries(TRANSFORM_LABELS) as [TransformRule, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input className="w-full border border-blue-300 rounded px-2 py-1 text-xs" value={row.transformNote} onChange={e => updateMapping(row.id, { transformNote: e.target.value })} />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <input type="checkbox" checked={row.nullable} onChange={e => updateMapping(row.id, { nullable: e.target.checked })} className="rounded" />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <input type="checkbox" checked={row.isPii} onChange={e => updateMapping(row.id, { isPii: e.target.checked })} className="rounded" />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button onClick={() => setEditingId(null)} className="text-green-600 hover:text-green-700">
                              <Save className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.inboundField || <span className="text-slate-300 italic">—</span>}</td>
                          <td className="px-3 py-2">
                            <span className={`font-mono text-xs font-medium ${isOmitted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{row.outboundField || <span className="text-slate-300 italic">—</span>}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5 rounded font-mono">{row.avroType}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              row.transformRule === 'direct' ? 'bg-green-50 text-green-700' :
                              row.transformRule === 'omit' ? 'bg-slate-100 text-slate-400' :
                              row.transformRule === 'external-lookup' ? 'bg-blue-50 text-blue-700' :
                              row.transformRule === 'normalize-timestamp' || row.transformRule === 'utc-convert' ? 'bg-violet-50 text-violet-700' :
                              'bg-amber-50 text-amber-700'
                            }`}>
                              {TRANSFORM_LABELS[row.transformRule]}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-500 max-w-[180px] truncate">{row.transformNote}</td>
                          <td className="px-3 py-2 text-center">
                            {row.nullable ? <CheckCircle className="w-3.5 h-3.5 text-slate-300 mx-auto" /> : <X className="w-3.5 h-3.5 text-slate-400 mx-auto" />}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.isPii ? <span className="text-xs text-amber-600 font-bold">PII</span> : null}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditingId(row.id)} className="text-slate-400 hover:text-blue-600">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => deleteMapping(row.id)} className="text-slate-400 hover:text-red-500">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={addMapping} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 border border-dashed border-slate-300 rounded-lg px-3 py-2 hover:border-slate-400 transition-colors">
              <Plus className="w-4 h-4" />
              Add row
            </button>
            <div className="ml-auto flex items-center gap-3">
              <button onClick={() => setStep('input')} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2">
                Back
              </button>
              <button
                onClick={handleApprove}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Approve mapping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Export ── */}
      {step === 'approved' && (
        <div className="space-y-5">
          {successMsg && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              <CheckCircle className="w-4 h-4 shrink-0" />
              {successMsg}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Mapped fields', value: activeMappings.length, color: 'blue' },
              { label: 'PII fields', value: piiCount, color: 'amber' },
              { label: 'Omitted', value: omittedCount, color: 'slate' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`bg-${color}-50 border border-${color}-100 rounded-xl p-4 text-center`}>
                <p className={`text-2xl font-bold text-${color}-700`}>{value}</p>
                <p className={`text-xs text-${color}-500 mt-0.5`}>{label}</p>
              </div>
            ))}
          </div>

          {/* Downloads */}
          <div className="grid grid-cols-3 gap-4">
            <div className="border border-amber-200 rounded-xl p-5 bg-amber-50/20">
              <div className="flex items-start gap-3 mb-3">
                <div className="bg-amber-100 p-2 rounded-lg">
                  <Key className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{outboundTopicName || 'outbound'}-key.avsc</p>
                  <p className="text-xs text-slate-500 mt-0.5">Avro key schema — Confluent key subject</p>
                </div>
              </div>
              <pre className="bg-slate-900 text-slate-100 text-xs rounded-lg p-3 overflow-auto max-h-40 font-mono">
                {buildKeyAvroSchema(outboundTopicName || 'outbound', namespace, keyFields)}
              </pre>
              <button onClick={handleDownloadKeyAvro} className="mt-3 flex items-center gap-2 w-full justify-center bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                <Download className="w-4 h-4" />
                Download key .avsc
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="bg-blue-50 p-2 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{outboundTopicName || 'outbound'}-value.avsc</p>
                  <p className="text-xs text-slate-500 mt-0.5">Avro value schema — drop into <code className="bg-slate-100 px-1 rounded">src/main/avro/</code></p>
                </div>
              </div>
              <pre className="bg-slate-900 text-slate-100 text-xs rounded-lg p-3 overflow-auto max-h-40 font-mono">
                {buildAvroSchema(outboundTopicName || 'outbound', namespace, mappings)}
              </pre>
              <button onClick={handleDownloadAvro} className="mt-3 flex items-center gap-2 w-full justify-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                <Download className="w-4 h-4" />
                Download value .avsc
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="bg-green-50 p-2 rounded-lg">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">DataSpec.csv</p>
                  <p className="text-xs text-slate-500 mt-0.5">Field mapping spec — design-time reference for the team</p>
                </div>
              </div>
              <pre className="bg-slate-900 text-slate-100 text-xs rounded-lg p-3 overflow-auto max-h-40 font-mono">
                {buildDataSpec(mappings)}
              </pre>
              <button onClick={handleDownloadDataSpec} className="mt-3 flex items-center gap-2 w-full justify-center bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                <Download className="w-4 h-4" />
                Download DataSpec.csv
              </button>
            </div>
          </div>

          {/* What's next */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800 mb-2">What to do next</p>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Add the <code className="bg-blue-100 px-1 rounded text-xs">.avsc</code> to <code className="bg-blue-100 px-1 rounded text-xs">src/main/avro/</code> and run <code className="bg-blue-100 px-1 rounded text-xs">mvn generate-sources</code> to generate model classes.</li>
              <li>Open the <strong>ICD &amp; Schema Builder</strong> tab, create a project, and paste these field names — the generator will wire the Avro into full mapping code.</li>
              <li>Review PII fields with your data governance team before publishing.</li>
              <li>Use the <code className="bg-blue-100 px-1 rounded text-xs">DataSpec.csv</code> as the design-time reference in your ICD document.</li>
            </ol>
          </div>

          {/* Push to GitHub */}
          <div className="border border-slate-200 rounded-xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-slate-100 p-2 rounded-lg">
                <Github className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Push to GitHub</p>
                <p className="text-xs text-slate-500 mt-0.5">Commit the <code className="bg-slate-100 px-1 rounded">.avsc</code> and DataSpec to a branch and optionally open a PR — GitHub Actions will validate on push.</p>
              </div>
            </div>

            {pushStatus === 'success' && pushResult ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  Files pushed successfully.
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a href={pushResult.branchUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors">
                    <GitBranch className="w-3.5 h-3.5" /> View branch
                  </a>
                  <a href={pushResult.actionsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> GitHub Actions
                  </a>
                  {pushResult.prUrl && (
                    <a href={pushResult.prUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> View PR
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">GitHub owner / org</label>
                    <input value={githubConfig.owner} onChange={e => setGithubConfig(c => ({ ...c, owner: e.target.value }))} placeholder="usps-eeb" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Repository</label>
                    <input value={githubConfig.repo} onChange={e => setGithubConfig(c => ({ ...c, repo: e.target.value }))} placeholder="eeb-kafka-schemas" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">New branch name</label>
                    <input value={githubConfig.branch} onChange={e => setGithubConfig(c => ({ ...c, branch: e.target.value }))} placeholder={`schema/${outboundTopicName || 'new-topic'}`} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Base branch</label>
                    <input value={githubConfig.baseBranch} onChange={e => setGithubConfig(c => ({ ...c, baseBranch: e.target.value }))} placeholder="main" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={githubConfig.openPr} onChange={e => setGithubConfig(c => ({ ...c, openPr: e.target.checked }))} className="rounded" />
                  Open a pull request after push
                </label>
                {pushError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {pushError}
                  </div>
                )}
                <button
                  onClick={handlePushToGithub}
                  disabled={!githubConfig.owner || !githubConfig.repo || !githubConfig.branch || pushStatus === 'pushing'}
                  className="flex items-center gap-2 w-full justify-center bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  <Github className="w-4 h-4" />
                  {pushStatus === 'pushing' ? 'Pushing…' : 'Push to GitHub'}
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button onClick={handleReset} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 transition-colors">
              <RefreshCw className="w-4 h-4" />
              Start a new mapping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
