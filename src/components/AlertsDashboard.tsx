import { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle, Plus } from 'lucide-react';
import { alertsService, topicsService } from '../services/database';
import IncidentDetailModal from './IncidentDetailModal';

export default function AlertsDashboard() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unresolved'>('unresolved');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [newAlert, setNewAlert] = useState({
    topic_id: '',
    alert_type: 'manual' as 'naming_violation' | 'performance_degradation' | 'schema_issue' | 'manual',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    title: '',
    description: ''
  });

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [alertsData, topicsData] = await Promise.all([
        filter === 'unresolved' ? alertsService.getUnresolved() : alertsService.getAll(),
        topicsService.getAll()
      ]);
      setAlerts(alertsData);
      setTopics(topicsData);
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      await alertsService.resolve(alertId, 'Current User');
      loadData();
    } catch (error) {
      alert('Error resolving alert');
    }
  };

  const handleAddAlert = async () => {
    if (!newAlert.title) {
      alert('Please enter a title');
      return;
    }

    try {
      await alertsService.create({
        topic_id: newAlert.topic_id || null,
        alert_type: newAlert.alert_type,
        severity: newAlert.severity,
        title: newAlert.title,
        description: newAlert.description || null
      });

      setNewAlert({
        topic_id: '',
        alert_type: 'manual',
        severity: 'medium',
        title: '',
        description: ''
      });
      setShowAddForm(false);
      loadData();
    } catch (error) {
      alert('Error creating alert');
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'medium':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'low':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return null;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'high':
        return 'bg-orange-50 border-orange-200 text-orange-900';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'low':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-900';
    }
  };

  const getAlertTypeBadge = (type: string) => {
    const styles = {
      naming_violation: 'bg-purple-100 text-purple-800',
      performance_degradation: 'bg-red-100 text-red-800',
      schema_issue: 'bg-orange-100 text-orange-800',
      manual: 'bg-slate-100 text-slate-800'
    };
    const labels = {
      naming_violation: 'Naming',
      performance_degradation: 'Performance',
      schema_issue: 'Schema',
      manual: 'Manual'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[type as keyof typeof styles]}`}>
        {labels[type as keyof typeof labels]}
      </span>
    );
  };

  const severityCounts = {
    critical: alerts.filter((a: any) => a.severity === 'critical' && !a.resolved).length,
    high: alerts.filter((a: any) => a.severity === 'high' && !a.resolved).length,
    medium: alerts.filter((a: any) => a.severity === 'medium' && !a.resolved).length,
    low: alerts.filter((a: any) => a.severity === 'low' && !a.resolved).length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Alerts & Issues</h2>
          <p className="text-slate-500 mt-1">Monitor and resolve system alerts</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Alert</span>
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border-2 border-red-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Critical</p>
              <p className="text-2xl font-bold text-red-600">{severityCounts.critical}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="bg-white rounded-xl border-2 border-orange-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">High</p>
              <p className="text-2xl font-bold text-orange-600">{severityCounts.high}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        <div className="bg-white rounded-xl border-2 border-yellow-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Medium</p>
              <p className="text-2xl font-bold text-yellow-600">{severityCounts.medium}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-white rounded-xl border-2 border-blue-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Low</p>
              <p className="text-2xl font-bold text-blue-600">{severityCounts.low}</p>
            </div>
            <Info className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Create New Alert</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Topic (Optional)</label>
                <select
                  value={newAlert.topic_id}
                  onChange={(e) => setNewAlert({ ...newAlert, topic_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No specific topic</option>
                  {topics.map((topic: any) => (
                    <option key={topic.id} value={topic.id}>{topic.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
                <select
                  value={newAlert.alert_type}
                  onChange={(e) => setNewAlert({ ...newAlert, alert_type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="manual">Manual</option>
                  <option value="naming_violation">Naming Violation</option>
                  <option value="performance_degradation">Performance</option>
                  <option value="schema_issue">Schema Issue</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Severity</label>
              <div className="flex space-x-2">
                {(['low', 'medium', 'high', 'critical'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setNewAlert({ ...newAlert, severity: sev })}
                    className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors capitalize ${
                      newAlert.severity === sev
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Title</label>
              <input
                type="text"
                value={newAlert.title}
                onChange={(e) => setNewAlert({ ...newAlert, title: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description of the issue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
              <textarea
                value={newAlert.description}
                onChange={(e) => setNewAlert({ ...newAlert, description: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Detailed description..."
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAlert}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Alert
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900">All Alerts</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('unresolved')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'unresolved'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Unresolved
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All
            </button>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-slate-500">No alerts found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert: any) => (
              <div
                key={alert.id}
                onClick={() => setSelectedIncident(alert)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${getSeverityColor(alert.severity)} ${
                  alert.resolved ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getSeverityIcon(alert.severity)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-semibold">{alert.title}</h4>
                        {getAlertTypeBadge(alert.alert_type)}
                        {alert.resolved && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                            Resolved
                          </span>
                        )}
                      </div>
                      {alert.description && (
                        <p className="text-sm mb-2">{alert.description}</p>
                      )}
                      <div className="flex items-center space-x-4 text-xs">
                        {alert.topic?.name && (
                          <span className="font-medium">Topic: {alert.topic.name}</span>
                        )}
                        <span className="text-slate-500">
                          {alert.date_identified
                            ? new Date(alert.date_identified).toLocaleString()
                            : new Date(alert.created_at).toLocaleString()}
                        </span>
                        {alert.resolved && alert.resolved_by && (
                          <span className="text-green-700">Resolved by {alert.resolved_by}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {!alert.resolved && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResolve(alert.id);
                      }}
                      className="ml-4 flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Resolve</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onResolve={handleResolve}
          onUpdate={loadData}
        />
      )}
    </div>
  );
}
