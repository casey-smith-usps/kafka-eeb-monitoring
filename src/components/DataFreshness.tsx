import React, { useState, useEffect } from 'react';
import { Clock, TrendingUp, AlertTriangle, CheckCircle, Activity, Search, Filter, RefreshCw, Database, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface FreshnessMetric {
  id: string;
  schema_id: string | null;
  topic_id: string | null;
  dataset_name: string;
  last_updated_at: string;
  expected_update_frequency_minutes: number;
  freshness_sla_minutes: number;
  current_lag_minutes: number | null;
  is_stale: boolean;
  staleness_reason: string | null;
  data_volume_records: number | null;
  data_volume_mb: number | null;
  health_status: 'healthy' | 'warning' | 'critical' | 'unknown';
  last_checked_at: string;
  alert_sent: boolean;
  alert_sent_at: string | null;
  environment: 'dev' | 'sit' | 'cat' | 'prod';
  created_at: string;
  updated_at: string;
}

export const DataFreshness: React.FC = () => {
  const { userProfile } = useAuth();
  const canEdit = userProfile?.role === 'admin' || userProfile?.role === 'editor';

  const [metrics, setMetrics] = useState<FreshnessMetric[]>([]);
  const [filteredMetrics, setFilteredMetrics] = useState<FreshnessMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    filterMetrics();
  }, [searchTerm, selectedEnvironment, selectedStatus, metrics]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchMetrics();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('data_freshness_metrics')
        .select('*')
        .order('last_updated_at', { ascending: false });

      if (error) throw error;
      setMetrics(data || []);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to fetch freshness metrics');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const filterMetrics = () => {
    let filtered = [...metrics];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        m.dataset_name.toLowerCase().includes(term)
      );
    }

    if (selectedEnvironment !== 'all') {
      filtered = filtered.filter(m => m.environment === selectedEnvironment);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(m => m.health_status === selectedStatus);
    }

    setFilteredMetrics(filtered);
  };

  const getHealthBadge = (status: string) => {
    const styles = {
      healthy: 'bg-green-100 text-green-800 border-green-300',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      critical: 'bg-red-100 text-red-800 border-red-300',
      unknown: 'bg-gray-100 text-gray-800 border-gray-300',
    };
    const icons = {
      healthy: <CheckCircle className="w-3 h-3" />,
      warning: <AlertTriangle className="w-3 h-3" />,
      critical: <AlertTriangle className="w-3 h-3" />,
      unknown: <Activity className="w-3 h-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles]}`}>
        {icons[status as keyof typeof icons]}
        {status.toUpperCase()}
      </span>
    );
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

  const formatTimeSince = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  const formatDataSize = (mb: number | null) => {
    if (mb === null) return 'N/A';
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(2)} MB`;
  };

  const formatRecords = (records: number | null) => {
    if (records === null) return 'N/A';
    if (records >= 1000000) return `${(records / 1000000).toFixed(2)}M`;
    if (records >= 1000) return `${(records / 1000).toFixed(2)}K`;
    return records.toString();
  };

  const getFreshnessPercentage = (metric: FreshnessMetric) => {
    if (metric.current_lag_minutes === null) return 100;
    const percentage = Math.max(0, Math.min(100,
      ((metric.freshness_sla_minutes - metric.current_lag_minutes) / metric.freshness_sla_minutes) * 100
    ));
    return percentage;
  };

  const stats = {
    total: metrics.length,
    healthy: metrics.filter(m => m.health_status === 'healthy').length,
    warning: metrics.filter(m => m.health_status === 'warning').length,
    critical: metrics.filter(m => m.health_status === 'critical').length,
    stale: metrics.filter(m => m.is_stale).length,
  };

  const criticalDatasets = metrics
    .filter(m => m.health_status === 'critical')
    .slice(0, 5);

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-green-600" />
            Data Freshness Monitoring
          </h1>
          <div className="flex gap-2">
            <button
              onClick={fetchMetrics}
              className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                autoRefresh
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Activity className={`w-4 h-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
              Auto-Refresh {autoRefresh ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
        <p className="text-gray-600">Monitor data currency and identify stale datasets</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Datasets</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Database className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Healthy</p>
              <p className="text-2xl font-bold text-gray-900">{stats.healthy}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Warning</p>
              <p className="text-2xl font-bold text-gray-900">{stats.warning}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Critical</p>
              <p className="text-2xl font-bold text-gray-900">{stats.critical}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Stale Data</p>
              <p className="text-2xl font-bold text-gray-900">{stats.stale}</p>
            </div>
            <Clock className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {criticalDatasets.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-2">Critical Datasets Requiring Attention</h3>
              <div className="space-y-1">
                {criticalDatasets.map((metric) => (
                  <div key={metric.id} className="text-sm text-red-800">
                    <span className="font-medium">{metric.dataset_name}</span>
                    <span className="text-red-600"> - Last updated {formatTimeSince(metric.last_updated_at)}</span>
                    {metric.staleness_reason && <span className="text-red-700"> ({metric.staleness_reason})</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search datasets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedEnvironment}
              onChange={(e) => setSelectedEnvironment(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Environments</option>
              <option value="dev">DEV</option>
              <option value="sit">SIT</option>
              <option value="cat">CAT</option>
              <option value="prod">PROD</option>
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Status</option>
              <option value="healthy">Healthy</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
              <option value="unknown">Unknown</option>
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
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span className="text-red-800">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="ml-auto">
            <X className="w-5 h-5 text-red-600" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading freshness metrics...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMetrics.map((metric) => {
            const freshnessPercent = getFreshnessPercentage(metric);
            return (
              <div key={metric.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{metric.dataset_name}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {getHealthBadge(metric.health_status)}
                      {getEnvironmentBadge(metric.environment)}
                      {metric.is_stale && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                          STALE
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Last Updated</p>
                    <p className="text-lg font-semibold text-gray-900">{formatTimeSince(metric.last_updated_at)}</p>
                    <p className="text-xs text-gray-500">{new Date(metric.last_updated_at).toLocaleString()}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>Freshness Level</span>
                    <span className="font-medium">{freshnessPercent.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        metric.health_status === 'healthy' ? 'bg-green-500' :
                        metric.health_status === 'warning' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${freshnessPercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Current Lag</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {metric.current_lag_minutes !== null ? `${Math.floor(metric.current_lag_minutes)}m` : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">SLA Threshold</p>
                    <p className="text-sm font-semibold text-gray-900">{metric.freshness_sla_minutes}m</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Data Volume</p>
                    <p className="text-sm font-semibold text-gray-900">{formatRecords(metric.data_volume_records)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Size</p>
                    <p className="text-sm font-semibold text-gray-900">{formatDataSize(metric.data_volume_mb)}</p>
                  </div>
                </div>

                {metric.staleness_reason && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-yellow-900 mb-1">Staleness Reason</p>
                    <p className="text-sm text-yellow-800">{metric.staleness_reason}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100 mt-3">
                  <span>Expected update: every {metric.expected_update_frequency_minutes}m</span>
                  <span>Last checked: {formatTimeSince(metric.last_checked_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filteredMetrics.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No freshness metrics found</p>
        </div>
      )}
    </div>
  );
};
