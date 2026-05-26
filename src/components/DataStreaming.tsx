import React, { useState } from 'react';
import { Activity, Mail, Database, Play, Square, CheckCircle, AlertCircle } from 'lucide-react';

interface StreamStatus {
  isRunning: boolean;
  lastSync: string | null;
  error: string | null;
  processedCount: number;
}

export function DataStreaming() {
  const [outlookStatus, setOutlookStatus] = useState<StreamStatus>({
    isRunning: false,
    lastSync: null,
    error: null,
    processedCount: 0,
  });

  const [splunkStatus, setSplunkStatus] = useState<StreamStatus>({
    isRunning: false,
    lastSync: null,
    error: null,
    processedCount: 0,
  });

  const [outlookToken, setOutlookToken] = useState('');
  const [splunkHost, setSplunkHost] = useState('');
  const [splunkToken, setSplunkToken] = useState('');
  const [syncInterval, setSyncInterval] = useState(300); // 5 minutes default

  let outlookIntervalId: number | null = null;
  let splunkIntervalId: number | null = null;

  const syncOutlookIncidents = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-outlook-incidents`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accessToken: outlookToken }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setOutlookStatus(prev => ({
          ...prev,
          lastSync: new Date().toISOString(),
          error: null,
          processedCount: prev.processedCount + (data.processed || 0),
        }));
      } else {
        throw new Error(data.error || 'Failed to sync');
      }
    } catch (error) {
      setOutlookStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  };

  const syncSplunkMetrics = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-splunk-metrics`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            splunkHost,
            splunkToken,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setSplunkStatus(prev => ({
          ...prev,
          lastSync: new Date().toISOString(),
          error: null,
          processedCount: prev.processedCount + (data.processed || 0),
        }));
      } else {
        throw new Error(data.error || 'Failed to sync');
      }
    } catch (error) {
      setSplunkStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  };

  const startOutlookStream = () => {
    if (!outlookToken) {
      setOutlookStatus(prev => ({ ...prev, error: 'Access token required' }));
      return;
    }

    setOutlookStatus(prev => ({ ...prev, isRunning: true, error: null }));

    // Initial sync
    syncOutlookIncidents();

    // Set up interval
    outlookIntervalId = window.setInterval(syncOutlookIncidents, syncInterval * 1000);
  };

  const stopOutlookStream = () => {
    if (outlookIntervalId !== null) {
      clearInterval(outlookIntervalId);
      outlookIntervalId = null;
    }
    setOutlookStatus(prev => ({ ...prev, isRunning: false }));
  };

  const startSplunkStream = () => {
    if (!splunkHost || !splunkToken) {
      setSplunkStatus(prev => ({ ...prev, error: 'Splunk host and token required' }));
      return;
    }

    setSplunkStatus(prev => ({ ...prev, isRunning: true, error: null }));

    // Initial sync
    syncSplunkMetrics();

    // Set up interval
    splunkIntervalId = window.setInterval(syncSplunkMetrics, syncInterval * 1000);
  };

  const stopSplunkStream = () => {
    if (splunkIntervalId !== null) {
      clearInterval(splunkIntervalId);
      splunkIntervalId = null;
    }
    setSplunkStatus(prev => ({ ...prev, isRunning: false }));
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-8 h-8 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">Data Streaming</h2>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Stream Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sync Interval (seconds)
            </label>
            <input
              type="number"
              value={syncInterval}
              onChange={(e) => setSyncInterval(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="60"
              step="60"
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum: 60 seconds (recommended: 300 seconds for production)
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Mail className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold">Outlook Incidents</h3>
            </div>
            <div className={`flex items-center gap-2 ${outlookStatus.isRunning ? 'text-green-600' : 'text-gray-400'}`}>
              {outlookStatus.isRunning ? (
                <>
                  <Activity className="w-4 h-4 animate-pulse" />
                  <span className="text-sm font-medium">Streaming</span>
                </>
              ) : (
                <span className="text-sm font-medium">Stopped</span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Microsoft Graph Access Token
              </label>
              <input
                type="password"
                value={outlookToken}
                onChange={(e) => setOutlookToken(e.target.value)}
                placeholder="Enter your access token"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={outlookStatus.isRunning}
              />
              <p className="text-xs text-gray-500 mt-1">
                Get this from Microsoft Azure AD authentication
              </p>
            </div>

            <div className="flex gap-2">
              {!outlookStatus.isRunning ? (
                <button
                  onClick={startOutlookStream}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Start Stream
                </button>
              ) : (
                <button
                  onClick={stopOutlookStream}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  Stop Stream
                </button>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Last Sync:</span>
                <span className="font-medium">{formatTimestamp(outlookStatus.lastSync)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Processed:</span>
                <span className="font-medium">{outlookStatus.processedCount}</span>
              </div>
              {outlookStatus.error && (
                <div className="flex items-start gap-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{outlookStatus.error}</span>
                </div>
              )}
              {outlookStatus.lastSync && !outlookStatus.error && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>Syncing successfully</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-semibold">Splunk Metrics</h3>
            </div>
            <div className={`flex items-center gap-2 ${splunkStatus.isRunning ? 'text-green-600' : 'text-gray-400'}`}>
              {splunkStatus.isRunning ? (
                <>
                  <Activity className="w-4 h-4 animate-pulse" />
                  <span className="text-sm font-medium">Streaming</span>
                </>
              ) : (
                <span className="text-sm font-medium">Stopped</span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Splunk Host
              </label>
              <input
                type="text"
                value={splunkHost}
                onChange={(e) => setSplunkHost(e.target.value)}
                placeholder="https://your-splunk-host.com:8089"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={splunkStatus.isRunning}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Splunk Token
              </label>
              <input
                type="password"
                value={splunkToken}
                onChange={(e) => setSplunkToken(e.target.value)}
                placeholder="Enter your Splunk token"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={splunkStatus.isRunning}
              />
            </div>

            <div className="flex gap-2">
              {!splunkStatus.isRunning ? (
                <button
                  onClick={startSplunkStream}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Start Stream
                </button>
              ) : (
                <button
                  onClick={stopSplunkStream}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  Stop Stream
                </button>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Last Sync:</span>
                <span className="font-medium">{formatTimestamp(splunkStatus.lastSync)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Processed:</span>
                <span className="font-medium">{splunkStatus.processedCount}</span>
              </div>
              {splunkStatus.error && (
                <div className="flex items-start gap-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{splunkStatus.error}</span>
                </div>
              )}
              {splunkStatus.lastSync && !splunkStatus.error && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>Syncing successfully</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Setup Instructions</h4>
        <div className="space-y-2 text-sm text-blue-800">
          <div>
            <strong>Outlook Setup:</strong>
            <ol className="list-decimal ml-5 mt-1 space-y-1">
              <li>Register an app in Azure AD</li>
              <li>Grant Mail.Read permissions</li>
              <li>Authenticate and get an access token</li>
              <li>Paste the token above and start streaming</li>
            </ol>
          </div>
          <div className="mt-3">
            <strong>Splunk Setup:</strong>
            <ol className="list-decimal ml-5 mt-1 space-y-1">
              <li>Create a Splunk authentication token</li>
              <li>Ensure your Splunk instance is accessible</li>
              <li>Configure your Kafka metrics index in Splunk</li>
              <li>Enter host and token above and start streaming</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
