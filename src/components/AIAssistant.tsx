import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Database, AlertCircle, RefreshCw, DollarSign, Zap } from 'lucide-react';
import { databricksClient } from '../services/databricks';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<string | null>(null);
  const [requestsRemaining, setRequestsRemaining] = useState(5);
  const [usageStats, setUsageStats] = useState<{ requests: number; estimatedCost: number } | null>(null);
  const [useServerless, setUseServerless] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastRequestTime = useRef<number>(0);
  const requestCount = useRef<number>(0);
  const resetTime = useRef<number>(Date.now());

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

  useEffect(() => {
    fetchUsageStats();
  }, [userProfile]);

  const fetchUsageStats = async () => {
    if (!userProfile) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('ai_usage_log')
        .select('estimated_cost')
        .eq('user_id', userProfile.id)
        .gte('created_at', today.toISOString());

      if (error) throw error;

      const totalCost = data?.reduce((sum, record) => sum + parseFloat(record.estimated_cost), 0) || 0;
      setUsageStats({
        requests: data?.length || 0,
        estimatedCost: totalCost,
      });
    } catch (err) {
      console.error('Failed to fetch usage stats:', err);
    }
  };

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

      // Topics Summary with Full Details
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

        context += '=== DETAILED TOPICS LIST ===\n';
        context += 'Below is the complete list of all Kafka topics with full details:\n\n';
        topicsResult.data.forEach((topic, idx) => {
          context += `${idx + 1}. ${topic.name}\n`;
          context += `   Environment: ${topic.environment} | Cloud: ${topic.cloud_provider || 'N/A'} | Cluster: ${topic.cluster || 'N/A'}\n`;
          context += `   Status: ${topic.status} | Owner: ${topic.owner || 'N/A'}\n`;
          if (topic.description) context += `   Description: ${topic.description}\n`;
          if (topic.business_capability) context += `   Business Capability: ${topic.business_capability}\n`;
          if (topic.data_classification) context += `   Data Classification: ${topic.data_classification}\n`;
          if (topic.schema_registry_subject) context += `   Schema Subject: ${topic.schema_registry_subject}\n`;
          if (topic.schema_version) context += `   Schema Version: ${topic.schema_version}\n`;
          if (topic.icd_number) context += `   ICD Number: ${topic.icd_number}\n`;
          if (topic.icd_description) context += `   ICD Description: ${topic.icd_description}\n`;
          if (topic.naming_issues) context += `   ⚠️ Naming Issues: ${topic.naming_validation_details || 'Yes'}\n`;
          if (topic.partition_count) context += `   Partitions: ${topic.partition_count} | Replication: ${topic.replication_factor || 'N/A'}\n`;
          if (topic.retention_ms) context += `   Retention: ${Math.floor(topic.retention_ms / 86400000)} days\n`;
          if (topic.source_system) context += `   Source System: ${topic.source_system}\n`;
          context += '\n';
        });
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

      context += '=== END OF DASHBOARD DATA ===\n\n';
      context += '=== YOUR CAPABILITIES ===\n';
      context += 'You are an expert Kafka platform assistant with FULL ACCESS to the complete dashboard database.\n\n';
      context += 'IMPORTANT: You can see ALL topics with their complete details including:\n';
      context += '- Topic names, descriptions, owners\n';
      context += '- Schema information (registry subjects, versions, ICD numbers)\n';
      context += '- Configuration (partitions, replication, retention)\n';
      context += '- Environment, cloud provider, cluster information\n';
      context += '- Naming validation issues and recommendations\n';
      context += '- Business capabilities and data classifications\n\n';
      context += 'When users ask about specific topics (e.g., "EMAS topics", "payment topics"), you MUST:\n';
      context += '1. Search through the DETAILED TOPICS LIST above for matching names\n';
      context += '2. Provide specific details about those topics\n';
      context += '3. Offer schema analysis, configuration recommendations, and architectural advice\n';
      context += '4. Help with schema evolution, retention tuning, partition planning\n';
      context += '5. Identify related topics, lineage, and dependencies\n\n';
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

  const callServerlessAI = async (
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    userId?: string
  ): Promise<string> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const apiUrl = `${supabaseUrl}/functions/v1/databricks-sql-ai`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        user_id: userId,
        request_type: 'chat',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: Failed to get AI response`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  };

  const checkRateLimit = (): { allowed: boolean; waitTime?: number } => {
    const now = Date.now();
    const RATE_LIMIT_WINDOW = 60000;
    const MAX_REQUESTS_PER_MINUTE = 5;
    const MIN_TIME_BETWEEN_REQUESTS = 3000;

    if (now - resetTime.current > RATE_LIMIT_WINDOW) {
      requestCount.current = 0;
      resetTime.current = now;
      setRequestsRemaining(MAX_REQUESTS_PER_MINUTE);
    }

    const timeSinceLastRequest = now - lastRequestTime.current;
    if (timeSinceLastRequest < MIN_TIME_BETWEEN_REQUESTS) {
      const waitTime = MIN_TIME_BETWEEN_REQUESTS - timeSinceLastRequest;
      return { allowed: false, waitTime };
    }

    if (requestCount.current >= MAX_REQUESTS_PER_MINUTE) {
      const timeUntilReset = RATE_LIMIT_WINDOW - (now - resetTime.current);
      return { allowed: false, waitTime: timeUntilReset };
    }

    return { allowed: true };
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || isLoading) return;

    const rateLimitCheck = checkRateLimit();
    if (!rateLimitCheck.allowed) {
      const seconds = Math.ceil((rateLimitCheck.waitTime || 0) / 1000);
      setRateLimitInfo(`Please wait ${seconds} seconds before sending another message to avoid rate limits.`);
      setTimeout(() => setRateLimitInfo(null), rateLimitCheck.waitTime);
      return;
    }

    lastRequestTime.current = Date.now();
    requestCount.current += 1;
    setRequestsRemaining(5 - requestCount.current);

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
    setRateLimitInfo(null);

    try {
      const context = await fetchContextData();
      const systemMessage = context ? `You are a helpful assistant for a Kafka monitoring and incident management system. Use this context to answer questions:\n\n${context}` : '';

      const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
      if (systemMessage) {
        messages.push({ role: 'system', content: systemMessage });
      }
      messages.push({ role: 'user', content: textToSend });

      let response: string;
      if (useServerless) {
        // Use serverless SQL AI endpoint
        response = await callServerlessAI(messages, userProfile?.id);
      } else {
        // Use original provisioned endpoint
        response = await databricksClient.chat(messages, 2000, userProfile?.id, 'chat');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      fetchUsageStats();
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Casey 1.0 (AI Assistant)</h1>
              <p className="text-sm text-slate-600">
                Powered by Claude Opus 4.1 via Databricks {useServerless ? 'Serverless' : 'Provisioned'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setUseServerless(!useServerless)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                useServerless
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'bg-slate-50 border-slate-300 text-slate-700'
              }`}
            >
              <Zap className={`w-4 h-4 ${useServerless ? 'text-green-600' : 'text-slate-500'}`} />
              <span className="text-sm font-medium">
                {useServerless ? 'Serverless (99% cheaper)' : 'Provisioned ($144/day)'}
              </span>
            </button>
            {usageStats && (
              <div className="flex items-center gap-4 text-sm">
                <div className="text-right">
                  <div className="text-slate-600">Today's Usage</div>
                  <div className="font-semibold text-slate-900">{usageStats.requests} requests</div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <DollarSign className="w-4 h-4 text-amber-600" />
                  <div className="text-amber-900 font-semibold">
                    ~${usageStats.estimatedCost.toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {useServerless && (
        <div className="bg-green-50 border-b border-green-200 px-6 py-3">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-green-900 mb-1">Serverless Mode Active</div>
              <p className="text-sm text-green-800 mb-2">
                You're using Databricks Serverless SQL AI Functions. This costs ~$0.00044 per query (99% cheaper than provisioned).
              </p>
              <div className="flex gap-2 text-xs mt-2">
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-medium">Pay-per-query</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded">$0 when idle</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded">Sub-second startup</span>
              </div>
              <p className="text-xs text-green-700 mt-2">
                Setup required: Add <span className="font-mono bg-green-100 px-1 rounded">DATABRICKS_SQL_WAREHOUSE_ID</span> to your environment.
                See <span className="font-mono bg-green-100 px-1 rounded">SERVERLESS_SQL_SETUP_STEPS.md</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {!useServerless && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-amber-900 mb-1">Provisioned Endpoint Mode</div>
              <p className="text-sm text-amber-800 mb-2">
                This endpoint costs $144/day (24/7 running). Click "Serverless" above to switch to pay-per-query pricing and save 99%.
              </p>
              <div className="flex gap-2 text-xs mt-2">
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded font-medium">$144/day fixed cost</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">Switch to Serverless recommended</span>
              </div>
            </div>
          </div>
        </div>
      )}

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
                I have full access to your Kafka platform database with complete details on all topics, schemas, alerts, incidents, performance metrics, lineage, and on-call rotation. Ask me about specific topics, schema changes, recommendations, or anything else!
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

      {rateLimitInfo && (
        <div className="px-6 pb-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-2 text-amber-700">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{rateLimitInfo}</span>
          </div>
        </div>
      )}

      <div className="bg-white border-t border-slate-200 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1"></div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span>Rate Limit: {requestsRemaining}/5 per minute</span>
              {requestsRemaining <= 2 && (
                <span className="text-amber-600 font-medium">Wait 3s between requests</span>
              )}
            </div>
          </div>
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
