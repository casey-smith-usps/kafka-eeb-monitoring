import { useState, useEffect } from 'react';
import {
  FileCode, Plus, Trash2, Download, Save, ChevronDown, ChevronRight,
  CheckCircle, AlertCircle, X, ArrowRight, Database, FileSpreadsheet,
  Copy, RefreshCw, Info, Layers, Github, ExternalLink, Play, FileText,
  Terminal, GitBranch, Package
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  buildAllFiles, type GeneratedFile, type GeneratorInput,
  getChartName, getValuesName, getDeployBranchName,
  generateArgocdJson, generateChartYaml, generateValuesYaml,
} from '../utils/javaGenerators';

// ─── Types ────────────────────────────────────────────────────────────────────

type AvroBaseType = 'string' | 'int' | 'long' | 'float' | 'double' | 'boolean' | 'bytes' | 'null';

interface IcdField {
  id: string;
  fieldName: string;
  avroType: AvroBaseType;
  nullable: boolean;
  isPii: boolean;
  description: string;
  sourceField: string;   // inbound field this maps FROM (for outbound schemas)
  defaultValue: string;
  order: number;
}

interface OutboundSchema {
  id: string;
  topicName: string;
  description: string;
  fields: IcdField[];
  keyFields: IcdField[];
  collapsed: boolean;
}

