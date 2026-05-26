import { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Info, X, GitBranch, Trash2 } from 'lucide-react';
import { CLUSTER_CONFIGS, getClusterById } from '../config/clusterConfig';
import { supabase } from '../lib/supabase';

interface KafkaSyncProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}

interface SyncResults {
  synced: number;
  updated: number;
  failed: number;
  schemas_synced?: number;
  errors: string[];
}

export default function KafkaSync({ isOpen, onClose, onSyncComplete }: KafkaSyncProps) {
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [results, setResults] = useState<SyncResults | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string>('');
  const [formData, setFormData] = useState({
    cloudProvider: 'Azure',
    clusterName: 'DEV Azure',
    kafkaAdminUrl: import.meta.env.VITE_CONFLUENT_ADMIN_URL || '',
    clusterId: import.meta.env.VITE_CONFLUENT_CLUSTER_ID || '',
    kafkaApiKey: import.meta.env.VITE_CONFLUENT_API_KEY || '',
    kafkaApiSecret: import.meta.env.VITE_CONFLUENT_API_SECRET || '',
    schemaRegistryUrl: '',
    schemaRegistryKey: '',
    schemaRegistrySecret: ''
  });

  // Handle predefined cluster selection
  const handleClusterSelect = (clusterId: string) => {
    setSelectedCluster(clusterId);

    if (!clusterId) {
      // Reset to manual entry
      return;
    }

    const cluster = getClusterById(clusterId);
    if (cluster) {
      setFormData({
        cloudProvider: cluster.cloudProvider,
        clusterName: cluster.displayName,
        kafkaAdminUrl: cluster.restEndpoint,
        clusterId: cluster.clusterId,
        kafkaApiKey: cluster.apiKey,
        kafkaApiSecret: cluster.apiSecret,
        schemaRegistryUrl: cluster.schemaRegistryEndpoint,
        schemaRegistryKey: cluster.schemaApiKey,
        schemaRegistrySecret: cluster.schemaApiSecret
      });
    }
  };

  // Mass delete topics for a specific cluster
  const handleMassDelete = async () => {
    if (!formData.clusterId) {
      alert('Please select a cluster first');
      return;
    }

    const confirmation = prompt(
      `⚠️ WARNING: This will permanently delete ALL topics from cluster "${formData.clusterName}" (${formData.clusterId}).\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Type "DELETE ${formData.clusterId}" to confirm:`
    );

    if (confirmation !== `DELETE ${formData.clusterId}`) {
      alert('Deletion cancelled - confirmation text did not match');
      return;
    }

    setDeleting(true);

    try {
      // Get all topics for this cluster
      const { data: topics, error: fetchError } = await supabase
        .from('topics')
        .select('id')
        .eq('cluster_id', formData.clusterId);

      if (fetchError) throw fetchError;

      if (!topics || topics.length === 0) {
        alert('No topics found for this cluster');
        setDeleting(false);
        return;
      }

      const topicIds = topics.map(t => t.id);

      // Delete related records first (alerts, schema_versions, performance_metrics, etc.)
      await Promise.all([
        supabase.from('alerts').delete().in('topic_id', topicIds),
        supabase.from('schema_versions').delete().in('topic_id', topicIds),
        supabase.from('performance_metrics').delete().in('topic_id', topicIds),
        supabase.from('topic_notes').delete().in('topic_id', topicIds),
        supabase.from('status_updates').delete().in('topic_id', topicIds)
      ]);

      // Delete the topics
      const { error: deleteError } = await supabase
        .from('topics')
        .delete()
        .eq('cluster_id', formData.clusterId);

      if (deleteError) throw deleteError;

      alert(`Successfully deleted ${topics.length} topics from cluster ${formData.clusterName}`);
      onSyncComplete();
      handleReset();
    } catch (error: any) {
      console.error('Mass delete error:', error);
      alert(`Failed to delete topics: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleSync = async () => {
    if (!formData.kafkaAdminUrl) {
      alert('Please enter Kafka Admin API URL');
      return;
    }

    if (!formData.clusterId) {
      alert('Please enter Cluster ID');
      return;
    }

    // Validate that the URL and Cluster ID are not swapped
    if (!formData.kafkaAdminUrl.startsWith('http://') && !formData.kafkaAdminUrl.startsWith('https://')) {
      alert('❌ Kafka Admin API URL must start with https://\n\nIt looks like you may have entered the Cluster ID in this field. Please check your values.');
      return;
    }

    if (formData.clusterId.startsWith('http://') || formData.clusterId.startsWith('https://')) {
      alert('❌ Cluster ID should be just the ID (e.g., lkc-33v902), not a full URL.\n\nIt looks like you may have entered the full URL in this field. Please check your values.');
      return;
    }

    setSyncing(true);
    setResults(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-kafka-topics`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          admin_url: formData.kafkaAdminUrl,
          cluster_id: formData.clusterId,
          api_key: formData.kafkaApiKey,
          api_secret: formData.kafkaApiSecret,
          cloud_provider: formData.cloudProvider,
          cluster_name: formData.clusterName,
          schema_registry_url: formData.schemaRegistryUrl,
          schema_registry_key: formData.schemaRegistryKey,
          schema_registry_secret: formData.schemaRegistrySecret
        })
      });

      if (!response.ok) {
        // 405 Method Not Allowed = GitHub Pages (no backend)
        if (response.status === 405) {
          throw new Error('GITHUB_PAGES_NO_BACKEND');
        }

        const errorText = await response.text();
        console.error('Backend error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          throw new Error(`Server error (${response.status}): ${errorText || response.statusText}`);
        }
        throw new Error(errorData.error || `Server error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Sync failed');
      }

      setResults(data.results);

      if (data.results.synced > 0 || data.results.updated > 0) {
        setTimeout(() => {
          onSyncComplete();
        }, 2000);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error occurred';

      // Handle specific error cases
      if (errorMessage === 'GITHUB_PAGES_NO_BACKEND') {
        alert(
          '🌐 GitHub Pages - View Only Mode\n\n' +
          'You are on GitHub Pages, which can only VIEW data. Manual sync is not available here.\n\n' +
          'To sync Kafka topics:\n' +
          '1. Clone the repo and run: python app.py\n' +
          '2. Access locally at: http://localhost:5000\n' +
          '3. Or use automated sync: python auto_sync.py\n\n' +
          'Contact the admin to request a sync, or set up the local backend yourself.'
        );
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        alert(
          '❌ Cannot connect to backend\n\n' +
          'Make sure the Python Flask backend is running:\n' +
          '1. Run: python app.py\n' +
          '2. Access at: http://localhost:5000\n' +
          '3. Or use: python auto_sync.py\n\n' +
          'Note: Kafka sync requires local backend due to corporate proxy.'
        );
      } else {
        alert(`Sync failed: ${errorMessage}`);
      }
      console.error('Kafka sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleReset = () => {
    setResults(null);
    setSelectedCluster('');
    setFormData({
      cloudProvider: 'Azure',
      clusterName: 'DEV Azure',
      kafkaAdminUrl: import.meta.env.VITE_CONFLUENT_ADMIN_URL || '',
      clusterId: import.meta.env.VITE_CONFLUENT_CLUSTER_ID || '',
      kafkaApiKey: import.meta.env.VITE_CONFLUENT_API_KEY || '',
      kafkaApiSecret: import.meta.env.VITE_CONFLUENT_API_SECRET || '',
      schemaRegistryUrl: '',
      schemaRegistryKey: '',
      schemaRegistrySecret: ''
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <RefreshCw className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-slate-900">Sync from Kafka</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!results && (
            <>
              <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 mb-1">Local Backend Required</h3>
                    <p className="text-sm text-amber-800">
                      Kafka sync requires the Flask backend running locally (<code className="bg-amber-100 px-1 rounded">python app.py</code>) on port 5000 due to corporate proxy requirements.
                    </p>
                    <p className="text-sm text-amber-800 mt-2">
                      <strong>GitHub Pages users:</strong> You can only VIEW data. To sync, ask the admin to run the local sync or use <code className="bg-amber-100 px-1 rounded">auto_sync.py</code>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 mb-1">About Kafka Sync</h3>
                    <p className="text-sm text-blue-800">
                      This will connect to your Kafka cluster and sync topic metadata including:
                    </p>
                    <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                      <li>Topic names and configurations</li>
                      <li>Partition counts and replication factors</li>
                      <li>Retention policies</li>
                      <li>Automatic naming validation</li>
                      <li>Schema versions (if Schema Registry URL provided)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Predefined Cluster Selection */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-3 flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>Quick Select: Predefined Clusters</span>
                </h3>
                <select
                  value={selectedCluster}
                  onChange={(e) => handleClusterSelect(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="">-- Select a predefined cluster (or enter manually below) --</option>
                  <optgroup label="DEV Clusters">
                    {CLUSTER_CONFIGS.filter(c => c.environment === 'dev').map(cluster => (
                      <option key={cluster.id} value={cluster.id}>
                        {cluster.displayName} ({cluster.cloudProvider})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="SIT Clusters">
                    {CLUSTER_CONFIGS.filter(c => c.environment === 'sit').map(cluster => (
                      <option key={cluster.id} value={cluster.id}>
                        {cluster.displayName} ({cluster.cloudProvider})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="CAT Clusters">
                    {CLUSTER_CONFIGS.filter(c => c.environment === 'cat').map(cluster => (
                      <option key={cluster.id} value={cluster.id}>
                        {cluster.displayName} ({cluster.cloudProvider})
                        {cluster.schemaApiKey === '' ? ' - Manual Schema Only' : ''}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-xs text-green-700 mt-2">
                  Select a cluster to auto-fill all credentials securely. Or enter manually below.
                </p>
              </div>

              {/* CAT Azure Manual Schema Warning */}
              {selectedCluster === 'cat-azure' && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-900 mb-1">CAT Azure Schema Note</h4>
                      <p className="text-sm text-amber-800">
                        This cluster has limited Schema Registry API access. Topics will sync, but schemas may need manual upload.
                        Consider syncing CAT GCP first (which has full schema access), then manually handling CAT Azure schemas.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Cloud Provider *
                  </label>
                  <select
                    value={formData.cloudProvider}
                    onChange={(e) => setFormData({ ...formData, cloudProvider: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Azure">Azure</option>
                    <option value="GCP">GCP</option>
                    <option value="AWS">AWS</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Select the cloud provider where this Kafka cluster is hosted
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Cluster Name *
                  </label>
                  <input
                    type="text"
                    value={formData.clusterName}
                    onChange={(e) => setFormData({ ...formData, clusterName: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="DEV Azure"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Human-readable name (e.g., "DEV Azure", "PROD GCP")
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Kafka REST API Endpoint *
                  </label>
                  <input
                    type="text"
                    value={formData.kafkaAdminUrl}
                    onChange={(e) => setFormData({ ...formData, kafkaAdminUrl: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://lkc-xxxxx.region.provider.confluent.cloud"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    ⚠️ Enter the REST API endpoint URL (without port)
                  </p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    Example: https://lkc-33v902.dom4gl8rd6w.eastus.azure.confluent.cloud
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Cluster ID * (Short ID Only)
                  </label>
                  <input
                    type="text"
                    value={formData.clusterId}
                    onChange={(e) => setFormData({ ...formData, clusterId: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="lkc-xxxxx"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    ⚠️ Enter ONLY the cluster ID (e.g., lkc-33v902), NOT the full URL
                  </p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    Example: lkc-33v902
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    API Key (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.kafkaApiKey}
                    onChange={(e) => setFormData({ ...formData, kafkaApiKey: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="API Key"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    API Secret (Optional)
                  </label>
                  <input
                    type="password"
                    value={formData.kafkaApiSecret}
                    onChange={(e) => setFormData({ ...formData, kafkaApiSecret: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="API Secret"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Required for Confluent Cloud or secured clusters
                  </p>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start space-x-3">
                      <GitBranch className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-purple-900 mb-1">Schema Registry Sync</h4>
                        <p className="text-sm text-purple-800">
                          Optionally sync schemas from Confluent Schema Registry to display schema versions and definitions for each topic
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Schema Registry URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.schemaRegistryUrl}
                      onChange={(e) => setFormData({ ...formData, schemaRegistryUrl: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="https://psrc-xxxxx.region.provider.confluent.cloud"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Enter to sync schema versions from Confluent Schema Registry
                    </p>
                    <p className="text-xs text-slate-600 mt-1 font-medium">
                      Example: https://psrc-xxxxx.us-east-2.aws.confluent.cloud
                    </p>
                  </div>

                  {formData.schemaRegistryUrl && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Schema Registry API Key
                        </label>
                        <input
                          type="text"
                          value={formData.schemaRegistryKey}
                          onChange={(e) => setFormData({ ...formData, schemaRegistryKey: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Schema Registry Key"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Schema Registry API Secret
                        </label>
                        <input
                          type="password"
                          value={formData.schemaRegistrySecret}
                          onChange={(e) => setFormData({ ...formData, schemaRegistrySecret: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Schema Registry Secret"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> Existing topics will be updated with latest metadata.
                      New topics discovered will be added with "In Progress" status.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                {/* Mass Delete Button (Left Side) */}
                <button
                  onClick={handleMassDelete}
                  disabled={deleting || !formData.clusterId}
                  className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  title="Delete all topics from the selected cluster"
                >
                  <Trash2 className={`w-5 h-5 ${deleting ? 'animate-spin' : ''}`} />
                  <span>{deleting ? 'Deleting...' : 'Mass Delete Cluster'}</span>
                </button>

                {/* Sync Buttons (Right Side) */}
                <div className="flex space-x-3">
                  <button
                    onClick={onClose}
                    className="px-6 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSync}
                    disabled={syncing || !formData.kafkaAdminUrl}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  >
                    <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                    <span>{syncing ? 'Syncing...' : 'Sync Topics'}</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {results && (
            <div className="space-y-4">
              <div className={`grid ${results.schemas_synced !== undefined ? 'grid-cols-4' : 'grid-cols-3'} gap-4`}>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-900">{results.synced}</p>
                  <p className="text-sm text-green-700">New Topics</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <RefreshCw className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-900">{results.updated}</p>
                  <p className="text-sm text-blue-700">Updated</p>
                </div>
                {results.schemas_synced !== undefined && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                    <GitBranch className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-purple-900">{results.schemas_synced}</p>
                    <p className="text-sm text-purple-700">Schemas</p>
                  </div>
                )}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-900">{results.failed}</p>
                  <p className="text-sm text-red-700">Failed</p>
                </div>
              </div>

              {results.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-2">Errors</h4>
                  <ul className="text-sm text-red-800 space-y-1 max-h-40 overflow-y-auto">
                    {results.errors.map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {results.synced > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800">
                    <strong>Success!</strong> Topics have been synced. Check the Alerts page for any naming violations.
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleReset}
                  className="px-6 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                >
                  Sync Again
                </button>
                <button
                  onClick={() => {
                    handleReset();
                    onClose();
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
