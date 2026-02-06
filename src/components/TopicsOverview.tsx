import { useState, useEffect } from 'react';
import { Plus, Search, Filter, AlertTriangle, CheckCircle, Clock, Archive, Upload, RefreshCw } from 'lucide-react';
import { Topic } from '../lib/supabase';
import { topicsService } from '../services/database';

interface TopicsOverviewProps {
  onAddTopic: () => void;
  onImportExcel: () => void;
  onKafkaSync: () => void;
  onSelectTopic: (topic: Topic) => void;
}

export default function TopicsOverview({ onAddTopic, onImportExcel, onKafkaSync, onSelectTopic }: TopicsOverviewProps) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [environmentFilter, setEnvironmentFilter] = useState<string>('all');
  const [cloudFilter, setCloudFilter] = useState<string>('all');
  const [clusterFilter, setClusterFilter] = useState<string>('all');

  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    try {
      setLoading(true);
      const data = await topicsService.getAll();
      console.log('Loaded topics count:', data.length);
      console.log('By environment:', {
        dev: data.filter(t => t.environment === 'dev').length,
        sit: data.filter(t => t.environment === 'sit').length,
        cat: data.filter(t => t.environment === 'cat').length,
        prod: data.filter(t => t.environment === 'prod').length
      });
      setTopics(data);
    } catch (error) {
      console.error('Error loading topics:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTopics = topics.filter((topic) => {
    const matchesSearch = topic.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      topic.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || topic.status === statusFilter;
    const matchesEnvironment = environmentFilter === 'all' || topic.environment === environmentFilter;
    const matchesCloud = cloudFilter === 'all' || topic.cloud_provider === cloudFilter;
    const matchesCluster = clusterFilter === 'all' || topic.cluster_name === clusterFilter;
    return matchesSearch && matchesStatus && matchesEnvironment && matchesCloud && matchesCluster;
  });

  // Get unique clusters for filter
  const uniqueClusters = Array.from(new Set(topics.map(t => t.cluster_name).filter(Boolean)));

  // Environment counts
  const envCounts = {
    dev: topics.filter(t => t.environment === 'dev').length,
    sit: topics.filter(t => t.environment === 'sit').length,
    cat: topics.filter(t => t.environment === 'cat').length,
    prod: topics.filter(t => t.environment === 'prod').length
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'historical':
        return <Archive className="w-5 h-5 text-slate-400" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      complete: 'bg-green-100 text-green-800 border-green-200',
      in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
      historical: 'bg-slate-100 text-slate-600 border-slate-200'
    };
    const labels = {
      complete: 'Complete',
      in_progress: 'In Progress',
      historical: 'Historical'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getEnvironmentBadge = (env: string | null) => {
    if (!env) return null;
    const styles = {
      dev: 'bg-purple-100 text-purple-700 border-purple-200',
      sit: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      cat: 'bg-orange-100 text-orange-700 border-orange-200',
      prod: 'bg-red-100 text-red-700 border-red-200'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium border ${styles[env as keyof typeof styles]}`}>
        {env.toUpperCase()}
      </span>
    );
  };

  const getCloudBadge = (cloudProvider: string | null, clusterName: string | null) => {
    if (!cloudProvider) return null;
    const styles = {
      Azure: 'bg-blue-100 text-blue-700 border-blue-200',
      GCP: 'bg-green-100 text-green-700 border-green-200',
      AWS: 'bg-orange-100 text-orange-700 border-orange-200'
    };
    const displayText = clusterName || cloudProvider;
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium border ${styles[cloudProvider as keyof typeof styles] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
        {displayText}
      </span>
    );
  };

  const statusCounts = {
    all: topics.length,
    in_progress: topics.filter(t => t.status === 'in_progress').length,
    complete: topics.filter(t => t.status === 'complete').length,
    historical: topics.filter(t => t.status === 'historical').length
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Kafka Topics</h2>
          <p className="text-slate-500 mt-1">Manage and monitor your event ingestion pipeline</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onKafkaSync}
            className="flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors shadow-md hover:shadow-lg"
          >
            <RefreshCw className="w-5 h-5" />
            <span className="font-medium">Sync Kafka</span>
          </button>
          <button
            onClick={onImportExcel}
            className="flex items-center space-x-2 bg-slate-100 text-slate-700 px-6 py-3 rounded-lg hover:bg-slate-200 transition-colors border border-slate-300"
          >
            <Upload className="w-5 h-5" />
            <span className="font-medium">Import Excel</span>
          </button>
          <button
            onClick={onAddTopic}
            className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Add Topic</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {Object.entries(statusCounts).map(([status, count]) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`p-4 rounded-xl border-2 transition-all ${
              statusFilter === status
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm font-medium text-slate-600 capitalize">
                  {status.replace('_', ' ')}
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{count}</p>
              </div>
              {status !== 'all' && getStatusIcon(status)}
            </div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border-2 border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Filter by Environment</h3>
          <span className="text-xs text-slate-500">{filteredTopics.length} of {topics.length} topics</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setEnvironmentFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              environmentFilter === 'all'
                ? 'bg-slate-700 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All ({topics.length})
          </button>
          <button
            onClick={() => setEnvironmentFilter('dev')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              environmentFilter === 'dev'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            DEV ({envCounts.dev})
          </button>
          <button
            onClick={() => setEnvironmentFilter('sit')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              environmentFilter === 'sit'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            }`}
          >
            SIT ({envCounts.sit})
          </button>
          <button
            onClick={() => setEnvironmentFilter('cat')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              environmentFilter === 'cat'
                ? 'bg-orange-600 text-white shadow-md'
                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
            }`}
          >
            CAT ({envCounts.cat})
          </button>
          <button
            onClick={() => setEnvironmentFilter('prod')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              environmentFilter === 'prod'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
          >
            PROD ({envCounts.prod})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900 mb-3">Filter by Cluster</h3>
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => setClusterFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              clusterFilter === 'all'
                ? 'bg-slate-700 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Clusters
          </button>
          {uniqueClusters.map(cluster => (
            <button
              key={cluster}
              onClick={() => setClusterFilter(cluster)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                clusterFilter === cluster
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {cluster} ({topics.filter(t => t.cluster_name === cluster).length})
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search topics..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={environmentFilter}
            onChange={(e) => setEnvironmentFilter(e.target.value)}
            className="px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Environments</option>
            <option value="dev">DEV</option>
            <option value="sit">SIT</option>
            <option value="cat">CAT</option>
            <option value="prod">PROD</option>
          </select>
          <select
            value={cloudFilter}
            onChange={(e) => setCloudFilter(e.target.value)}
            className="px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Clouds</option>
            <option value="Azure">Azure</option>
            <option value="GCP">GCP</option>
            <option value="AWS">AWS</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-slate-500 mt-4">Loading topics...</p>
          </div>
        ) : filteredTopics.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">No topics found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTopics.map((topic) => (
              <div
                key={topic.id}
                onClick={() => onSelectTopic(topic)}
                className="p-5 border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all cursor-pointer bg-white"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">{topic.name}</h3>
                      {!topic.naming_valid && (
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                    {topic.description && (
                      <p className="text-slate-600 text-sm mb-3">{topic.description}</p>
                    )}
                    <div className="flex items-center space-x-3">
                      {getStatusBadge(topic.status)}
                      {getEnvironmentBadge(topic.environment)}
                      {getCloudBadge(topic.cloud_provider, topic.cluster_name)}
                      {topic.owner_team && (
                        <span className="text-xs text-slate-500">Team: {topic.owner_team}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm text-slate-500">
                    <p>{new Date(topic.created_at).toLocaleDateString()}</p>
                    {topic.partition_count && (
                      <p className="mt-1">{topic.partition_count} partitions</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
