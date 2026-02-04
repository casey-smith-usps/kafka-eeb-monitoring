import { useState, useEffect } from 'react';
import { Activity, CheckCircle, Clock, AlertTriangle, TrendingUp, GitBranch, FolderKanban } from 'lucide-react';
import { topicsService, alertsService, updatesService, schemaVersionsService, ingestProjectsService } from '../services/database';
import KPIDashboard from './KPIDashboard';

interface DashboardOverviewProps {
  onNavigate?: (view: string) => void;
}

export default function DashboardOverview({ onNavigate }: DashboardOverviewProps = {}) {
  const [stats, setStats] = useState({
    totalTopics: 0,
    inProgress: 0,
    complete: 0,
    historical: 0,
    unresolvedAlerts: 0,
    criticalAlerts: 0,
    todayUpdates: 0,
    recentSchemaChanges: 0,
    totalProjects: 0,
    projectsInDev: 0,
    projectsInSit: 0,
    projectsInCat: 0,
    projectsInProd: 0
  });
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [recentTopics, setRecentTopics] = useState<any[]>([]);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [topics, alerts, todayUpdates, projects] = await Promise.all([
        topicsService.getAll(),
        alertsService.getAll(),
        updatesService.getToday(),
        ingestProjectsService.getAll()
      ]);

      const unresolvedAlerts = alerts.filter((a: any) => !a.resolved);

      setStats({
        totalTopics: topics.length,
        inProgress: topics.filter(t => t.status === 'in_progress').length,
        complete: topics.filter(t => t.status === 'complete').length,
        historical: topics.filter(t => t.status === 'historical').length,
        unresolvedAlerts: unresolvedAlerts.length,
        criticalAlerts: unresolvedAlerts.filter((a: any) => a.severity === 'critical').length,
        todayUpdates: todayUpdates.length,
        recentSchemaChanges: 0,
        totalProjects: projects.length,
        projectsInDev: projects.filter(p => p.environment === 'dev').length,
        projectsInSit: projects.filter(p => p.environment === 'sit').length,
        projectsInCat: projects.filter(p => p.environment === 'cat').length,
        projectsInProd: projects.filter(p => p.prod_completed_date !== null).length
      });

      setRecentAlerts(unresolvedAlerts.slice(0, 5));
      setRecentTopics(topics.slice(0, 5));
      setRecentProjects(projects.slice(0, 5));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
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
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Dashboard Overview</h2>
        <p className="text-slate-500 mt-1">Monitor your Kafka topic ingestion pipeline</p>
      </div>

      <KPIDashboard />

      <div className="grid grid-cols-5 gap-4">
        <button
          onClick={() => onNavigate?.('standup')}
          className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all text-left cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <FolderKanban className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.totalProjects}</span>
          </div>
          <p className="text-green-100 text-sm font-medium">Ingest Projects</p>
          <p className="text-green-200 text-xs mt-1">Click to view standup →</p>
        </button>

        <button
          onClick={() => onNavigate?.('topics')}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all text-left cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.totalTopics}</span>
          </div>
          <p className="text-blue-100 text-sm font-medium">Total Topics</p>
          <p className="text-blue-200 text-xs mt-1">Click to view all →</p>
        </button>

        <button
          onClick={() => onNavigate?.('standup')}
          className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all text-left cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.inProgress}</span>
          </div>
          <p className="text-amber-100 text-sm font-medium">Topics In Progress</p>
          <p className="text-amber-200 text-xs mt-1">Click to view standup →</p>
        </button>

        <button
          onClick={() => onNavigate?.('topics')}
          className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all text-left cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.complete}</span>
          </div>
          <p className="text-emerald-100 text-sm font-medium">Complete Topics</p>
          <p className="text-emerald-200 text-xs mt-1">Click to filter →</p>
        </button>

        <button
          onClick={() => onNavigate?.('alerts')}
          className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all text-left cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.unresolvedAlerts}</span>
          </div>
          <p className="text-red-100 text-sm font-medium">Active Incidents</p>
          {stats.criticalAlerts > 0 && (
            <p className="text-red-200 text-xs mt-1">{stats.criticalAlerts} critical</p>
          )}
          <p className="text-red-200 text-xs mt-1">Click to view alerts →</p>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border-2 border-slate-200 p-5">
          <div className="flex items-center space-x-3 mb-1">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-900">Today's Activity</h3>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Status Updates</span>
              <span className="text-lg font-bold text-slate-900">{stats.todayUpdates}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Historical Topics</span>
              <span className="text-lg font-bold text-slate-900">{stats.historical}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border-2 border-slate-200 p-5">
          <div className="flex items-center space-x-3 mb-1">
            <FolderKanban className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-slate-900">Projects by Environment</h3>
          </div>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Dev</span>
                <span className="text-lg font-bold text-blue-600">{stats.projectsInDev}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">SIT</span>
                <span className="text-lg font-bold text-amber-600">{stats.projectsInSit}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">CAT</span>
                <span className="text-lg font-bold text-purple-600">{stats.projectsInCat}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Prod</span>
                <span className="text-lg font-bold text-green-600">{stats.projectsInProd}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Recent Alerts</h3>
          {recentAlerts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No active alerts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentAlerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    alert.severity === 'critical'
                      ? 'bg-red-50 border-red-200'
                      : alert.severity === 'high'
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{alert.title}</p>
                      {alert.topic?.name && (
                        <p className="text-xs text-slate-600 mt-1">{alert.topic.name}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded font-medium ${
                        alert.severity === 'critical'
                          ? 'bg-red-100 text-red-800'
                          : alert.severity === 'high'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">Recent Ingest Projects</h3>
            <button
              onClick={() => onNavigate?.('standup')}
              className="text-xs text-green-600 hover:text-green-700 font-medium"
            >
              View all →
            </button>
          </div>
          {recentProjects.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No projects yet</p>
          ) : (
            <div className="space-y-3">
              {recentProjects.map((project: any) => (
                <div key={project.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-slate-900 line-clamp-1">{project.title}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        {project.environment && (
                          <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 uppercase font-medium">
                            {project.environment}
                          </span>
                        )}
                        {project.owner && (
                          <span className="text-xs text-slate-500">{project.owner}</span>
                        )}
                      </div>
                      {project.tasks && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-1">{project.tasks}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
