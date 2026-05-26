import React, { useState, useEffect } from 'react';
import { GitBranch, ArrowRight, Database, Cloud, FileJson, Activity, Filter, Search, Plus, CheckCircle, AlertCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface LineageRecord {
  id: string;
  source_id: string | null;
  source_name: string;
  source_type: 'topic' | 'database' | 'api' | 'file' | 'stream' | 'other';
  destination_id: string | null;
  destination_name: string;
  destination_type: 'topic' | 'database' | 'api' | 'file' | 'stream' | 'other';
  transformation_logic: string | null;
  data_flow_description: string | null;
  pipeline_name: string | null;
  environment: 'dev' | 'sit' | 'cat' | 'prod';
  is_active: boolean;
  latency_sla_seconds: number | null;
  throughput_mb_per_hour: number | null;
  created_at: string;
  updated_at: string;
}

export const DataLineage: React.FC = () => {
  const { userProfile } = useAuth();
  const canEdit = userProfile?.role === 'admin' || userProfile?.role === 'editor';

  const [lineageRecords, setLineageRecords] = useState<LineageRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<LineageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchLineageRecords();
  }, []);

  useEffect(() => {
    filterRecords();
  }, [searchTerm, selectedEnvironment, selectedType, lineageRecords]);

  const fetchLineageRecords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('data_lineage')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLineageRecords(data || []);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to fetch lineage records');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const filterRecords = () => {
    let filtered = [...lineageRecords];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.source_name.toLowerCase().includes(term) ||
        r.destination_name.toLowerCase().includes(term) ||
        r.pipeline_name?.toLowerCase().includes(term)
      );
    }

    if (selectedEnvironment !== 'all') {
      filtered = filtered.filter(r => r.environment === selectedEnvironment);
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter(r => r.source_type === selectedType || r.destination_type === selectedType);
    }

    setFilteredRecords(filtered);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'topic':
        return <Activity className="w-4 h-4" />;
      case 'database':
        return <Database className="w-4 h-4" />;
      case 'api':
        return <Cloud className="w-4 h-4" />;
      case 'file':
        return <FileJson className="w-4 h-4" />;
      case 'stream':
        return <GitBranch className="w-4 h-4" />;
      default:
        return <Database className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'topic':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'database':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'api':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'file':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'stream':
        return 'bg-pink-100 text-pink-800 border-pink-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getEnvironmentBadge = (env: string) => {
    const styles = {
      dev: 'bg-blue-100 text-blue-800',
      sit: 'bg-yellow-100 text-yellow-800',
      cat: 'bg-orange-100 text-orange-800',
      prod: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[env as keyof typeof styles]}`}>
        {env.toUpperCase()}
      </span>
    );
  };

  const buildLineageGraph = () => {
    const nodes = new Map<string, { name: string; type: string; connections: number }>();

    filteredRecords.forEach(record => {
      if (!nodes.has(record.source_name)) {
        nodes.set(record.source_name, {
          name: record.source_name,
          type: record.source_type,
          connections: 0
        });
      }
      if (!nodes.has(record.destination_name)) {
        nodes.set(record.destination_name, {
          name: record.destination_name,
          type: record.destination_type,
          connections: 0
        });
      }

      const sourceNode = nodes.get(record.source_name)!;
      const destNode = nodes.get(record.destination_name)!;
      sourceNode.connections++;
      destNode.connections++;
    });

    return Array.from(nodes.values());
  };

  const getUpstreamSources = (nodeName: string) => {
    return filteredRecords.filter(r => r.destination_name === nodeName);
  };

  const getDownstreamDestinations = (nodeName: string) => {
    return filteredRecords.filter(r => r.source_name === nodeName);
  };

  const stats = {
    total: lineageRecords.length,
    active: lineageRecords.filter(r => r.is_active).length,
    topics: new Set(lineageRecords.flatMap(r => [r.source_name, r.destination_name])).size,
    pipelines: new Set(lineageRecords.map(r => r.pipeline_name).filter(Boolean)).size,
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-purple-600" />
            Data Lineage & Flow Mapping
          </h1>
          <div className="flex gap-2">
            <div className="bg-white rounded-lg shadow border border-gray-200">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 text-sm font-medium rounded-l-lg transition-colors ${
                  viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                List View
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={`px-4 py-2 text-sm font-medium rounded-r-lg transition-colors ${
                  viewMode === 'graph' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Graph View
              </button>
            </div>
          </div>
        </div>
        <p className="text-gray-600">Track data flow across systems and understand dependencies</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Flows</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <GitBranch className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Flows</p>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Data Sources</p>
              <p className="text-2xl font-bold text-gray-900">{stats.topics}</p>
            </div>
            <Database className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pipelines</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pipelines}</p>
            </div>
            <Activity className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by source, destination, or pipeline name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedEnvironment}
              onChange={(e) => setSelectedEnvironment(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Environments</option>
              <option value="dev">DEV</option>
              <option value="sit">SIT</option>
              <option value="cat">CAT</option>
              <option value="prod">PROD</option>
            </select>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Types</option>
              <option value="topic">Kafka Topics</option>
              <option value="database">Databases</option>
              <option value="api">APIs</option>
              <option value="file">Files</option>
              <option value="stream">Streams</option>
            </select>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800">{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="ml-auto">
            <X className="w-5 h-5 text-green-600" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-800">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="ml-auto">
            <X className="w-5 h-5 text-red-600" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading lineage data...</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-4">
          {filteredRecords.map((record) => (
            <div key={record.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getEnvironmentBadge(record.environment)}
                  {record.is_active ? (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">Active</span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">Inactive</span>
                  )}
                  {record.pipeline_name && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                      {record.pipeline_name}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className={`inline-flex items-center gap-2 px-4 py-3 border rounded-lg ${getTypeColor(record.source_type)}`}>
                    {getTypeIcon(record.source_type)}
                    <div>
                      <p className="text-xs font-medium opacity-75">{record.source_type.toUpperCase()}</p>
                      <p className="font-semibold">{record.source_name}</p>
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <ArrowRight className="w-6 h-6 text-gray-400" />
                </div>

                <div className="flex-1">
                  <div className={`inline-flex items-center gap-2 px-4 py-3 border rounded-lg ${getTypeColor(record.destination_type)}`}>
                    {getTypeIcon(record.destination_type)}
                    <div>
                      <p className="text-xs font-medium opacity-75">{record.destination_type.toUpperCase()}</p>
                      <p className="font-semibold">{record.destination_name}</p>
                    </div>
                  </div>
                </div>
              </div>

              {record.data_flow_description && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">{record.data_flow_description}</p>
                </div>
              )}

              {record.transformation_logic && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-medium text-blue-900 mb-1">Transformation Logic</p>
                  <p className="text-sm text-blue-800 font-mono">{record.transformation_logic}</p>
                </div>
              )}

              {(record.latency_sla_seconds || record.throughput_mb_per_hour) && (
                <div className="mt-3 flex gap-4 text-xs text-gray-600">
                  {record.latency_sla_seconds && (
                    <div className="flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      <span>SLA: {record.latency_sla_seconds}s</span>
                    </div>
                  )}
                  {record.throughput_mb_per_hour && (
                    <div className="flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      <span>Throughput: {record.throughput_mb_per_hour} MB/h</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Flow Graph</h3>
            <p className="text-sm text-gray-600">Click on a node to see its upstream sources and downstream destinations</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 space-y-2">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Data Sources & Destinations</h4>
              {buildLineageGraph().map((node, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedNode(node.name)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                    selectedNode === node.name
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {getTypeIcon(node.type)}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{node.name}</p>
                      <p className="text-xs text-gray-500">{node.type} • {node.connections} connections</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="md:col-span-2">
              {selectedNode ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 rotate-180" />
                      Upstream Sources ({getUpstreamSources(selectedNode).length})
                    </h4>
                    {getUpstreamSources(selectedNode).length > 0 ? (
                      <div className="space-y-2">
                        {getUpstreamSources(selectedNode).map((record) => (
                          <div key={record.id} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              {getTypeIcon(record.source_type)}
                              <span className="font-medium text-blue-900">{record.source_name}</span>
                              <ArrowRight className="w-4 h-4 text-blue-600" />
                              <span className="text-blue-700">{selectedNode}</span>
                            </div>
                            {record.pipeline_name && (
                              <p className="text-xs text-blue-600 mt-1">via {record.pipeline_name}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No upstream sources</p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <ArrowRight className="w-4 h-4" />
                      Downstream Destinations ({getDownstreamDestinations(selectedNode).length})
                    </h4>
                    {getDownstreamDestinations(selectedNode).length > 0 ? (
                      <div className="space-y-2">
                        {getDownstreamDestinations(selectedNode).map((record) => (
                          <div key={record.id} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className="text-green-700">{selectedNode}</span>
                              <ArrowRight className="w-4 h-4 text-green-600" />
                              {getTypeIcon(record.destination_type)}
                              <span className="font-medium text-green-900">{record.destination_name}</span>
                            </div>
                            {record.pipeline_name && (
                              <p className="text-xs text-green-600 mt-1">via {record.pipeline_name}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No downstream destinations</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-400">
                  <div className="text-center">
                    <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Select a node to view its lineage</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && filteredRecords.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No lineage records found</p>
        </div>
      )}
    </div>
  );
};
