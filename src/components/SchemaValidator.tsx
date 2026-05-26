import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  GitCompare, Play, Sparkles, AlertTriangle, CheckCircle2, Info,
  XCircle, ChevronDown, ChevronRight, Download, RefreshCw, Clock,
  ArrowRight, Layers, Search, Upload, FileText, FileCode, FileSpreadsheet,
  X, Table
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Topic {
  id: string;
  name: string;
  environment: string | null;
  cluster_name: string | null;
  latest_schema: any;
  description: string | null;
}

interface ValidationFinding {
  severity: 'info' | 'warning' | 'error';
  category: string;
  field_path: string;
  message: string;
  recommendation: string;
}

interface MappingCandidate {
  inbound_field: string;
  outbound_field: string;
  mapping_type: 'direct' | 'transform' | 'rename' | 'inferred' | 'unresolved';
  confidence: 'high' | 'medium' | 'low';
  transform_notes: string;
  ai_generated: boolean;
}

interface MappingRow {
  inbound_field: string;
  inbound_type: string;
  outbound_field: string;
  outbound_type: string;
  mapping_type: string;
  notes: string;
  confidence: string;
  ai_generated?: boolean;
}

interface ValidationSummary {
  total_findings: number;
  errors: number;
  warnings: number;
  info: number;
  direct_mappings: number;
  rename_candidates: number;
  unresolved: number;
  inbound_field_count: number;
  outbound_field_count: number;
  python_mapper?: string;
}

interface Session {
  id: string;
  created_at: string;
  project_name: string;
  status: string;
  summary: ValidationSummary | null;
  inbound_topic_id: string | null;
  outbound_topic_id: string | null;
}

type InputMode = 'topics' | 'manual';
type ActiveTab = 'findings' | 'mappings' | 'history';

const SEVERITY_CONFIG = {
  error: { color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: XCircle },
  warning: { color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle },
  info: { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: Info },
};

const MAPPING_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  direct: { color: 'bg-emerald-100 text-emerald-700', label: 'Direct' },
  rename: { color: 'bg-blue-100 text-blue-700', label: 'Rename' },
  transform: { color: 'bg-amber-100 text-amber-700', label: 'Transform' },
  inferred: { color: 'bg-slate-100 text-slate-700', label: 'Inferred' },
  unresolved: { color: 'bg-red-100 text-red-700', label: 'Unresolved' },
  'direct rename': { color: 'bg-cyan-100 text-cyan-700', label: 'Direct Rename' },
  'reshape + rename': { color: 'bg-orange-100 text-orange-700', label: 'Reshape + Rename' },
};

const CONFIDENCE_CONFIG: Record<string, string> = {
  high: 'text-emerald-600 font-semibold',
  medium: 'text-amber-600 font-medium',
  low: 'text-slate-500',
};

const MAPPING_TYPE_COLORS: Record<string, string> = {
  direct: 'FF6BCB76',
  rename: 'FF4DA6FF',
  'direct rename': 'FF4DA6FF',
  transform: 'FFFFA500',
  'reshape + rename': 'FFFF8C00',
  inferred: 'FFB0B0B0',
  derived: 'FFB0B0B0',
  'system-generated': 'FF9E9E9E',
  conditional: 'FFFFCC00',
  unresolved: 'FFFF4444',
};

