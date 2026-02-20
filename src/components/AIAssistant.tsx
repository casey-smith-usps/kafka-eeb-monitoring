import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Database, AlertCircle, RefreshCw } from 'lucide-react';
import { databricksClient } from '../services/databricks';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface QuickAction {
  label: string;
  prompt: string;
  icon: React.ReactNode;
}

export function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickActions: QuickAction[] = [
    {
      label: 'Dashboard Summary',
      prompt: 'Give me a comprehensive summary of the entire dashboard including alerts, topics, incidents, and performance metrics',
      icon: <Database className="w-4 h-4" />,
    },
    {
      label: 'Critical Issues',
      prompt: 'What are the most critical issues right now that need immediate attention?',
      icon: <AlertCircle className="w-4 h-4" />,
    },
    {
      label: 'Performance Analysis',
      prompt: 'Analyze performance metrics and identify topics with degraded performance or high consumer lag',
      icon: <RefreshCw className="w-4 h-4" />,
    },
    {
      label: 'Get Recommendations',
      prompt: 'Based on all the current data, provide me with prioritized recommendations for what actions to take. Include priority scores, impact analysis, and specific action items.',
      icon: <Sparkles className="w-4 h-4" />,
    },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchContextData = async () => {
    try {
      const [
        alertsResult,
        topicsResult,
        incidentsResult,
        performanceResult,
        lineageResult,
        oncallResult
      ] = await Promise.all([
        supabase
          .from('alerts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('topics')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('alerts')
          .select('*')
          .not('incident_number', 'is', null)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('performance_metrics')
          .select('*, topics(name, environment)')
          .order('timestamp', { ascending: false })
          .limit(50),
        supabase
          .from('topic_lineage')
          .select('*, source:source_topic_id(name), target:target_topic_id(name)')
          .limit(50),
        supabase
          .from('oncall_rotation')
          .select('*')
          .order('start_date', { ascending: false })
          .limit(5),
      ]);

      let context = 'COMPREHENSIVE DASHBOARD DATA:\n\n';

      // Alerts Summary
      if (alertsResult.data && alertsResult.data.length > 0) {
        context += '=== ALERTS OVERVIEW ===\n';
        const totalAlerts = alertsResult.data.length;
        const criticalAlerts = alertsResult.data.filter(a => a.severity === 'critical').length;
        const highAlerts = alertsResult.data.filter(a => a.severity === 'high').length;
        const unresolvedAlerts = alertsResult.data.filter(a => !a.resolved).length;

        context += `Total Alerts: ${totalAlerts}\n`;
        context += `Critical: ${criticalAlerts} | High: ${highAlerts} | Unresolved: ${unresolvedAlerts}\n\n`;

        context += 'Recent Critical/High Alerts:\n';
        alertsResult.data
          .filter(a => ['critical', 'high'].includes(a.severity) && !a.resolved)
          .slice(0, 10)
          .forEach((alert, idx) => {
            context += `${idx + 1}. [${alert.severity.toUpperCase()}] ${alert.title}\n`;
            context += `   Type: ${alert.alert_type} | Created: ${new Date(alert.created_at).toLocaleDateString()}\n`;
            if (alert.description) context += `   Description: ${alert.description}\n`;
            if (alert.incident_number) context += `   Incident: ${alert.incident_number}\n`;
          });
        context += '\n';
      }

      // Topics Summary
      if (topicsResult.data && topicsResult.data.length > 0) {
        context += '=== KAFKA TOPICS OVERVIEW ===\n';
        const totalTopics = topicsResult.data.length;
        const envGroups = topicsResult.data.reduce((acc, topic) => {
          const env = topic.environment || 'unknown';
          if (!acc[env]) acc[env] = { total: 0, complete: 0, in_progress: 0, naming_issues: 0 };
          acc[env].total++;
          if (topic.status === 'complete') acc[env].complete++;
          if (topic.status === 'in_progress') acc[env].in_progress++;
          if (topic.naming_issues) acc[env].naming_issues++;
          return acc;
        }, {} as Record<string, any>);

        context += `Total Topics: ${totalTopics}\n\n`;
        context += 'By Environment:\n';
        Object.entries(envGroups).forEach(([env, stats]) => {
          context += `${env.toUpperCase()}: ${stats.total} topics (Complete: ${stats.complete}, In Progress: ${stats.in_progress}, Naming Issues: ${stats.naming_issues})\n`;
        });

        const cloudProviders = topicsResult.data.reduce((acc, t) => {
          const provider = t.cloud_provider || 'unknown';
          acc[provider] = (acc[provider] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        context += '\nBy Cloud Provider:\n';
        Object.entries(cloudProviders).forEach(([provider, count]) => {
          context += `${provider}: ${count} topics\n`;
        });
        context += '\n';
      }

      // Incidents Summary
      if (incidentsResult.data && incidentsResult.data.length > 0) {
        context += '=== SERVICENOW INCIDENTS ===\n';
        const openIncidents = incidentsResult.data.filter(i => !i.resolved);
        context += `Active Incidents: ${openIncidents.length}\n\n`;

        openIncidents.slice(0, 10).forEach((incident, idx) => {
          context += `${idx + 1}. ${incident.incident_number} - ${incident.title}\n`;
          context += `   Priority: P${incident.priority} | Business Service: ${incident.business_service || 'N/A'}\n`;
          context += `   Category: ${incident.category || 'N/A'}\n`;
          if (incident.functional_impact) context += `   Impact: ${incident.functional_impact}\n`;
        });
        context += '\n';
      }

      // Performance Metrics
      if (performanceResult.data && performanceResult.data.length > 0) {
        context += '=== PERFORMANCE METRICS (Recent) ===\n';
        const metricsWithIssues = performanceResult.data.filter(m =>
          (m.error_rate && m.error_rate > 5) ||
          (m.consumer_lag && m.consumer_lag > 10000)
        );

        if (metricsWithIssues.length > 0) {
          context += `Topics with Performance Issues: ${metricsWithIssues.length}\n\n`;
          metricsWithIssues.slice(0, 10).forEach((metric, idx) => {
            context += `${idx + 1}. ${metric.topics?.name} (${metric.topics?.environment})\n`;
            if (metric.error_rate > 5) context += `   ⚠️ Error Rate: ${metric.error_rate}%\n`;
            if (metric.consumer_lag > 10000) context += `   ⚠️ Consumer Lag: ${metric.consumer_lag} messages\n`;
            if (metric.messages_per_second) context += `   Throughput: ${metric.messages_per_second} msg/s\n`;
          });
        } else {
          context += 'No significant performance issues detected\n';
        }
        context += '\n';
      }

      // Topic Lineage
      if (lineageResult.data && lineageResult.data.length > 0) {
        context += '=== TOPIC LINEAGE ===\n';
        context += `Total Lineage Relationships: ${lineageResult.data.length}\n`;
        const relationshipTypes = lineageResult.data.reduce((acc, l) => {
          acc[l.relationship_type] = (acc[l.relationship_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        Object.entries(relationshipTypes).forEach(([type, count]) => {
          context += `${type}: ${count}\n`;
        });
        context += '\n';
      }

      // On-Call Rotation
      if (oncallResult.data && oncallResult.data.length > 0) {
        context += '=== ON-CALL ROTATION ===\n';
        const currentRotation = oncallResult.data.find(r => {
          const now = new Date();
          const start = new Date(r.start_date);
          const end = new Date(r.end_date);
          return now >= start && now <= end;
        });

        if (currentRotation) {
          context += 'Current On-Call:\n';
          context += `Primary: ${currentRotation.primary_name}\n`;
          context += `Secondary: ${currentRotation.secondary_name}\n`;
          context += `Tertiary: ${currentRotation.tertiary_name}\n`;
          context += `Period: ${new Date(currentRotation.start_date).toLocaleDateString()} - ${new Date(currentRotation.end_date).toLocaleDateString()}\n`;
        }
        context += '\n';
      }

      context += '=== END OF DASHBOARD DATA ===\n';
      context += 'You have access to all the above data. Use it to provide detailed, data-driven answers.\n\n';
      context += '=== RECOMMENDATION GUIDELINES ===\n';
      context += 'When asked for recommendations, structure your response as follows:\n\n';
      context += '1. PRIORITY SCORE (1-10): Assess urgency and impact\n';
      context += '2. CATEGORY: Alert Management | Performance Tuning | Incident Response | Architecture | Compliance\n';
      context += '3. ISSUE: Clearly describe the problem or opportunity\n';
      context += '4. IMPACT: Business and technical consequences\n';
      context += '5. ACTION ITEMS: Specific, actionable steps\n';
      context += '6. ESTIMATED EFFORT: Quick Win (<1 day) | Medium (1-3 days) | Strategic (>3 days)\n';
      context += '7. DEPENDENCIES: What needs to happen first\n\n';
      context += 'Focus on:\n';
      context += '- Critical/high severity unresolved alerts\n';
      context += '- Performance degradation patterns\n';
      context += '- Incident trends and root causes\n';
      context += '- Naming convention violations\n';
      context += '- Cross-environment inconsistencies\n';
      context += '- On-call workload distribution issues\n';
      context += '- Topic lineage gaps or misconfigurations\n';

      return context;
    } catch (err) {
      console.error('Error fetching context:', err);
      return '';
    }
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const context = await fetchContextData();
      const response = await databricksClient.answerQuestion(textToSend, context);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get response from AI';

      // Check for rate limit or permission errors
      if (errorMessage.includes('REQUEST_LIMIT_EXCEEDED')) {
        setError('⏱️ Rate limit exceeded. The Databricks model endpoint has reached its rate limit. Please wait a few minutes and try again, or contact your Databricks admin to increase the rate limit for the endpoint.');
      } else if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('rate limit')) {
        setError('AI Assistant is currently unavailable. The Databricks endpoint requires administrator permission to enable. Please contact your workspace admin to set the rate limit above 0.');
      } else {
        setError(errorMessage);
      }
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    handleSend(prompt);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="bg-white border-b border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Assistant</h1>
            <p className="text-sm text-slate-600">
              Powered by Claude Opus 4.1 via Databricks
            </p>
          </div>
        </div>
      </div>

      {messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="max-w-3xl w-full space-y-8">
            <div className="text-center">
              <div className="inline-flex p-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl mb-4">
                <Bot className="w-12 h-12 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                How can I help you today?
              </h2>
              <p className="text-slate-600">
                I can see all your dashboard data including alerts, topics, incidents, performance metrics, lineage, and on-call rotation
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickAction(action.prompt)}
                  className="p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                      {action.icon}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-900">{action.label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-4 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              <div
                className={`max-w-3xl rounded-2xl px-6 py-4 ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white'
                    : 'bg-white border border-slate-200 text-slate-900'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{message.content}</div>
                <div
                  className={`text-xs mt-2 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-slate-500'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {error && (
        <div className="px-6 pb-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      <div className="bg-white border-t border-slate-200 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about incidents, topics, or system health..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-700 hover:to-blue-600 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium shadow-lg shadow-blue-500/20"
            >
              <Send className="w-5 h-5" />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
