import { useState, useEffect } from 'react';
import { ArrowLeft, Edit, GitBranch, Activity, FileText, AlertCircle, Plus } from 'lucide-react';
import { Topic, SchemaVersion, PerformanceMetric, Alert } from '../lib/supabase';
import {
  topicsService,
  schemaVersionsService,
  performanceMetricsService,
  alertsService,
  updatesService
} from '../services/database';

interface TopicDetailProps {
  topicId: string;
  onBack: () => void;
  onEdit: (topic: Topic) => void;
}

export default function TopicDetail({ topicId, onBack, onEdit }: TopicDetailProps) {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [schemas, setSchemas] = useState<SchemaVersion[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'schema' | 'metrics' | 'updates'>('overview');

  useEffect(() => {
    loadTopicData();
  }, [topicId]);

  const loadTopicData = async () => {
    try {
      setLoading(true);
      const [topicData, schemasData, metricsData, alertsData, updatesData] = await Promise.all([
        topicsService.getById(topicId),
        schemaVersionsService.getByTopicId(topicId),
        performanceMetricsService.getByTopicId(topicId, 20),
        alertsService.getByTopicId(topicId),
        updatesService.getByTopicId(topicId)
      ]);

      setTopic(topicData);
      setSchemas(schemasData);
      setMetrics(metricsData);
      setAlerts(alertsData);
      setUpdates(updatesData);
    } catch (error) {
      console.error('Error loading topic data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addSchemaVersion = async () => {
    const schemaJson = prompt('Enter schema definition (JSON):');
    if (!schemaJson) return;

    try {
      const schema = JSON.parse(schemaJson);
      const description = prompt('Describe the changes:') || '';
      const version = schemas.length > 0 ? Math.max(...schemas.map(s => s.version)) + 1 : 1;

      await schemaVersionsService.create({
        topic_id: topicId,
        version,
        schema_definition: schema,
        changes_description: description,
        created_by: 'Current User'
      });

      loadTopicData();
    } catch (error) {
      alert('Invalid JSON schema');
    }
  };

  const addMetric = async () => {
    const lag = prompt('Consumer Lag:');
    const mps = prompt('Messages per second:');

    if (!lag && !mps) return;

    try {
      await performanceMetricsService.create({
        topic_id: topicId,
        consumer_lag: lag ? parseInt(lag) : null,
        messages_per_second: mps ? parseFloat(mps) : null
      });

      loadTopicData();
    } catch (error) {
      alert('Error adding metric');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Topic not found</p>
        <button onClick={onBack} className="mt-4 text-blue-600 hover:text-blue-700">
          Go back
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'schema', label: 'Schema History', icon: GitBranch },
    { id: 'metrics', label: 'Performance', icon: Activity },
    { id: 'updates', label: 'Updates', icon: FileText }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="text-3xl font-bold text-slate-900">{topic.name}</h2>
            <p className="text-slate-500 mt-1">{topic.description || 'No description'}</p>
          </div>
        </div>
        <button
          onClick={() => onEdit(topic)}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
        >
          <Edit className="w-4 h-4" />
          <span>Edit</span>
        </button>
      </div>

      {alerts.filter(a => !a.resolved).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900">Active Alerts</h4>
              <div className="mt-2 space-y-1">
                {alerts.filter(a => !a.resolved).map(alert => (
                  <p key={alert.id} className="text-sm text-amber-800">• {alert.title}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200 px-6">
          <div className="flex space-x-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-3 flex items-center space-x-2 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Configuration</h4>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm text-slate-500">Status</dt>
                    <dd className="text-sm font-medium text-slate-900 capitalize">{topic.status.replace('_', ' ')}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Environment</dt>
                    <dd className="text-sm font-medium text-slate-900">{topic.environment || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Owner Team</dt>
                    <dd className="text-sm font-medium text-slate-900">{topic.owner_team || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Partitions</dt>
                    <dd className="text-sm font-medium text-slate-900">{topic.partition_count || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Replication Factor</dt>
                    <dd className="text-sm font-medium text-slate-900">{topic.replication_factor || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Retention</dt>
                    <dd className="text-sm font-medium text-slate-900">
                      {topic.retention_ms ? `${Math.floor(topic.retention_ms / 86400000)} days` : 'Not set'}
                    </dd>
                  </div>
                </dl>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Naming Validation</h4>
                <div className={`p-4 rounded-lg ${topic.naming_valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className={`font-medium ${topic.naming_valid ? 'text-green-900' : 'text-red-900'}`}>
                    {topic.naming_valid ? 'Valid naming convention' : 'Naming issues detected'}
                  </p>
                  {!topic.naming_valid && topic.naming_issues && (
                    <p className="text-sm text-red-700 mt-2">{topic.naming_issues}</p>
                  )}
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold text-slate-900 mb-2">Timestamps</h4>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-sm text-slate-500">Created</dt>
                      <dd className="text-sm font-medium text-slate-900">{new Date(topic.created_at).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-slate-500">Last Updated</dt>
                      <dd className="text-sm font-medium text-slate-900">{new Date(topic.updated_at).toLocaleString()}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schema' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-slate-900">Schema Versions ({schemas.length})</h4>
                <button
                  onClick={addSchemaVersion}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Version</span>
                </button>
              </div>
              {schemas.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No schema versions yet</p>
              ) : (
                <div className="space-y-4">
                  {schemas.map(schema => (
                    <div key={schema.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="font-semibold text-slate-900">Version {schema.version}</span>
                          {schema.created_by && (
                            <span className="text-sm text-slate-500 ml-2">by {schema.created_by}</span>
                          )}
                        </div>
                        <span className="text-sm text-slate-500">
                          {new Date(schema.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {schema.changes_description && (
                        <p className="text-sm text-slate-600 mb-3">{schema.changes_description}</p>
                      )}
                      <details className="text-sm">
                        <summary className="cursor-pointer text-blue-600 hover:text-blue-700">
                          View Schema Definition
                        </summary>
                        <pre className="mt-2 p-3 bg-slate-50 rounded overflow-x-auto text-xs">
                          {JSON.stringify(schema.schema_definition, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'metrics' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-slate-900">Performance Metrics</h4>
                <button
                  onClick={addMetric}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Metric</span>
                </button>
              </div>
              {metrics.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No metrics recorded yet</p>
              ) : (
                <div className="space-y-3">
                  {metrics.map(metric => (
                    <div key={metric.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">
                          {new Date(metric.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        {metric.consumer_lag !== null && (
                          <div>
                            <p className="text-xs text-slate-500">Consumer Lag</p>
                            <p className="text-lg font-semibold text-slate-900">{metric.consumer_lag.toLocaleString()}</p>
                          </div>
                        )}
                        {metric.messages_per_second !== null && (
                          <div>
                            <p className="text-xs text-slate-500">Messages/sec</p>
                            <p className="text-lg font-semibold text-slate-900">{metric.messages_per_second}</p>
                          </div>
                        )}
                        {metric.error_rate !== null && (
                          <div>
                            <p className="text-xs text-slate-500">Error Rate</p>
                            <p className="text-lg font-semibold text-slate-900">{metric.error_rate}%</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'updates' && (
            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Status Updates</h4>
              {updates.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No updates yet</p>
              ) : (
                <div className="space-y-4">
                  {updates.map(update => (
                    <div key={update.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-900">
                          {new Date(update.update_date).toLocaleDateString()}
                        </span>
                        {update.created_by && (
                          <span className="text-sm text-slate-500">by {update.created_by}</span>
                        )}
                      </div>
                      {update.status_update && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-slate-500 mb-1">Status</p>
                          <p className="text-sm text-slate-700">{update.status_update}</p>
                        </div>
                      )}
                      {update.blockers && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-red-500 mb-1">Blockers</p>
                          <p className="text-sm text-slate-700">{update.blockers}</p>
                        </div>
                      )}
                      {update.next_steps && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1">Next Steps</p>
                          <p className="text-sm text-slate-700">{update.next_steps}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