function SchemaValidator() {
  const { userProfile } = useAuth();
  const [inputMode, setInputMode] = useState<InputMode>('topics');
  const [activeTab, setActiveTab] = useState<ActiveTab>('findings');

  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [inboundTopicId, setInboundTopicId] = useState('');
  const [outboundTopicId, setOutboundTopicId] = useState('');
  const [topicSearch, setTopicSearch] = useState({ inbound: '', outbound: '' });

  const [projectName, setProjectName] = useState('');
  const [inboundSchema, setInboundSchema] = useState('');
  const [outboundSchema, setOutboundSchema] = useState('');
  const [inboundIcd, setInboundIcd] = useState('');
  const [outboundIcd, setOutboundIcd] = useState('');
  const [schemaTypes, setSchemaTypes] = useState<{ inbound: string; outbound: string }>({ inbound: '', outbound: '' });

  // Uploaded file names for display
  const [uploadedFiles, setUploadedFiles] = useState({
    inboundIcd: '',
    outboundIcd: '',
    inboundSchema: '',
    outboundSchema: '',
  });

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [findings, setFindings] = useState<ValidationFinding[]>([]);
  const [mappings, setMappings] = useState<MappingCandidate[]>([]);
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [pythonScript, setPythonScript] = useState('');
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  const [validating, setValidating] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState({ inbound: '', outbound: '' });
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState('all');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  useEffect(() => { fetchTopics(); fetchSessions(); }, []);

  const fetchTopics = async () => {
    setTopicsLoading(true);
    const { data } = await supabase
      .from('topics')
      .select('id, name, environment, cluster_name, latest_schema, description')
      .order('name');
    setTopics(data || []);
    setTopicsLoading(false);
  };

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('validation_sessions')
      .select('id, created_at, project_name, status, summary, inbound_topic_id, outbound_topic_id')
      .order('created_at', { ascending: false })
      .limit(20);
    setSessions(data || []);
  };

  const validateJsonSchema = (value: string, side: 'inbound' | 'outbound') => {
    if (!value.trim()) { setSchemaError(prev => ({ ...prev, [side]: '' })); return null; }
    try {
      const parsed = JSON.parse(value);
      setSchemaError(prev => ({ ...prev, [side]: '' }));
      setSchemaTypes(prev => ({ ...prev, [side]: detectSchemaType(parsed) }));
      return parsed;
    } catch {
      setSchemaError(prev => ({ ...prev, [side]: 'Invalid JSON — check brackets, quotes, and commas' }));
      return null;
    }
  };

  // ── File upload handlers ──────────────────────────────────────────────

  const handleFileUpload = async (
    file: File,
    target: 'inboundIcd' | 'outboundIcd' | 'inboundSchema' | 'outboundSchema'
  ) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    setUploadedFiles(prev => ({ ...prev, [target]: file.name }));

    try {
      if (ext === 'json') {
        const text = await file.text();
        if (target === 'inboundSchema') { setInboundSchema(text); validateJsonSchema(text, 'inbound'); }
        else if (target === 'outboundSchema') { setOutboundSchema(text); validateJsonSchema(text, 'outbound'); }
        else if (target === 'inboundIcd') setInboundIcd(text);
        else setOutboundIcd(text);
      } else if (['txt', 'md'].includes(ext)) {
        const text = await file.text();
        if (target === 'inboundIcd') setInboundIcd(text);
        else if (target === 'outboundIcd') setOutboundIcd(text);
        else if (target === 'inboundSchema') { setInboundSchema(text); validateJsonSchema(text, 'inbound'); }
        else setOutboundSchema(text);
      } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const text = XLSX.utils.sheet_to_csv(ws);
        if (target === 'inboundIcd') setInboundIcd(text);
        else setOutboundIcd(text);
      } else if (['docx', 'doc'].includes(ext)) {
        // For Word docs: extract raw XML text (basic approach without mammoth)
        // Read as binary and extract readable text
        const buf = await file.arrayBuffer();
        const arr = new Uint8Array(buf);
        // Try to extract text from the binary content (look for readable strings)
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const raw = decoder.decode(arr);
        // Extract visible text between XML tags or readable segments
        const textContent = raw
          .replace(/<[^>]+>/g, ' ')
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .replace(/\s{3,}/g, '\n')
          .trim();
        if (target === 'inboundIcd') setInboundIcd(textContent || `[Uploaded: ${file.name} — paste text content manually for best results]`);
        else setOutboundIcd(textContent || `[Uploaded: ${file.name} — paste text content manually for best results]`);
      } else {
        // Fallback: try reading as text
        const text = await file.text();
        if (target === 'inboundIcd') setInboundIcd(text);
        else if (target === 'outboundIcd') setOutboundIcd(text);
      }
    } catch (err) {
      console.error('File read error:', err);
      setError(`Could not read ${file.name}. Try copying and pasting the content instead.`);
    }
  };

  const getInputSchemas = () => {
    if (inputMode === 'topics') {
      const ib = topics.find(t => t.id === inboundTopicId);
      const ob = topics.find(t => t.id === outboundTopicId);
      if (ib?.latest_schema || ob?.latest_schema) {
        setSchemaTypes({
          inbound: ib?.latest_schema ? detectSchemaType(ib.latest_schema) : '',
          outbound: ob?.latest_schema ? detectSchemaType(ob.latest_schema) : '',
        });
      }
      return {
        inboundParsed: ib?.latest_schema || null,
        outboundParsed: ob?.latest_schema || null,
        name: ib && ob ? `${ib.name} → ${ob.name}` : (ib?.name || ob?.name || 'Schema Validation'),
      };
    }
    return {
      inboundParsed: inboundSchema ? validateJsonSchema(inboundSchema, 'inbound') : null,
      outboundParsed: outboundSchema ? validateJsonSchema(outboundSchema, 'outbound') : null,
      name: projectName || 'Schema Validation',
    };
  };

  const handleValidate = async () => {
    const { inboundParsed, outboundParsed, name } = getInputSchemas();
    if (!inboundParsed && !outboundParsed && !inboundIcd && !outboundIcd) {
      setError('Please provide at least one schema or ICD document.');
      return;
    }
    if (schemaError.inbound || schemaError.outbound) {
      setError('Fix schema JSON errors before validating.');
      return;
    }

    setValidating(true);
    setError(null);
    setFindings([]);
    setMappings([]);
    setMappingRows([]);
    setSummary(null);
    setPythonScript('');
    setSessionId(null);

    try {
      const { data: session, error: sessionErr } = await supabase
        .from('validation_sessions')
        .insert([{
          project_name: projectName || name,
          inbound_topic_id: inputMode === 'topics' ? inboundTopicId || null : null,
          outbound_topic_id: inputMode === 'topics' ? outboundTopicId || null : null,
          inbound_icd_text: inboundIcd,
          outbound_icd_text: outboundIcd,
          inbound_schema: inboundParsed,
          outbound_schema: outboundParsed,
          status: 'pending',
          created_by: userProfile?.email || '',
        }])
        .select()
        .single();

      if (sessionErr) throw new Error(sessionErr.message);
      setSessionId(session.id);

      const res = await fetch(`${supabaseUrl}/functions/v1/validate-schema`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({
          session_id: session.id,
          inbound_schema: inboundParsed,
          outbound_schema: outboundParsed,
          inbound_icd_text: inboundIcd,
          outbound_icd_text: outboundIcd,
        }),
      });

      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Validation failed'); }
      const result = await res.json();
      setFindings(result.findings || []);
      setMappings(result.mappings || []);
      setSummary(result.summary || null);
      setActiveTab('findings');
      fetchSessions();
    } catch (err: any) {
      setError(err.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleGenerateAiMapping = async () => {
    if (!sessionId) return;
    setGeneratingAi(true);
    setError(null);

    try {
      const { inboundParsed, outboundParsed } = getInputSchemas();
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({
          session_id: sessionId,
          inbound_schema: inboundParsed,
          outbound_schema: outboundParsed,
          inbound_icd_text: inboundIcd,
          outbound_icd_text: outboundIcd,
          existing_findings: findings,
          existing_mappings: mappings,
        }),
      });

      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'AI mapping failed'); }
      const result = await res.json();

      if (result.ai_mappings?.length) setMappings(prev => [...prev, ...result.ai_mappings]);
      if (result.mapping_rows?.length) setMappingRows(result.mapping_rows);
      if (result.python_script) setPythonScript(result.python_script);
      if (result.open_questions?.length) {
        setFindings(prev => [...prev, ...result.open_questions.map((q: string) => ({
          severity: 'info' as const,
          category: 'open_question',
          field_path: '',
          message: q,
          recommendation: 'Clarify with data owner before finalizing schema',
        }))]);
      }
      setActiveTab('mappings');
    } catch (err: any) {
      setError(err.message || 'AI mapping failed');
    } finally {
      setGeneratingAi(false);
    }
  };

  const loadSession = async (s: Session) => {
    const { data: f } = await supabase.from('validation_findings').select('*').eq('session_id', s.id);
    const { data: m } = await supabase.from('mapping_candidates').select('*').eq('session_id', s.id);
    setFindings(f || []);
    setMappings(m || []);
    setSummary(s.summary);
    setSessionId(s.id);
    if (s.summary?.python_mapper) setPythonScript(s.summary.python_mapper);
    setProjectName(s.project_name);
    setActiveTab('findings');
  };

  // ── Export functions ──────────────────────────────────────────────────

  const exportExcel = () => {
    const { inboundParsed, outboundParsed } = getInputSchemas();
    const name = projectName || 'Mapping';

    // Build rows — prefer AI mapping_rows if available, else derive from mappings
    const rows: MappingRow[] = mappingRows.length > 0 ? mappingRows : deriveMappingRowsFromCandidates(mappings, inboundParsed, outboundParsed);

    const wsData = [
      ['Inbound Field', 'Inbound Type', 'Outbound Field', 'Outbound Type', 'Mapping Type', 'Notes', 'Confidence'],
      ...rows.map(r => [
        r.inbound_field || '',
        r.inbound_type || '',
        r.outbound_field || '',
        r.outbound_type || '',
        r.mapping_type || '',
        r.notes || '',
        r.confidence || '',
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws['!cols'] = [
      { wch: 35 }, { wch: 20 }, { wch: 35 }, { wch: 20 },
      { wch: 20 }, { wch: 55 }, { wch: 12 },
    ];

    // Style header row
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFFFF' } },
      fill: { fgColor: { rgb: 'FF1E3A5F' } },
      alignment: { horizontal: 'center' },
      border: {
        bottom: { style: 'medium', color: { rgb: 'FF000000' } },
      },
    };
    ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1'].forEach(cell => {
      if (ws[cell]) ws[cell].s = headerStyle;
    });

    // Color rows by mapping type
    rows.forEach((row, i) => {
      const rowNum = i + 2;
      const typeKey = (row.mapping_type || '').toLowerCase();
      const fillColor = MAPPING_TYPE_COLORS[typeKey] || 'FFFFFFFF';
      const lightFill = lightenColor(fillColor);
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
        const cell = `${col}${rowNum}`;
        if (!ws[cell]) ws[cell] = { v: '', t: 's' };
        ws[cell].s = {
          fill: { fgColor: { rgb: lightFill } },
          border: {
            bottom: { style: 'thin', color: { rgb: 'FFD0D0D0' } },
            right: { style: 'thin', color: { rgb: 'FFD0D0D0' } },
          },
          alignment: { wrapText: true, vertical: 'top' },
        };
      });
    });

    // Freeze header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, ws, 'Field Mapping');

    // Add findings sheet if we have them
    if (findings.length > 0) {
      const findingsData = [
        ['Severity', 'Category', 'Field Path', 'Message', 'Recommendation'],
        ...findings.map(f => [f.severity, f.category.replace(/_/g, ' '), f.field_path, f.message, f.recommendation]),
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(findingsData);
      ws2['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 35 }, { wch: 60 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Validation Findings');
    }

    XLSX.writeFile(wb, `${name.replace(/[^a-z0-9]/gi, '_')}_mapping.xlsx`);
  };

  const exportMarkdown = () => {
    const name = projectName || 'Unnamed';
    const rows = mappingRows.length > 0 ? mappingRows : deriveMappingRowsFromCandidates(mappings, null, null);
    const lines = [
      `# Schema Mapping: ${name}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      '## Summary',
      `- Errors: ${summary?.errors ?? 0} | Warnings: ${summary?.warnings ?? 0} | Info: ${summary?.info ?? 0}`,
      `- Direct: ${summary?.direct_mappings ?? 0} | Renames: ${summary?.rename_candidates ?? 0}`,
      '',
      '## Field Mapping',
      '| Inbound Field | Inbound Type | Outbound Field | Outbound Type | Mapping Type | Notes |',
      '|---|---|---|---|---|---|',
      ...rows.map(r => `| ${r.inbound_field || '—'} | ${r.inbound_type || '—'} | ${r.outbound_field || '—'} | ${r.outbound_type || '—'} | ${r.mapping_type} | ${r.notes} |`),
      '',
      '## Open Questions',
      ...findings.filter(f => f.category === 'open_question').map(f => `- ${f.message}`),
    ];
    download(lines.join('\n'), `${name.replace(/[^a-z0-9]/gi, '_')}_mapping.md`, 'text/markdown');
  };

  const exportPython = () => {
    if (!pythonScript) return;
    const name = projectName || 'mapper';
    download(pythonScript, `${name.replace(/[^a-z0-9]/gi, '_')}_mapper.py`, 'text/plain');
  };

  const filteredFindings = categoryFilter === 'all'
    ? findings
    : findings.filter(f => f.severity === categoryFilter || f.category === categoryFilter);

  const inboundTopic = topics.find(t => t.id === inboundTopicId);
  const outboundTopic = topics.find(t => t.id === outboundTopicId);
  const filteredTopics = (side: 'inbound' | 'outbound') => {
    const q = topicSearch[side].toLowerCase();
    return !q ? topics : topics.filter(t =>
      t.name.toLowerCase().includes(q) || (t.cluster_name || '').toLowerCase().includes(q)
    );
  };

  const hasResults = findings.length > 0 || mappings.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 p-2 rounded-lg">
              <GitCompare className="w-6 h-6 text-white" />
            </div>
            Schema Validator
          </h2>
          <p className="text-slate-500 mt-1 text-sm">
            Validate inbound/outbound Avro schemas, upload ICD documents, and generate mapping drafts
          </p>
        </div>

        {hasResults && (
          <div className="flex items-center gap-2">
            <button onClick={exportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </button>
            <button onClick={exportMarkdown}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors">
              <FileText className="w-4 h-4" /> Markdown
            </button>
            {pythonScript && (
              <button onClick={exportPython}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                <FileCode className="w-4 h-4" /> Python Script
              </button>
            )}
          </div>
        )}
      </div>

      {/* Input Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {/* Mode tabs */}
        <div className="flex border-b border-slate-200">
          <button onClick={() => setInputMode('topics')}
            className={`flex-1 py-3 text-sm font-medium transition-colors rounded-tl-xl flex items-center justify-center gap-2 ${
              inputMode === 'topics' ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-500' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}>
            <Layers className="w-4 h-4" /> Select from Topics
          </button>
          <button onClick={() => setInputMode('manual')}
            className={`flex-1 py-3 text-sm font-medium transition-colors rounded-tr-xl flex items-center justify-center gap-2 ${
              inputMode === 'manual' ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-500' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}>
            <GitCompare className="w-4 h-4" /> Paste / Upload Schemas
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Project / Ingestion Name <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. FAST Redirect Inbound → Outbound"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>

          {inputMode === 'topics' ? (
            <TopicSelector
              topics={topics} loading={topicsLoading}
              inboundTopicId={inboundTopicId} outboundTopicId={outboundTopicId}
              topicSearch={topicSearch}
              onInboundChange={setInboundTopicId} onOutboundChange={setOutboundTopicId}
              onSearchChange={(side: string, val: string) => setTopicSearch(prev => ({ ...prev, [side]: val }))}
              filteredTopics={filteredTopics}
              inboundTopic={inboundTopic} outboundTopic={outboundTopic}
            />
          ) : (
            <ManualInput
              inboundSchema={inboundSchema} outboundSchema={outboundSchema}
              schemaError={schemaError}
              uploadedFiles={uploadedFiles}
              schemaTypes={schemaTypes}
              onInboundChange={v => { setInboundSchema(v); validateJsonSchema(v, 'inbound'); }}
              onOutboundChange={v => { setOutboundSchema(v); validateJsonSchema(v, 'outbound'); }}
              onFileUpload={handleFileUpload}
            />
          )}

          {/* ICD Upload section — always visible */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              ICD Documents
              <span className="text-xs font-normal text-slate-400">— upload Word, PDF, TXT, or paste text (improves AI mapping accuracy)</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <IcdUploadArea
                side="inbound" label="Inbound ICD"
                value={inboundIcd} fileName={uploadedFiles.inboundIcd}
                onChange={setInboundIcd}
                onFile={f => handleFileUpload(f, 'inboundIcd')}
                onClear={() => { setInboundIcd(''); setUploadedFiles(prev => ({ ...prev, inboundIcd: '' })); }}
              />
              <IcdUploadArea
                side="outbound" label="Outbound ICD"
                value={outboundIcd} fileName={uploadedFiles.outboundIcd}
                onChange={setOutboundIcd}
                onFile={f => handleFileUpload(f, 'outboundIcd')}
                onClear={() => { setOutboundIcd(''); setUploadedFiles(prev => ({ ...prev, outboundIcd: '' })); }}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <XCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleValidate} disabled={validating}
              className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
              {validating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Validating...</> : <><Play className="w-4 h-4" /> Run Validation</>}
            </button>
            {sessionId && !generatingAi && (
              <button onClick={handleGenerateAiMapping}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
                <Sparkles className="w-4 h-4" /> Generate AI Mapping
              </button>
            )}
            {generatingAi && (
              <span className="flex items-center gap-2 text-sm text-amber-600 font-medium">
                <RefreshCw className="w-4 h-4 animate-spin" /> Casey is analyzing...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <SummaryCard label="Errors" value={summary.errors} color="text-red-600" bg="bg-red-50" />
          <SummaryCard label="Warnings" value={summary.warnings} color="text-amber-600" bg="bg-amber-50" />
          <SummaryCard label="Info" value={summary.info} color="text-blue-600" bg="bg-blue-50" />
          <SummaryCard label="Direct Maps" value={summary.direct_mappings} color="text-emerald-600" bg="bg-emerald-50" />
          <SummaryCard label="Renames" value={summary.rename_candidates} color="text-teal-600" bg="bg-teal-50" />
          <SummaryCard label="Inbound" value={summary.inbound_field_count} color="text-slate-600" bg="bg-slate-50" />
          <SummaryCard label="Outbound" value={summary.outbound_field_count} color="text-slate-600" bg="bg-slate-50" />
        </div>
      )}

      {/* Results */}
      {(hasResults || sessions.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex border-b border-slate-200">
            {([
              { id: 'findings' as ActiveTab, label: `Findings (${findings.length})` },
              { id: 'mappings' as ActiveTab, label: `Mappings (${mappings.length})` },
              { id: 'history' as ActiveTab, label: `History (${sessions.length})` },
            ] as const).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id ? 'text-teal-700 border-b-2 border-teal-500 bg-teal-50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="p-6">
            {activeTab === 'findings' && (
              <FindingsPanel
                findings={filteredFindings} allFindings={findings}
                categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
                expandedFindings={expandedFindings} setExpandedFindings={setExpandedFindings}
              />
            )}
            {activeTab === 'mappings' && (
              <MappingsPanel
                mappings={mappings} mappingRows={mappingRows}
                onExcelExport={exportExcel} onPythonExport={exportPython}
                pythonScript={pythonScript}
              />
            )}
            {activeTab === 'history' && <HistoryPanel sessions={sessions} onLoad={loadSession} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ICD Upload Area ────────────────────────────────────────────────────────────

function IcdUploadArea({ label, value, fileName, onChange, onFile, onClear }: {
  side: string; label: string; value: string; fileName: string;
  onChange: (v: string) => void; onFile: (f: File) => void; onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        {(value || fileName) && (
          <button onClick={onClear} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Drop zone / upload button */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => ref.current?.click()}
        className={`flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          dragging ? 'border-teal-400 bg-teal-50' : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50'
        }`}
      >
        <Upload className="w-4 h-4 text-slate-400 shrink-0" />
        <div className="min-w-0">
          {fileName ? (
            <p className="text-sm text-teal-700 font-medium truncate">{fileName}</p>
          ) : (
            <p className="text-sm text-slate-400">Drop file or click to upload</p>
          )}
          <p className="text-xs text-slate-400 mt-0.5">Word (.docx), TXT, PDF, Excel, JSON</p>
        </div>
        <input ref={ref} type="file" className="hidden"
          accept=".docx,.doc,.txt,.md,.pdf,.xlsx,.xls,.csv,.json"
          onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); }} />
      </div>

      {/* Text fallback */}
      <textarea
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={`Or paste ${label.toLowerCase()} text here...`}
        rows={4}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
      />
      {value && (
        <p className="text-xs text-slate-400">{value.length.toLocaleString()} characters loaded</p>
      )}
    </div>
  );
}

// ── Topic Selector ─────────────────────────────────────────────────────────────

function TopicSelector({ topics, loading, inboundTopicId, outboundTopicId, topicSearch, onInboundChange, onOutboundChange, onSearchChange, filteredTopics, inboundTopic, outboundTopic }: any) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {(['inbound', 'outbound'] as const).map(side => {
        const selectedId = side === 'inbound' ? inboundTopicId : outboundTopicId;
        const selectedTopic = side === 'inbound' ? inboundTopic : outboundTopic;
        const onChange = side === 'inbound' ? onInboundChange : onOutboundChange;
        const list = filteredTopics(side);
        return (
          <div key={side}>
            <label className="block text-sm font-medium text-slate-700 mb-2 capitalize">{side} Topic</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={topicSearch[side]} onChange={e => onSearchChange(side, e.target.value)}
                placeholder="Search topics..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <select value={selectedId} onChange={e => onChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" size={5}>
              <option value="">— None selected —</option>
              {loading ? <option disabled>Loading...</option> : list.map((t: Topic) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.environment ? `[${t.environment}]` : ''} {t.cluster_name ? `· ${t.cluster_name}` : ''}
                </option>
              ))}
            </select>
            {selectedTopic && (
              <div className="mt-2 p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-teal-800 truncate">{selectedTopic.name}</p>
                  {selectedTopic.latest_schema && (
                    <SchemaTypeBadge type={detectSchemaType(selectedTopic.latest_schema)} />
                  )}
                </div>
                {selectedTopic.description && <p className="text-teal-600 mt-0.5 line-clamp-2">{selectedTopic.description}</p>}
                <p className="text-teal-500 mt-1">Schema: {selectedTopic.latest_schema ? 'Available' : 'Not synced'}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Manual Input ───────────────────────────────────────────────────────────────

function ManualInput({ inboundSchema, outboundSchema, schemaError, uploadedFiles, schemaTypes, onInboundChange, onOutboundChange, onFileUpload }: any) {
  const ibRef = useRef<HTMLInputElement>(null);
  const obRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid grid-cols-2 gap-4">
      {([
        { side: 'inbound', label: 'Inbound Schema', value: inboundSchema, onChange: onInboundChange, errKey: 'inbound', ref: ibRef, fileTarget: 'inboundSchema' },
        { side: 'outbound', label: 'Outbound Schema', value: outboundSchema, onChange: onOutboundChange, errKey: 'outbound', ref: obRef, fileTarget: 'outboundSchema' },
      ] as const).map(({ side, label, value, onChange, errKey, ref, fileTarget }) => {
        const detectedType = schemaTypes?.[side];
        return (
          <div key={side}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">{label}</label>
                {detectedType && detectedType !== 'unknown' && (
                  <SchemaTypeBadge type={detectedType} />
                )}
              </div>
              <button onClick={() => (ref as any).current?.click()}
                className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 transition-colors">
                <Upload className="w-3 h-3" /> Upload
              </button>
            </div>
            <input ref={ref as any} type="file" className="hidden" accept=".json,.avsc,.txt"
              onChange={e => { if (e.target.files?.[0]) onFileUpload(e.target.files[0], fileTarget); }} />
            {uploadedFiles[fileTarget] && (
              <p className="text-xs text-teal-600 mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3" />{uploadedFiles[fileTarget]}
              </p>
            )}
            <textarea value={value} onChange={e => onChange(e.target.value)}
              placeholder={'{\n  "type": "record",\n  "name": "Event",\n  "fields": [...]\n}'}
              rows={14}
              className={`w-full px-3 py-2 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y ${
                schemaError[errKey] ? 'border-red-400 bg-red-50' : 'border-slate-200'
              }`} />
            {schemaError[errKey] && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <XCircle className="w-3 h-3" />{schemaError[errKey]}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SchemaTypeBadge({ type }: { type: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    'avro': { label: 'Avro', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    'json-schema': { label: 'JSON Schema', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  };
  const c = cfg[type] || { label: type, color: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${c.color}`}>
      {c.label}
    </span>
  );
}