interface IcdProject {
  id?: string;
  projectName: string;
  datasetName: string;
  basePackage: string;
  sourceTopic: string;
  inboundFields: IcdField[];
  inboundKeyFields: IcdField[];
  outboundSchemas: OutboundSchema[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newField(order: number): IcdField {
  return {
    id: crypto.randomUUID(),
    fieldName: '',
    avroType: 'string',
    nullable: true,
    isPii: false,
    description: '',
    sourceField: '',
    defaultValue: '',
    order,
  };
}

function newOutbound(): OutboundSchema {
  return {
    id: crypto.randomUUID(),
    topicName: '',
    description: '',
    fields: [newField(0)],
    keyFields: [newField(0)],
    collapsed: false,
  };
}

function toAvroFieldType(f: IcdField): any {
  if (f.nullable) {
    const def = f.defaultValue !== '' ? f.defaultValue : null;
    return {
      name: f.fieldName || 'unnamed',
      type: ['null', f.avroType],
      default: def,
      doc: f.description || undefined,
    };
  }
  return {
    name: f.fieldName || 'unnamed',
    type: f.avroType,
    doc: f.description || undefined,
  };
}

function buildAvsc(namespace: string, recordName: string, fields: IcdField[]): object {
  return {
    type: 'record',
    name: recordName,
    namespace,
    fields: fields
      .filter(f => f.fieldName.trim() !== '')
      .map(toAvroFieldType),
  };
}

function buildKeyAvsc(namespace: string, topicName: string): object {
  const name = topicName.replace(/[^a-zA-Z0-9]/g, '_') + '-key';
  return {
    type: 'record',
    name,
    namespace,
    fields: [
      { name: 'key', type: 'string', doc: 'Message key' },
    ],
  };
}

function downloadJson(obj: object, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildDataSpecCsv(
  project: IcdProject,
  outbound: OutboundSchema
): string {
  const rows: string[] = [
    'sourceField,sourceType,targetField,targetType,nullable,mappingType,transformNotes,isPii,description',
  ];

  const inboundMap = new Map(project.inboundFields.map(f => [f.fieldName, f]));

  for (const f of outbound.fields) {
    if (!f.fieldName.trim()) continue;
    const src = f.sourceField.trim();
    const inF = inboundMap.get(src);
    const mappingType = src ? (src === f.fieldName ? 'direct' : 'rename') : 'derived';
    rows.push(
      [
        src || '',
        inF ? inF.avroType : '',
        f.fieldName,
        f.avroType,
        f.nullable ? 'true' : 'false',
        mappingType,
        '',
        f.isPii ? 'true' : 'false',
        `"${f.description.replace(/"/g, '""')}"`,
      ].join(',')
    );
  }

  return rows.join('\n');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const AVRO_TYPES: AvroBaseType[] = ['string', 'int', 'long', 'float', 'double', 'boolean', 'bytes'];

function FieldRow({
  field,
  showSource,
  sourceOptions,
  onChange,
  onRemove,
}: {
  field: IcdField;
  showSource: boolean;
  sourceOptions: string[];
  onChange: (updated: IcdField) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<IcdField>) => onChange({ ...field, ...patch });

  return (
    <tr className="group hover:bg-slate-50 transition-colors">
      <td className="px-3 py-2">
        <input
          value={field.fieldName}
          onChange={e => set({ fieldName: e.target.value })}
          placeholder="fieldName"
          className="w-full text-sm border border-slate-200 rounded px-2 py-1 font-mono focus:ring-1 focus:ring-blue-400 focus:outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={field.avroType}
          onChange={e => set({ avroType: e.target.value as AvroBaseType })}
          className="text-sm border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-400 focus:outline-none"
        >
          {AVRO_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={field.nullable}
          onChange={e => set({ nullable: e.target.checked })}
          className="rounded text-blue-500"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={field.isPii}
          onChange={e => set({ isPii: e.target.checked })}
          className="rounded text-red-400"
        />
      </td>
      {showSource && (
        <td className="px-3 py-2">
          {sourceOptions.length > 0 ? (
            <select
              value={field.sourceField}
              onChange={e => set({ sourceField: e.target.value })}
              className="text-sm border border-slate-200 rounded px-2 py-1 w-full focus:ring-1 focus:ring-blue-400 focus:outline-none"
            >
              <option value="">(derived)</option>
              {sourceOptions.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input
              value={field.sourceField}
              onChange={e => set({ sourceField: e.target.value })}
              placeholder="inbound field"
              className="w-full text-sm border border-slate-200 rounded px-2 py-1 font-mono focus:ring-1 focus:ring-blue-400 focus:outline-none"
            />
          )}
        </td>
      )}
      <td className="px-3 py-2">
        <input
          value={field.description}
          onChange={e => set({ description: e.target.value })}
          placeholder="description"
          className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-400 focus:outline-none"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

function FieldTable({
  fields,
  showSource,
  sourceOptions,
  onUpdate,
  onAdd,
}: {
  fields: IcdField[];
  showSource: boolean;
  sourceOptions: string[];
  onUpdate: (fields: IcdField[]) => void;
  onAdd: () => void;
}) {
  const updateField = (id: string, updated: IcdField) =>
    onUpdate(fields.map(f => (f.id === id ? updated : f)));
  const removeField = (id: string) =>
    onUpdate(fields.filter(f => f.id !== id));

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 w-44">Field Name</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 w-28">Avro Type</th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 w-20">Nullable</th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 w-16">PII</th>
            {showSource && (
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 w-40">Source Field</th>
            )}
            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Description</th>
            <th className="px-3 py-2 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {fields.map(f => (
            <FieldRow
              key={f.id}
              field={f}
              showSource={showSource}
              sourceOptions={sourceOptions}
              onChange={u => updateField(f.id, u)}
              onRemove={() => removeField(f.id)}
            />
          ))}
        </tbody>
      </table>
      <button
        onClick={onAdd}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors border-t border-slate-200"
      >
        <Plus className="w-4 h-4" />
        Add field
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AvroSchemaBuilder() {
  const { userProfile } = useAuth();
  const canEdit = userProfile?.role === 'admin' || userProfile?.role === 'editor';

  const [project, setProject] = useState<IcdProject>({
    projectName: '',
    datasetName: '',
    basePackage: 'gov.usps.enterprise.eventbroker',
    sourceTopic: '',
    inboundFields: [newField(0)],
    inboundKeyFields: [newField(0)],
    outboundSchemas: [
      { ...newOutbound(), topicName: '' },
    ],
  });

  const [savedProjects, setSavedProjects] = useState<{ id: string; projectName: string; sourceTopic: string; created_at: string }[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [previewSchema, setPreviewSchema] = useState<{ label: string; json: object } | null>(null);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [githubConfig, setGithubConfig] = useState({
    owner: '',
    repo: 'eeb-kafka-schemas',
    branch: '',
    baseBranch: 'main',
    openPr: true,
  });
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'success' | 'error'>('idle');
  const [pushResult, setPushResult] = useState<{ branchUrl: string; actionsUrl: string; prUrl?: string; filesCommitted: number } | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [selectedOutboundForPush, setSelectedOutboundForPush] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);
  const [newProjectFlash, setNewProjectFlash] = useState(false);
  const [activeSection, setActiveSection] = useState<'inbound' | string>('inbound');
  const [showDeploySection, setShowDeploySection] = useState(false);
  const [referenceChartName, setReferenceChartName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadSavedProjects();
  }, []);

  // Auto-fill branch from the first outbound topic name or dataset name
  useEffect(() => {
    const ob = project.outboundSchemas[0];
    const source = ob?.topicName?.trim() || project.datasetName?.trim();
    if (source) {
      const slug = source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      setGithubConfig(c => ({ ...c, branch: `schema/${slug}` }));
    }
  }, [project.outboundSchemas, project.datasetName]);

  const loadSavedProjects = async () => {
    const { data } = await supabase
      .from('icd_projects')
      .select('id, project_name, source_topic, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) {
      setSavedProjects(data.map(d => ({
        id: d.id,
        projectName: d.project_name,
        sourceTopic: d.source_topic,
        created_at: d.created_at,
      })));
    }
  };

  const loadProject = async (id: string) => {
    const { data, error } = await supabase
      .from('icd_projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (data && !error) {
      const loaded = data.project_data as IcdProject;
      // Back-compat: old saved projects won't have keyFields
      const withDefaults: IcdProject = {
        ...loaded,
        id: data.id,
        inboundKeyFields: loaded.inboundKeyFields ?? [newField(0)],
        outboundSchemas: (loaded.outboundSchemas ?? []).map(ob => ({
          ...ob,
          keyFields: ob.keyFields ?? [newField(0)],
        })),
      };
      setProject(withDefaults);
    }
  };

  const saveProject = async () => {
    if (!project.projectName.trim()) return;
    setSaveStatus('saving');
    try {
      const payload = {
        project_name: project.projectName,
        source_topic: project.sourceTopic,
        dataset_name: project.datasetName,
        base_package: project.basePackage,
        project_data: project,
        updated_at: new Date().toISOString(),
      };

      if (project.id) {
        const { error } = await supabase
          .from('icd_projects')
          .update(payload)
          .eq('id', project.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('icd_projects')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        setProject(p => ({ ...p, id: data.id }));
      }
      setSaveStatus('saved');
      loadSavedProjects();
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const set = (patch: Partial<IcdProject>) => setProject(p => ({ ...p, ...patch }));

  const inboundFieldNames = project.inboundFields
    .map(f => f.fieldName)
    .filter(n => n.trim() !== '');

  const namespace = project.basePackage || 'gov.usps.enterprise.eventbroker';

  const getInboundRecordName = () =>
    project.sourceTopic.replace(/[^a-zA-Z0-9]/g, '_') || 'InboundEvent';

  const getOutboundRecordName = (ob: OutboundSchema) =>
    ob.topicName.replace(/[^a-zA-Z0-9]/g, '_') + '-value' || 'OutboundEvent';

  // ── Download handlers ──────────────────────────────────────────────────────

  const downloadInboundValue = () => {
    const name = getInboundRecordName() + '-value';
    downloadJson(buildAvsc(namespace, name, project.inboundFields), `${name}.avsc`);
  };

  const downloadInboundKey = () => {
    const name = getInboundRecordName() + '-key';
    const fields = project.inboundKeyFields.filter(f => f.fieldName.trim());
    const schema = fields.length > 0
      ? buildAvsc(namespace, name, fields)
      : buildKeyAvsc(namespace, project.sourceTopic);
    downloadJson(schema, `${name}.avsc`);
  };

  const downloadOutboundValue = (ob: OutboundSchema) => {
    const name = getOutboundRecordName(ob);
    downloadJson(buildAvsc(namespace, name, ob.fields), `${name}.avsc`);
  };

  const downloadOutboundKey = (ob: OutboundSchema) => {
    const name = ob.topicName.replace(/[^a-zA-Z0-9]/g, '_') + '-key';
    const fields = ob.keyFields.filter(f => f.fieldName.trim());
    const schema = fields.length > 0
      ? buildAvsc(namespace, name, fields)
      : buildKeyAvsc(namespace, ob.topicName);
    downloadJson(schema, `${name}.avsc`);
  };

  const downloadDataSpec = (ob: OutboundSchema) => {
    const csv = buildDataSpecCsv(project, ob);
    downloadText(csv, `DataSpec_${ob.topicName || 'outbound'}.csv`);
  };

  const downloadAllForOutbound = (ob: OutboundSchema) => {
    downloadInboundValue();
    downloadInboundKey();
    downloadOutboundValue(ob);
    downloadOutboundKey(ob);
    downloadDataSpec(ob);
  };

  const handlePushToGithub = async () => {
    if (!githubConfig.owner || !githubConfig.repo || !githubConfig.branch) return;
    setPushStatus('pushing');
    setPushError(null);
    setPushResult(null);

    const ob = project.outboundSchemas[selectedOutboundForPush] ?? project.outboundSchemas[0];
    if (!ob) return;

    const generatorInput: GeneratorInput = {
      projectName: project.projectName,
      datasetName: project.datasetName || project.projectName.replace(/\s+/g, '_').toUpperCase(),
      basePackage: project.basePackage,
      sourceTopic: project.sourceTopic,
      inboundFields: project.inboundFields,
      inboundKeyFields: project.inboundKeyFields,
      outboundSchema: ob,
    };

    const files: GeneratedFile[] = buildAllFiles(generatorInput);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('push-to-github', {
        body: {
          owner: githubConfig.owner,
          repo: githubConfig.repo,
          branch: githubConfig.branch,
          baseBranch: githubConfig.baseBranch || 'main',
          openPr: githubConfig.openPr,
          commitMessage: `chore: generated ${generatorInput.datasetName} ingest scaffold via EEB ICD Builder`,
          prTitle: `[EEB] ${project.projectName} — generated ingest scaffold`,
          prBody: `## Generated by EEB ICD Builder\n\n**Project:** ${project.projectName}\n**Inbound topic:** \`${project.sourceTopic}\`\n**Outbound topic:** \`${ob.topicName}\`\n\n**Files committed:** ${files.length}\n\nGitHub Actions will automatically run \`mvn clean package\` with JDK 21. No local build required.\n\n> Review all TODO comments in MappingService.java before merging to main.`,
          files,
        },
      });

      if (res.error) throw new Error(res.error.message);
      const result = res.data as { success: boolean; branch_url: string; actions_url: string; pr?: { url: string }; files_committed: number; error?: string };
      if (!result.success) throw new Error(result.error ?? 'Push failed');

      setPushResult({
        branchUrl: result.branch_url,
        actionsUrl: result.actions_url,
        prUrl: result.pr?.url,
        filesCommitted: result.files_committed,
      });
      setPushStatus('success');
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Push failed');
      setPushStatus('error');
    }
  };

  // ── Outbound schema management ─────────────────────────────────────────────

  const addOutbound = () =>
    set({ outboundSchemas: [...project.outboundSchemas, newOutbound()] });

  const removeOutbound = (id: string) =>
    set({ outboundSchemas: project.outboundSchemas.filter(o => o.id !== id) });

  const updateOutbound = (id: string, patch: Partial<OutboundSchema>) =>
    set({
      outboundSchemas: project.outboundSchemas.map(o =>
        o.id === id ? { ...o, ...patch } : o
      ),
    });

  const toggleOutbound = (id: string) =>
    set({
      outboundSchemas: project.outboundSchemas.map(o =>
        o.id === id ? { ...o, collapsed: !o.collapsed } : o
      ),
    });

  // ── Deploy repo helpers ────────────────────────────────────────────────────

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const deployDataset = project.datasetName.trim();
  const chartName      = deployDataset ? getChartName(deployDataset)      : 'eeb-ingest-...-9372-app';
  const valuesName     = deployDataset ? getValuesName(deployDataset)     : 'ingest-...';
  const branchName     = deployDataset ? getDeployBranchName(deployDataset) : 'feature/ingest-...-chart';
  const refChart       = referenceChartName.trim() || (deployDataset ? `eeb-ingest-${deployDataset.toLowerCase().replace(/_/g, '-').replace(/-[^-]+$/, '')}-9372-app` : '');

  const psClearCmd  = `Remove-Item -Recurse -Force ".\\charts\\${chartName}\\*"`;
  const psCopyCmd   = `Copy-Item -Recurse -Force ".\\charts\\${refChart}\\*" ".\\charts\\${chartName}\\"`;
  const argoContent = deployDataset ? generateArgocdJson(deployDataset) : '';
  const chartContent = deployDataset ? generateChartYaml(deployDataset) : '';
  const valuesContent = deployDataset ? generateValuesYaml(deployDataset) : '';
  const gitCmds = [
    `git checkout -b ${branchName}`,
    `git add charts/${chartName}/argocd.json`,
    `git add charts/${chartName}/Chart.yaml`,
    `git add charts/${chartName}/values.yaml`,
    `git commit -m "chore(deploy): map ${valuesName} chart values and link argocd applications"`,
    `git push origin HEAD`,
  ].join('\n');

  // ── Render ─────────────────────────────────────────────────────────────────

  const fieldCount = project.inboundFields.filter(f => f.fieldName.trim()).length;
  const allOutboundFieldCount = project.outboundSchemas.reduce(
    (acc, o) => acc + o.fields.filter(f => f.fieldName.trim()).length,
    0
  );

  return (
    <div className="flex h-full min-h-0">
      {/* Sidebar */}
      {showSidebar && (
        <aside className="w-64 shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">Saved Projects</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <button
              onClick={() => {
                setProject({
                  projectName: '',
                  datasetName: '',
                  basePackage: 'gov.usps.enterprise.eventbroker',
                  sourceTopic: '',
                  inboundFields: [newField(0)],
                  outboundSchemas: [newOutbound()],
                });
                setActiveSection('inbound');
                setNewProjectFlash(true);
                setTimeout(() => setNewProjectFlash(false), 1500);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors font-medium ${newProjectFlash ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'}`}
            >
              <Plus className="w-4 h-4" />
              {newProjectFlash ? 'Ready — fill in the form' : 'New Project'}
            </button>
            {savedProjects.map(p => (
              <button
                key={p.id}
                onClick={() => loadProject(p.id)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-white hover:shadow-sm transition-all group"
              >
                <p className="text-sm font-medium text-slate-800 truncate">{p.projectName}</p>
                <p className="text-xs text-slate-500 truncate font-mono">{p.sourceTopic}</p>
              </button>
            ))}
            {savedProjects.length === 0 && (
              <p className="text-xs text-slate-400 px-3 py-2">No saved projects yet</p>
            )}
          </div>
        </aside>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <FileCode className="w-6 h-6 text-blue-600" />
                ICD Builder & Avro Schema Generator
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Define your ICD fields, then generate inbound/outbound <code className="font-mono text-xs">.avsc</code> files and <code className="font-mono text-xs">DataSpec.csv</code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSidebar(s => !s)}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="Toggle sidebar"
              >
                <Layers className="w-5 h-5" />
              </button>
              {canEdit && (
                <button
                  onClick={saveProject}
                  disabled={saveStatus === 'saving' || !project.projectName.trim()}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {saveStatus === 'saving' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : saveStatus === 'saved' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Save'}
                </button>
              )}
              <button
                onClick={() => {
                  setPushStatus('idle');
                  setPushResult(null);
                  setPushError(null);
                  setShowGithubModal(true);
                }}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                title="Generate all Java files and push to GitHub"
              >
                <Github className="w-4 h-4" />
                Push to GitHub
              </button>
            </div>
          </div>

          {saveStatus === 'error' && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Save failed. Check that the icd_projects table exists.
            </div>
          )}

          {/* Project metadata */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-400" />
              Project Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Project Name *</label>
                <input
                  value={project.projectName}
                  onChange={e => set({ projectName: e.target.value })}
                  placeholder="e.g. MID Owner History Ingest"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dataset Name</label>
                <input
                  value={project.datasetName}
                  onChange={e => set({ datasetName: e.target.value })}
                  placeholder="e.g. MID_OWNER_HISTORY"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Source (Inbound) Topic</label>
                <input
                  value={project.sourceTopic}
                  onChange={e => set({ sourceTopic: e.target.value })}
                  placeholder="e.g. MID.LOGS.UPDATE.OWNER"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Base Package</label>
                <input
                  value={project.basePackage}
                  onChange={e => set({ basePackage: e.target.value })}
                  placeholder="gov.usps.enterprise.eventbroker"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Inbound schema */}
          <section className="bg-white border border-slate-200 rounded-xl mb-6 shadow-sm overflow-hidden">
            <div
              className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setActiveSection(s => s === 'inbound' ? '' : 'inbound')}
            >
              <div className="flex items-center gap-3">
                {activeSection === 'inbound' ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-mono">INBOUND</span>
                    {project.sourceTopic || 'Source Topic Schema'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">{fieldCount} fields defined</p>
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setPreviewSchema({
                    label: `${getInboundRecordName()}-value.avsc`,
                    json: buildAvsc(namespace, getInboundRecordName() + '-value', project.inboundFields),
                  })}
                  className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                  Preview
                </button>
                <button
                  onClick={downloadInboundKey}
                  className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Key .avsc
                </button>
                <button
                  onClick={downloadInboundValue}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  Value .avsc
                </button>
              </div>
            </div>

            {activeSection === 'inbound' && (
              <div className="px-6 pb-6 space-y-5">
                <div>
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">VALUE</span>
                    Value Fields
                  </h3>
                  <FieldTable
                    fields={project.inboundFields}
                    showSource={false}
                    sourceOptions={[]}
                    onUpdate={fields => set({ inboundFields: fields })}
                    onAdd={() => set({ inboundFields: [...project.inboundFields, newField(project.inboundFields.length)] })}
                  />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-mono">KEY</span>
                    Key Fields
                    <span className="text-xs font-normal text-slate-400 normal-case tracking-normal">— defines the {project.sourceTopic || 'inbound'}-key.avsc</span>
                  </h3>
                  <FieldTable
                    fields={project.inboundKeyFields}
                    showSource={false}
                    sourceOptions={[]}
                    onUpdate={fields => set({ inboundKeyFields: fields })}
                    onAdd={() => set({ inboundKeyFields: [...project.inboundKeyFields, newField(project.inboundKeyFields.length)] })}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Outbound schemas */}
          {project.outboundSchemas.map((ob, idx) => (
            <section
              key={ob.id}
              className="bg-white border border-slate-200 rounded-xl mb-4 shadow-sm overflow-hidden"
            >
              <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleOutbound(ob.id)}
              >
                <div className="flex items-center gap-3">
                  {!ob.collapsed ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded font-mono">
                        OUTBOUND {idx + 1}
                      </span>
                      {ob.topicName || 'EEB Topic'}
                      {project.sourceTopic && ob.topicName && (
                        <span className="flex items-center gap-1 text-xs text-slate-400 font-normal">
                          <ArrowRight className="w-3 h-3" />
                          from {project.sourceTopic}
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {ob.fields.filter(f => f.fieldName.trim()).length} fields
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setPreviewSchema({
                      label: `${getOutboundRecordName(ob)}.avsc`,
                      json: buildAvsc(namespace, getOutboundRecordName(ob), ob.fields),
                    })}
                    className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-green-700 border border-slate-200 hover:border-green-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Info className="w-3.5 h-3.5" />
                    Preview
                  </button>
                  <button
                    onClick={() => downloadDataSpec(ob)}
                    className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-green-700 border border-slate-200 hover:border-green-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    DataSpec.csv
                  </button>
                  <button
                    onClick={() => downloadAllForOutbound(ob)}
                    className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download All
                  </button>
                  {project.outboundSchemas.length > 1 && (
                    <button
                      onClick={() => removeOutbound(ob.id)}
                      className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {!ob.collapsed && (
                <div className="px-6 pb-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Outbound Topic Name</label>
                      <input
                        value={ob.topicName}
                        onChange={e => updateOutbound(ob.id, { topicName: e.target.value })}
                        placeholder="e.g. EEB.LOGS.MID.UPDATE.OWNER"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-green-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                      <input
                        value={ob.description}
                        onChange={e => updateOutbound(ob.id, { description: e.target.value })}
                        placeholder="What does this topic deliver?"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    <Info className="w-4 h-4 shrink-0 text-amber-500" />
                    Set the <strong>Source Field</strong> for each outbound field to map it from the inbound schema. Leave blank for system-derived fields.
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">VALUE</span>
                      Value Fields
                    </h3>
                    <FieldTable
                      fields={ob.fields}
                      showSource={true}
                      sourceOptions={inboundFieldNames}
                      onUpdate={fields => updateOutbound(ob.id, { fields })}
                      onAdd={() =>
                        updateOutbound(ob.id, {
                          fields: [...ob.fields, newField(ob.fields.length)],
                        })
                      }
                    />
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-mono">KEY</span>
                      Key Fields
                      <span className="text-xs font-normal text-slate-400 normal-case tracking-normal">— defines the {ob.topicName || 'outbound'}-key.avsc</span>
                    </h3>
                    <FieldTable
                      fields={ob.keyFields}
                      showSource={false}
                      sourceOptions={[]}
                      onUpdate={keyFields => updateOutbound(ob.id, { keyFields })}
                      onAdd={() =>
                        updateOutbound(ob.id, {
                          keyFields: [...ob.keyFields, newField(ob.keyFields.length)],
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </section>
          ))}

          <button
            onClick={addOutbound}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 hover:border-green-400 text-slate-500 hover:text-green-600 rounded-xl transition-colors text-sm font-medium mb-6"
          >
            <Plus className="w-4 h-4" />
            Add Outbound Schema
          </button>

          {/* ── Deploy Repo Section ─────────────────────────────────────────── */}
          <section className="bg-white border border-slate-200 rounded-xl mb-6 shadow-sm overflow-hidden">
            <div
              className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setShowDeploySection(s => !s)}
            >
              <div className="flex items-center gap-3">
                {showDeploySection
                  ? <ChevronDown className="w-4 h-4 text-slate-400" />
                  : <ChevronRight className="w-4 h-4 text-slate-400" />}
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-mono">STEP 4</span>
                    Deploy Repo — eeb-9372-deploy
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Helm chart setup, chart file generation, and git push commands
                  </p>
                </div>
              </div>
              {deployDataset && (
                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded truncate max-w-xs">
                  {chartName}
                </span>
              )}
            </div>

            {showDeploySection && (
              <div className="px-6 pb-6 space-y-5">

                {/* Warning banner */}
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <strong>Do not edit envs/dev/*.yaml</strong> — that file is automatically overwritten by the Jenkins/GitHub Actions pipeline after every successful build. Manual changes will be clobbered on the next run.
                  </div>
                </div>

                {/* Reference chart input */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Reference Chart Name <span className="text-slate-400">(baseline template folder)</span>
                  </label>
                  <input
                    value={referenceChartName}
                    onChange={e => setReferenceChartName(e.target.value)}
                    placeholder={refChart}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Leave blank to use the auto-suggested name above. This is the existing chart folder you copy files FROM.
                  </p>
                </div>

                {/* Phase 1 — PowerShell setup */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                    Phase 1 — Clear & copy chart template (run in eeb-9372-deploy workspace)
                  </h3>
                  <div className="bg-slate-900 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
                      <span className="text-xs text-slate-400 font-mono">PowerShell</span>
                      <button
                        onClick={() => copyText(`${psClearCmd}\n${psCopyCmd}`, 'ps-setup')}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        {copiedId === 'ps-setup' ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === 'ps-setup' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="text-xs text-green-300 font-mono p-4 whitespace-pre-wrap leading-relaxed">
{`# 1. Clear old chart files
${psClearCmd}

# 2. Copy Robert's reference template
${psCopyCmd}`}
                    </pre>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Red squiggles in VS Code after copy are safe to ignore — Helm resolves <code className="font-mono bg-slate-100 px-1 rounded">{'{{ .Values.name }}'}</code> at deploy time, not in the editor.
                  </p>
                </div>

                {/* Phase 2 — Chart file edits */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-slate-500" />
                    Phase 2 — Edit these 3 files only (templates are auto-resolved)
                  </h3>

                  <div className="space-y-3">
                    {/* argocd.json */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                        <span className="text-xs font-mono font-medium text-slate-700">
                          charts/{chartName}/argocd.json
                        </span>
                        <button
                          onClick={() => copyText(argoContent, 'argocd')}
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors"
                        >
                          {copiedId === 'argocd' ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedId === 'argocd' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="text-xs font-mono text-slate-700 p-4 bg-white whitespace-pre-wrap">
                        {argoContent || '{ "appName": "...", "customLabel": "default" }'}
                      </pre>
                    </div>

                    {/* Chart.yaml */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                        <span className="text-xs font-mono font-medium text-slate-700">
                          charts/{chartName}/Chart.yaml
                        </span>
                        <button
                          onClick={() => copyText(chartContent, 'chart-yaml')}
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors"
                        >
                          {copiedId === 'chart-yaml' ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedId === 'chart-yaml' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="text-xs font-mono text-slate-700 p-4 bg-white whitespace-pre-wrap">
                        {chartContent || 'apiVersion: v2\ntype: application\nname: eeb-ingest-...-9372-app\nversion: 0.1.0'}
                      </pre>
                    </div>

                    {/* values.yaml */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                        <span className="text-xs font-mono font-medium text-slate-700">
                          charts/{chartName}/values.yaml <span className="text-slate-400 font-normal">(name field only — rest stays from template)</span>
                        </span>
                        <button
                          onClick={() => copyText(valuesContent, 'values-yaml')}
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors"
                        >
                          {copiedId === 'values-yaml' ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedId === 'values-yaml' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="text-xs font-mono text-slate-700 p-4 bg-white whitespace-pre-wrap">
                        {valuesContent || 'name: ingest-...'}
                      </pre>
                    </div>
                  </div>

                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                    <strong>autoscaler.yaml, deployment.yaml, podMonitoring.yaml</strong> — no edits needed. All name references use <code className="font-mono bg-blue-100 px-1 rounded">{'{{ .Values.name }}'}</code> and resolve automatically during cluster deployment.
                  </div>
                </div>

                {/* Phase 3 — Git commands */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <GitBranch className="w-3.5 h-3.5 text-slate-500" />
                    Phase 3 — Version control (run in eeb-9372-deploy workspace)
                  </h3>
                  <div className="bg-slate-900 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
                      <span className="text-xs text-slate-400 font-mono">Git / PowerShell</span>
                      <button
                        onClick={() => copyText(gitCmds, 'git-cmds')}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        {copiedId === 'git-cmds' ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === 'git-cmds' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="text-xs text-green-300 font-mono p-4 whitespace-pre-wrap leading-relaxed">
                      {gitCmds}
                    </pre>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Only the 3 chart files are staged — <strong>do not</strong> add <code className="font-mono bg-slate-100 px-1 rounded">envs/dev/</code> to the commit.
                  </p>
                </div>

                {/* Build reminder */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-slate-500" />
                    Maven build reminder (in your app repo, before pushing deploy chart)
                  </h3>
                  <div className="bg-slate-900 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
                      <span className="text-xs text-slate-400 font-mono">Shell / PowerShell</span>
                      <button
                        onClick={() => copyText(
                          `# Step 1 — verify compile\nmvn -B compile "-Dmaven.clean.failOnError=false"\n\n# Step 2 — build JAR (skip tests)\nmvn -B package "-Dmaven.clean.failOnError=false" -DskipTests`,
                          'mvn-cmds'
                        )}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        {copiedId === 'mvn-cmds' ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === 'mvn-cmds' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="text-xs text-green-300 font-mono p-4 whitespace-pre-wrap leading-relaxed">
{`# Step 1 — verify compile
mvn -B compile "-Dmaven.clean.failOnError=false"

# Step 2 — build JAR (skip tests)
mvn -B package "-Dmaven.clean.failOnError=false" -DskipTests`}
                    </pre>
                  </div>
                </div>

                {/* Phase 4 — Git index cache fix */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    Phase 4 — If GitHub shows duplicate /templates/templates/ folders
                  </h3>
                  <p className="text-xs text-slate-500 mb-2">
                    Windows PowerShell's trailing wildcard path parsing can leave ghost directory layers in the Git index cache even though your local folders look flat. If Robert's review shows a corrupted tree online, run this index purge sequence — it aligns the remote layout without touching any file content.
                  </p>
                  <div className="bg-slate-900 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
                      <span className="text-xs text-slate-400 font-mono">Git — eeb-9372-deploy workspace</span>
                      <button
                        onClick={() => copyText(
                          `# 1. Purge the ghost path metadata from the Git index\ngit rm -r --cached charts/${chartName}/\n\n# 2. Re-stage the clean local directory\ngit add charts/${chartName}/\n\n# 3. Commit the structural realignment\ngit commit -m "fix(deploy): force sync remote repository file tree layout with local workspace"\n\n# 4. Push to realign the GitHub Web View\ngit push origin HEAD`,
                          'git-index-fix'
                        )}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        {copiedId === 'git-index-fix' ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === 'git-index-fix' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="text-xs text-green-300 font-mono p-4 whitespace-pre-wrap leading-relaxed">
{`# 1. Purge the ghost path metadata from the Git index
git rm -r --cached charts/${chartName}/

# 2. Re-stage the clean local directory
git add charts/${chartName}/

# 3. Commit the structural realignment
git commit -m "fix(deploy): force sync remote repository file tree layout with local workspace"

# 4. Push to realign the GitHub Web View
git push origin HEAD`}
                    </pre>
                  </div>
                </div>

                {/* Phase 5 — PR Templates */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    Phase 5 — Pull Request templates
                  </h3>
                  <div className="space-y-3">

                    {/* Deploy repo PR */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-orange-50 border-b border-slate-200">
                        <div>
                          <span className="text-xs font-semibold text-orange-800">PR 1 — eeb-9372-deploy</span>
                          <span className="ml-2 text-xs font-mono text-slate-500">main &larr; {branchName}</span>
                        </div>
                        <button
                          onClick={() => copyText(
                            `Title: chore(deploy): initialize charts and configurations for owner app\n\nBody:\nThis PR configures the deployment tracking for the new owner-update app. It includes:\n- Migrating the flat Helm chart template structure under the charts directory.\n- Reverting the manual envs/dev profile modifications back to a blank state object {} so it can be managed cleanly by the downstream webhook automation job.\n- Updating the explicit application naming references across argocd.json, Chart.yaml, and values.yaml to match the project tracking name while maintaining standard enterprise prefixes and suffixes.\n\nReady for review and merge to main. Thanks!`,
                            'pr-deploy'
                          )}
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-orange-700 transition-colors"
                        >
                          {copiedId === 'pr-deploy' ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedId === 'pr-deploy' ? 'Copied' : 'Copy all'}
                        </button>
                      </div>
                      <div className="p-4 bg-white space-y-2">
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase">Title</span>
                          <p className="text-xs font-mono text-slate-800 mt-1 bg-slate-50 px-2 py-1.5 rounded">
                            chore(deploy): initialize charts and configurations for owner app
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase">Body</span>
                          <pre className="text-xs text-slate-700 mt-1 bg-slate-50 px-3 py-2 rounded whitespace-pre-wrap leading-relaxed">{`This PR configures the deployment tracking for the new owner-update app. It includes:
- Migrating the flat Helm chart template structure under the charts directory.
- Reverting the manual envs/dev profile modifications back to a blank state object \`{}\` so it can be managed cleanly by the downstream webhook automation job.
- Updating the explicit application naming references across argocd.json, Chart.yaml, and values.yaml to match the project tracking name while maintaining standard enterprise prefixes and suffixes.

Ready for review and merge to main. Thanks!`}</pre>
                        </div>
                      </div>
                    </div>

                    {/* Java app PR */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border-b border-slate-200">
                        <div>
                          <span className="text-xs font-semibold text-blue-800">PR 2 — {chartName || 'Java app repo'}</span>
                          <span className="ml-2 text-xs font-mono text-slate-500">main &larr; feature/eeb-9372-ingest-{valuesName || 'updates'}</span>
                        </div>
                        <button
                          onClick={() => copyText(
                            `Title: feat(ingest): integrate schema refresh properties, metrics tracking, and resolve pmd violations\n\nBody:\nThis PR implements the core backend logic and schema updates for the ${project.projectName || 'ingest'} pipeline.\n\nKey changes include:\n- Integrated the two new non-nullable attributes (refreshId, refreshRecCnt) into the inbound message mapping layer.\n- Added the dynamic Splunk metrics tracker integration (ProcessorResult) across the processor loop and service mapping signatures using the dfltChrSeq fallback strategy.\n- Modified the application record generation logic to properly construct the updated Application container fields.\n- Fixed several strict corporate PMD style violations (including UseExplicitTypes, UnnecessaryCast, and unused variable parameters) to ensure a warning-free compile.\n\nThe local project builds through natively with an unconditional BUILD SUCCESS. Ready for review and automated pipeline gate checks. Thanks!`,
                            'pr-java'
                          )}
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-700 transition-colors"
                        >
                          {copiedId === 'pr-java' ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedId === 'pr-java' ? 'Copied' : 'Copy all'}
                        </button>
                      </div>
                      <div className="p-4 bg-white space-y-2">
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase">Title</span>
                          <p className="text-xs font-mono text-slate-800 mt-1 bg-slate-50 px-2 py-1.5 rounded">
                            feat(ingest): integrate schema refresh properties, metrics tracking, and resolve pmd violations
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase">Body</span>
                          <pre className="text-xs text-slate-700 mt-1 bg-slate-50 px-3 py-2 rounded whitespace-pre-wrap leading-relaxed">{`This PR implements the core backend logic and schema updates for the ${project.projectName || '[project name]'} pipeline.

Key changes include:
- Integrated the two new non-nullable attributes (\`refreshId\`, \`refreshRecCnt\`) into the inbound message mapping layer.
- Added the dynamic Splunk metrics tracker integration (\`ProcessorResult\`) across the processor loop and service mapping signatures using the \`dfltChrSeq\` fallback strategy.
- Modified the application record generation logic to properly construct the updated \`Application\` container fields.
- Fixed several strict corporate PMD style violations (including UseExplicitTypes, UnnecessaryCast, and unused variable parameters) to ensure a warning-free compile.

The local project builds through natively with an unconditional BUILD SUCCESS. Ready for review and automated pipeline gate checks. Thanks!`}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pipeline failure explainer */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <h3 className="text-xs font-semibold text-amber-900 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    Expected: Remote CI/CodeQL failures on new repos — do NOT modify code
                  </h3>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    After opening the Java app PR, GitHub Actions will typically show <strong>CodeQL Analysis: Failing</strong> and <strong>CI Build: Failing</strong>. This is <strong>normal for a new repository</strong> and is not caused by your application code.
                  </p>
                  <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                    <li><strong>Root cause:</strong> The remote Actions runner is a clean cloud container with no access to the corporate network where the parent BOM (<code className="font-mono bg-amber-100 px-0.5 rounded">eeb-ingest-bom</code>) lives. Without it, Maven crashes before any code runs.</li>
                    <li><strong>CodeQL cascade:</strong> Security scanning requires a successful compile first — when Maven crashes, CodeQL auto-drops out and logs a failure.</li>
                    <li><strong>Resolution:</strong> Robert has admin permissions to run the checks on enterprise build servers where corporate BOM access is granted. Leave the PR open and wait for his review — do not push new commits to "fix" the CI failure.</li>
                  </ul>
                  <div className="pt-1 border-t border-amber-300 text-xs text-amber-700 font-medium">
                    Your local <code className="font-mono bg-amber-100 px-0.5 rounded">BUILD SUCCESS</code> is the authoritative signal. Remote gate checks are an external network problem, not a code problem.
                  </div>
                </div>

              </div>
            )}
          </section>

          {/* Summary bar */}
          <div className="bg-slate-900 text-slate-300 rounded-xl p-5 flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-slate-500 text-xs">Inbound fields</span>
                <p className="text-white font-semibold text-lg">{fieldCount}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Outbound schemas</span>
                <p className="text-white font-semibold text-lg">{project.outboundSchemas.length}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Total outbound fields</span>
                <p className="text-white font-semibold text-lg">{allOutboundFieldCount}</p>
              </div>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              {project.basePackage}
            </div>
          </div>
        </div>
      </div>

      {/* Preview modal */}
      {previewSchema && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800 font-mono text-sm">{previewSchema.label}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(previewSchema.json, null, 2));
                  }}
                  className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
                <button
                  onClick={() => downloadJson(previewSchema.json, previewSchema.label)}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
                <button onClick={() => setPreviewSchema(null)} className="text-slate-400 hover:text-slate-600 ml-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap">
                {JSON.stringify(previewSchema.json, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* GitHub Push Modal */}
      {showGithubModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center">
                  <Github className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Generate & Push to GitHub</h3>
                  <p className="text-xs text-slate-500">Creates branch, commits all files, triggers CI build (JDK 21)</p>
                </div>
              </div>
              <button onClick={() => setShowGithubModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Success state */}
              {pushStatus === 'success' && pushResult && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-green-800 font-semibold">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    {pushResult.filesCommitted} files pushed successfully
                  </div>
                  <div className="space-y-2">
                    <a href={pushResult.branchUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 underline">
                      <ExternalLink className="w-4 h-4" />
                      View branch on GitHub
                    </a>
                    <a href={pushResult.actionsUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 underline">
                      <Play className="w-4 h-4" />
                      Watch CI build (JDK 21 Maven)
                    </a>
                    {pushResult.prUrl && (
                      <a href={pushResult.prUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 underline">
                        <FileText className="w-4 h-4" />
                        View Pull Request
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-green-700 pt-2 border-t border-green-200">
                    GitHub Actions will run <code className="font-mono bg-green-100 px-1 rounded">mvn clean package</code> with JDK 21 automatically. No local Java install needed.
                  </p>
                </div>
              )}

              {/* Error state */}
              {pushStatus === 'error' && pushError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Push failed</p>
                    <p className="text-sm text-red-700 mt-1">{pushError}</p>
                    <p className="text-xs text-red-600 mt-2">Make sure the <code className="font-mono bg-red-100 px-1 rounded">GITHUB_TOKEN</code> secret is configured in Supabase with repo write access.</p>
                  </div>
                </div>
              )}

              {/* Config form (hide after success) */}
              {pushStatus !== 'success' && (
                <>
                  {/* Repo details */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Repository</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">GitHub Owner / Org *</label>
                        <input
                          value={githubConfig.owner}
                          onChange={e => setGithubConfig(c => ({ ...c, owner: e.target.value }))}
                          placeholder="e.g. usps-ent-eventbroker"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-slate-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Repository Name *</label>
                        <input
                          value={githubConfig.repo}
                          onChange={e => setGithubConfig(c => ({ ...c, repo: e.target.value }))}
                          placeholder="eeb-kafka-schemas"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-slate-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">New Branch Name *</label>
                        <input
                          value={githubConfig.branch}
                          onChange={e => setGithubConfig(c => ({ ...c, branch: e.target.value }))}
                          placeholder={`feature/${project.datasetName?.toLowerCase().replace(/_/g, '-') || 'ingest'}`}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-slate-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Base Branch</label>
                        <input
                          value={githubConfig.baseBranch}
                          onChange={e => setGithubConfig(c => ({ ...c, baseBranch: e.target.value }))}
                          placeholder="main"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-slate-400 focus:outline-none"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={githubConfig.openPr}
                        onChange={e => setGithubConfig(c => ({ ...c, openPr: e.target.checked }))}
                        className="rounded text-slate-700"
                      />
                      <span className="text-sm text-slate-700">Open a Pull Request after push</span>
                    </label>
                  </div>

                  {/* Outbound selector if multiple */}
                  {project.outboundSchemas.length > 1 && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Outbound schema to include</label>
                      <div className="space-y-1">
                        {project.outboundSchemas.map((ob, idx) => (
                          <label key={ob.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                            <input
                              type="radio"
                              name="outboundSelect"
                              checked={selectedOutboundForPush === idx}
                              onChange={() => setSelectedOutboundForPush(idx)}
                              className="text-slate-800"
                            />
                            <span className="text-sm font-mono text-slate-700">{ob.topicName || `Outbound ${idx + 1}`}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* File manifest */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Files that will be committed</h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 max-h-44 overflow-y-auto">
                      {[
                        `pom.xml  ← Spring Boot 3.2 + Confluent + Avro`,
                        `.mvn/wrapper/maven-wrapper.properties`,
                        `src/main/avro/ — 4 .avsc files (inbound key+value, outbound key+value)`,
                        `src/main/resources/DataSpec.csv`,
                        `src/main/java/…/${project.datasetName ? (project.datasetName.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')) : 'Ingest'}App.java`,
                        `…/config/…Config.java`,
                        `…/generated/…InboundRecord.java`,
                        `…/service/…MappingContext.java`,
                        `…/service/…CommonUtil.java`,
                        `…/service/…MappingService.java`,
                        `…/processor/…BatchProcessor.java`,
                        `src/test/java/… — 3 test files`,
                        `src/main/resources/application.properties`,
                        `README.md`,
                        `config/java-pmd-ruleset.xml`,
                        `.github/workflows/build.yml`,
                        `.github/copilot-instructions.md`,
                        `.github/agents/csv-analysis.agent.md`,
                        `.github/agents/schema-validation.agent.md`,
                        `.github/agents/code-review.agent.md`,
                        `.github/agents/ingest-codegen.agent.md`,
                        `.github/agents/new-ingest.agent.md`,
                        `.github/instructions/config-code-review.instructions.md`,
                        `.github/instructions/markdown.instructions.md`,
                        `.github/instructions/java-code-review.instructions.md`,
                        `.github/skills/java-modernization/SKILL.md`,
                        `.github/skills/java-modernization/references/antipatterns-and-performance.md`,
                        `.github/skills/java-modernization/references/modern-java-formatting.md`,
                        `.github/skills/spring-boot-best-practices/SKILL.md`,
                        `.github/skills/spring-boot-best-practices/references/logging-testing-security.md`,
                        `.github/skills/spring-boot-best-practices/references/project-structure-and-components.md`,
                        `.github/skills/external-service-contract-handling/SKILL.md`,
                        `.github/skills/external-service-contract-handling/references/contract-workflow-and-guardrails.md`,
                        `.github/skills/kafka-ingest-mapping/SKILL.md`,
                        `.github/skills/kafka-ingest-mapping/references/mapping-workflow-and-guardrails.md`,
                      ].map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-mono text-slate-600">
                          <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-xs text-amber-800">
                    <Info className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                    <span>
                      A <code className="font-mono bg-amber-100 px-1 rounded">GITHUB_TOKEN</code> secret must be set in Supabase with <strong>repo write</strong> access.
                      GitHub Actions will compile and package the project automatically — no local JDK or Maven needed.
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowGithubModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
              >
                {pushStatus === 'success' ? 'Close' : 'Cancel'}
              </button>
              {pushStatus !== 'success' && (
                <button
                  onClick={handlePushToGithub}
                  disabled={pushStatus === 'pushing' || !githubConfig.owner || !githubConfig.repo || !githubConfig.branch}
                  className="flex items-center gap-2 bg-slate-900 hover:bg-black disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {pushStatus === 'pushing' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Pushing {buildAllFiles({
                        projectName: project.projectName,
                        datasetName: project.datasetName || project.projectName,
                        basePackage: project.basePackage,
                        sourceTopic: project.sourceTopic,
                        inboundFields: project.inboundFields,
                        inboundKeyFields: project.inboundKeyFields,
                        outboundSchema: project.outboundSchemas[selectedOutboundForPush] ?? project.outboundSchemas[0],
                      }).length} files...
                    </>
                  ) : (
                    <>
                      <Github className="w-4 h-4" />
                      Generate & Push
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}