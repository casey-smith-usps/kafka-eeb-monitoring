import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, CheckCircle, Clock, AlertTriangle, Target } from 'lucide-react';
import { topicsService, alertsService, updatesService, performanceMetricsService } from '../services/database';

interface KPIData {
  totalTopics: number;
  topicsByEnv: Record<string, number>;
  completionRate: number;
  activeAlerts: number;
  criticalAlerts: number;
  namingCompliance: number;
  updateCoverage: number;
  avgConsumerLag: number;
  topicsWithIssues: number;
  weeklyProgress: number;
}

interface KPIDashboardProps {
  onNavigate?: (view: string) => void;
}

export default function KPIDashboard({ onNavigate }: KPIDashboardProps = {}) {
  const [kpis, setKpis] = useState<KPIData>({
    totalTopics: 0,
    topicsByEnv: {},
    completionRate: 0,
    activeAlerts: 0,
    criticalAlerts: 0,
    namingCompliance: 0,
    updateCoverage: 0,
    avgConsumerLag: 0,
    topicsWithIssues: 0,
    weeklyProgress: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKPIs();
  }, []);

  const loadKPIs = async () => {
    try {
      setLoading(true);
      const [topics, alerts, todayUpdates] = await Promise.all([
        topicsService.getAll(),
        alertsService.getAll(),
        updatesService.getToday()
      ]);

      const topicsByEnv = topics.reduce((acc, topic) => {
        const env = topic.environment || 'unassigned';
        acc[env] = (acc[env] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const completeTopics = topics.filter(t => t.status === 'complete').length;
      const inProgressTopics = topics.filter(t => t.status === 'in_progress').length;
      const completionRate = topics.length > 0
        ? Math.round((completeTopics / (completeTopics + inProgressTopics)) * 100)
        : 0;

      const unresolvedAlerts = alerts.filter((a: any) => !a.resolved);
      const criticalAlerts = unresolvedAlerts.filter((a: any) => a.severity === 'critical').length;

      const validNamingTopics = topics.filter(t => t.naming_valid).length;
      const namingCompliance = topics.length > 0
        ? Math.round((validNamingTopics / topics.length) * 100)
        : 0;

      const topicsWithUpdates = new Set(todayUpdates.map((u: any) => u.topic_id)).size;
      const updateCoverage = inProgressTopics > 0
        ? Math.round((topicsWithUpdates / inProgressTopics) * 100)
        : 0;

      const topicsWithIssues = topics.filter(t => !t.naming_valid ||
        unresolvedAlerts.some((a: any) => a.topic_id === t.id)).length;

      setKpis({
        totalTopics: topics.length,
        topicsByEnv,
        completionRate,
        activeAlerts: unresolvedAlerts.length,
        criticalAlerts,
        namingCompliance,
        updateCoverage,
        avgConsumerLag: 0,
        topicsWithIssues,
        weeklyProgress: 0
      });
    } catch (error) {
      console.error('Error loading KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'text-green-600';
    if (value >= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTrendIcon = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return <TrendingUp className="w-5 h-5 text-green-600" />;
    if (value >= thresholds.warning) return <Activity className="w-5 h-5 text-yellow-600" />;
    return <TrendingDown className="w-5 h-5 text-red-600" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-slate-900 mb-2">Key Performance Indicators</h3>
        <p className="text-slate-500">Track progress and health of your Kafka ingestion pipeline</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border-2 border-slate-200 p-5 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-8 h-8 text-blue-600" />
            {getTrendIcon(kpis.completionRate, { good: 80, warning: 50 })}
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">Completion Rate</p>
          <p className={`text-3xl font-bold ${getStatusColor(kpis.completionRate, { good: 80, warning: 50 })}`}>
            {kpis.completionRate}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Target: 80%
          </p>
        </div>

        <div className="bg-white rounded-xl border-2 border-slate-200 p-5 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 text-green-600" />
            {getTrendIcon(kpis.namingCompliance, { good: 90, warning: 70 })}
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">Naming Compliance</p>
          <p className={`text-3xl font-bold ${getStatusColor(kpis.namingCompliance, { good: 90, warning: 70 })}`}>
            {kpis.namingCompliance}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {kpis.totalTopics - Math.round((kpis.namingCompliance / 100) * kpis.totalTopics)} topics with issues
          </p>
        </div>

        <div className="bg-white rounded-xl border-2 border-slate-200 p-5 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-8 h-8 text-blue-600" />
            {getTrendIcon(kpis.updateCoverage, { good: 80, warning: 50 })}
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">Daily Update Coverage</p>
          <p className={`text-3xl font-bold ${getStatusColor(kpis.updateCoverage, { good: 80, warning: 50 })}`}>
            {kpis.updateCoverage}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            In-progress topics updated today
          </p>
        </div>

        <div className="bg-white rounded-xl border-2 border-slate-200 p-5 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            {kpis.criticalAlerts === 0 ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">Critical Alerts</p>
          <p className={`text-3xl font-bold ${kpis.criticalAlerts === 0 ? 'text-green-600' : 'text-red-600'}`}>
            {kpis.criticalAlerts}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {kpis.activeAlerts} total active alerts
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border-2 border-slate-200 p-5">
          <h4 className="font-semibold text-slate-900 mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-600" />
            Topics by Environment
          </h4>
          <div className="space-y-3">
            {Object.entries(kpis.topicsByEnv).map(([env, count]) => {
              const percentage = Math.round((count / kpis.totalTopics) * 100);
              return (
                <div key={env}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700 uppercase">{env}</span>
                    <span className="text-sm font-bold text-slate-900">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border-2 border-slate-200 p-5">
          <h4 className="font-semibold text-slate-900 mb-4 flex items-center">
            <Target className="w-5 h-5 mr-2 text-purple-600" />
            Pipeline Health Metrics
          </h4>
          <div className="space-y-4">
            <button
              onClick={() => onNavigate?.('alerts')}
              className="w-full text-left p-3 rounded-lg hover:bg-red-50 border-2 border-transparent hover:border-red-200 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">Topics with Issues</span>
                <span className="text-lg font-bold text-red-600">{kpis.topicsWithIssues}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Naming violations or active alerts - Click to view →
              </div>
            </button>
            <div className="border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Total Active Topics</span>
                <span className="text-lg font-bold text-slate-900">{kpis.totalTopics}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                All environments combined
              </div>
            </div>
            <div className="border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Health Score</span>
                <span className={`text-lg font-bold ${getStatusColor(
                  100 - Math.round((kpis.topicsWithIssues / kpis.totalTopics) * 100),
                  { good: 90, warning: 70 }
                )}`}>
                  {kpis.totalTopics > 0
                    ? 100 - Math.round((kpis.topicsWithIssues / kpis.totalTopics) * 100)
                    : 100}%
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Based on compliance and alerts
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-5">
        <h4 className="font-semibold text-slate-900 mb-3">Progress</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-600 mb-1">Naming Compliance Target</p>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-white rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(kpis.namingCompliance, 100)}%` }}
                />
              </div>
              <span className="text-sm font-bold text-slate-900">{kpis.namingCompliance}%</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Goal: 95%</p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">Completion Rate Target</p>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-white rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(kpis.completionRate, 100)}%` }}
                />
              </div>
              <span className="text-sm font-bold text-slate-900">{kpis.completionRate}%</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Goal: 85%</p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">Zero Critical Alerts Target</p>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-white rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${
                    kpis.criticalAlerts === 0 ? 'bg-green-600' : 'bg-red-600'
                  }`}
                  style={{ width: kpis.criticalAlerts === 0 ? '100%' : '30%' }}
                />
              </div>
              <span className={`text-sm font-bold ${kpis.criticalAlerts === 0 ? 'text-green-600' : 'text-red-600'}`}>
                {kpis.criticalAlerts === 0 ? 'Met' : kpis.criticalAlerts}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Goal: 0 critical alerts</p>
          </div>
        </div>
      </div>
    </div>
  );
}