// ── Summary Card ───────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`${bg} rounded-xl p-4 text-center`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1 font-medium">{label}</p>
    </div>
  );
}

// ── Findings Panel ─────────────────────────────────────────────────────────────

function FindingsPanel({ findings, allFindings, categoryFilter, setCategoryFilter, expandedFindings, setExpandedFindings }: any) {
  const categories = ['all', 'error', 'warning', 'info', 'missing_field', 'type_mismatch', 'rename_candidate', 'duplicate_type', 'unmapped_field', 'open_question'];
  const available = categories.filter(c => c === 'all' || allFindings.some((f: ValidationFinding) => f.severity === c || f.category === c));

  if (allFindings.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
        <p className="font-medium text-slate-600">No findings yet</p>
        <p className="text-sm mt-1">Run a validation to see results</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {available.map(c => (
          <button key={c} onClick={() => setCategoryFilter(c)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
              categoryFilter === c ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {c.replace(/_/g, ' ')}
            {c !== 'all' && (
              <span className="ml-1 opacity-70">
                ({allFindings.filter((f: ValidationFinding) => f.severity === c || f.category === c).length})
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {findings.map((f: ValidationFinding, i: number) => {
          const cfg = SEVERITY_CONFIG[f.severity];
          const Icon = cfg.icon;
          const expanded = expandedFindings.has(i);
          return (
            <div key={i} className={`border rounded-lg overflow-hidden ${cfg.bg}`}>
              <button className="w-full flex items-start gap-3 p-3 text-left hover:brightness-95 transition-all"
                onClick={() => setExpandedFindings((prev: Set<number>) => {
                  const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next;
                })}>
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold uppercase ${cfg.color}`}>{f.severity}</span>
                    <span className="text-xs bg-white/60 px-2 py-0.5 rounded-full text-slate-600 font-medium capitalize">
                      {f.category.replace(/_/g, ' ')}
                    </span>
                    {f.field_path && <code className="text-xs bg-white/60 px-2 py-0.5 rounded font-mono text-slate-700">{f.field_path}</code>}
                  </div>
                  <p className="text-sm text-slate-800 mt-1 font-medium">{f.message}</p>
                </div>
                {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />}
              </button>
              {expanded && f.recommendation && (
                <div className="px-10 pb-3">
                  <p className="text-xs text-slate-600 bg-white/60 rounded-lg p-2.5 border border-white/80">
                    <span className="font-semibold">Recommendation: </span>{f.recommendation}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {findings.length === 0 && allFindings.length > 0 && (
        <p className="text-center text-slate-400 text-sm py-4">No findings match this filter.</p>
      )}
    </div>
  );
}

// ── Mappings Panel ─────────────────────────────────────────────────────────────

function MappingsPanel({ mappings, mappingRows, onExcelExport, onPythonExport, pythonScript }: {
  mappings: MappingCandidate[]; mappingRows: MappingRow[];
  onExcelExport: () => void; onPythonExport: () => void; pythonScript: string;
}) {
  const [typeFilter, setTypeFilter] = useState('all');
  const [showPython, setShowPython] = useState(false);

  // Prefer structured mapping rows from AI; fall back to candidates
  const rows: MappingRow[] = mappingRows.length > 0 ? mappingRows : mappings.map(m => ({
    inbound_field: m.inbound_field,
    inbound_type: '',
    outbound_field: m.outbound_field,
    outbound_type: '',
    mapping_type: m.mapping_type,
    notes: m.transform_notes,
    confidence: m.confidence,
    ai_generated: m.ai_generated,
  }));

  const filtered = typeFilter === 'all' ? rows : rows.filter(r =>
    (r.mapping_type || '').toLowerCase().includes(typeFilter)
  );

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Table className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium text-slate-600">No mappings yet</p>
        <p className="text-sm mt-1">Run validation first, then click "Generate AI Mapping" for full mapping table</p>
      </div>
    );
  }

  const typeKeys = [...new Set(rows.map(r => (r.mapping_type || '').toLowerCase()))].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setTypeFilter('all')}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${typeFilter === 'all' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            All ({rows.length})
          </button>
          {typeKeys.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 text-xs rounded-full font-medium capitalize transition-colors ${
                typeFilter === t ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {t} ({rows.filter(r => (r.mapping_type || '').toLowerCase().includes(t)).length})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onExcelExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
          {pythonScript && (
            <button onClick={() => setShowPython(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors">
              <FileCode className="w-3.5 h-3.5" /> {showPython ? 'Hide' : 'View'} Python
            </button>
          )}
          {pythonScript && (
            <button onClick={onPythonExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-colors">
              <Download className="w-3.5 h-3.5" /> Download .py
            </button>
          )}
        </div>
      </div>

      {showPython && pythonScript && (
        <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400 font-mono">mapper_draft.py — review all TODOs before production use</p>
            <button onClick={onPythonExport}
              className="flex items-center gap-1 text-xs text-slate-300 hover:text-white transition-colors">
              <Download className="w-3 h-3" /> download
            </button>
          </div>
          <pre className="text-xs text-emerald-300 font-mono whitespace-pre leading-relaxed overflow-x-auto">
            {pythonScript}
          </pre>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Inbound Field</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Inbound Type</th>
              <th className="text-center px-2 py-3 w-6"></th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Outbound Field</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Outbound Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Mapping Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((row, i) => {
              const typeKey = (row.mapping_type || '').toLowerCase();
              const typeCfg = MAPPING_TYPE_CONFIG[typeKey] || MAPPING_TYPE_CONFIG['inferred'];
              const rowBg = getRowBgClass(typeKey);
              return (
                <tr key={i} className={`${rowBg} hover:brightness-95 transition-all`}>
                  <td className="px-4 py-2.5">
                    {row.inbound_field ? (
                      <code className="text-xs bg-white/70 px-1.5 py-0.5 rounded font-mono text-slate-800">{row.inbound_field}</code>
                    ) : (
                      <span className="text-xs text-slate-400 italic">n/a</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-slate-600 font-mono">{row.inbound_type || '—'}</span>
                  </td>
                  <td className="px-2 py-2.5 text-slate-300">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </td>
                  <td className="px-4 py-2.5">
                    {row.outbound_field ? (
                      <code className="text-xs bg-white/70 px-1.5 py-0.5 rounded font-mono text-slate-800">{row.outbound_field}</code>
                    ) : (
                      <span className="text-xs text-slate-400 italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-slate-600 font-mono">{row.outbound_type || '—'}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${typeCfg.color}`}>
                      {row.mapping_type || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600 max-w-xs">
                    {row.notes || <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Showing {filtered.length} of {rows.length} mappings
        {rows.some(r => r.ai_generated) && (
          <span className="ml-2 text-amber-500 flex items-center gap-1 inline-flex">
            <Sparkles className="w-3 h-3" /> includes AI-generated rows
          </span>
        )}
      </p>
    </div>
  );
}

// ── History Panel ──────────────────────────────────────────────────────────────

function HistoryPanel({ sessions, onLoad }: { sessions: Session[]; onLoad: (s: Session) => void }) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium text-slate-600">No history yet</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {sessions.map(s => (
        <button key={s.id} onClick={() => onLoad(s)}
          className="w-full text-left p-4 border border-slate-200 rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-all group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                s.status === 'complete' ? 'bg-emerald-500' : s.status === 'failed' ? 'bg-red-500' :
                s.status === 'running' ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'
              }`} />
              <div>
                <p className="font-medium text-slate-800 group-hover:text-teal-700 text-sm">{s.project_name || 'Unnamed Session'}</p>
                <p className="text-xs text-slate-400 mt-0.5">{new Date(s.created_at).toLocaleString()}</p>
              </div>
            </div>
            {s.summary && (
              <div className="flex items-center gap-3 text-xs">
                {s.summary.errors > 0 && <span className="flex items-center gap-1 text-red-600 font-semibold"><XCircle className="w-3.5 h-3.5" />{s.summary.errors}</span>}
                {s.summary.warnings > 0 && <span className="flex items-center gap-1 text-amber-600 font-semibold"><AlertTriangle className="w-3.5 h-3.5" />{s.summary.warnings}</span>}
                <span className="flex items-center gap-1 text-emerald-600 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" />{s.summary.direct_mappings} mapped</span>
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getRowBgClass(type: string): string {
  if (type.includes('unresolved')) return 'bg-red-50';
  if (type.includes('transform') || type.includes('reshape')) return 'bg-amber-50';
  if (type.includes('rename')) return 'bg-blue-50';
  if (type.includes('direct')) return 'bg-emerald-50';
  if (type.includes('derived') || type.includes('system') || type.includes('inferred')) return 'bg-slate-50';
  return '';
}

function lightenColor(hex: string): string {
  // hex is AARRGGBB — lighten the RGB by mixing with white at ~85%
  const r = parseInt(hex.slice(2, 4), 16);
  const g = parseInt(hex.slice(4, 6), 16);
  const b = parseInt(hex.slice(6, 8), 16);
  const lr = Math.round(r + (255 - r) * 0.78).toString(16).padStart(2, '0');
  const lg = Math.round(g + (255 - g) * 0.78).toString(16).padStart(2, '0');
  const lb = Math.round(b + (255 - b) * 0.78).toString(16).padStart(2, '0');
  return `FF${lr}${lg}${lb}`.toUpperCase();
}

function deriveMappingRowsFromCandidates(
  mappings: MappingCandidate[],
  _inboundSchema: any,
  _outboundSchema: any
): MappingRow[] {
  return mappings.map(m => ({
    inbound_field: m.inbound_field,
    inbound_type: '',
    outbound_field: m.outbound_field,
    outbound_type: '',
    mapping_type: m.mapping_type,
    notes: m.transform_notes,
    confidence: m.confidence,
    ai_generated: m.ai_generated,
  }));
}

function detectSchemaType(parsed: any): string {
  if (!parsed || typeof parsed !== 'object') return 'unknown';
  // Avro: top-level "type": "record" with "fields" array, or an array of Avro types
  if (parsed.type === 'record' && Array.isArray(parsed.fields)) return 'avro';
  if (Array.isArray(parsed) && parsed.some((s: any) => s?.type === 'record')) return 'avro';
  // JSON Schema: $schema keyword, or "properties" + "type": "object"
  if (parsed.$schema || parsed.$id) return 'json-schema';
  if (parsed.type === 'object' && parsed.properties) return 'json-schema';
  if (parsed.definitions || parsed.$defs) return 'json-schema';
  // Avro union (array of type strings/objects at root)
  if (Array.isArray(parsed) && parsed.every((s: any) => typeof s === 'string' || (typeof s === 'object' && s.type))) return 'avro';
  // Avro named types without explicit "record"
  if (parsed.fields && Array.isArray(parsed.fields)) return 'avro';
  return 'unknown';
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}


export default SchemaValidator