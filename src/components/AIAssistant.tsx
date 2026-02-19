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
      label: 'Analyze Recent Alerts',
      prompt: 'Analyze the most recent critical alerts and provide insights',
      icon: <AlertCircle className="w-4 h-4" />,
    },
    {
      label: 'Topic Health Summary',
      prompt: 'Give me a summary of Kafka topic health across all environments',
      icon: <Database className="w-4 h-4" />,
    },
    {
      label: 'Incident Trends',
      prompt: 'What are the common patterns in recent incidents?',
      icon: <RefreshCw className="w-4 h-4" />,
    },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchContextData = async () => {
    try {
      const [alertsResult, topicsResult] = await Promise.all([
        supabase
          .from('alerts')
          .select('alert_type, severity, environment, status')
          .order('created_at', { ascending: false })
          .limit(10)
          .then(res => res.error ? { data: [], error: res.error } : res),
        supabase
          .from('topics')
          .select('name, environment, cloud_provider, status')
          .order('created_at', { ascending: false })
          .limit(20)
          .then(res => res.error ? { data: [], error: res.error } : res),
      ]);

      let context = 'Current System State:\n\n';

      if (alertsResult.data && alertsResult.data.length > 0) {
        context += 'Recent Alerts:\n';
        alertsResult.data.forEach((alert, idx) => {
          context += `${idx + 1}. ${alert.alert_type} - ${alert.severity} (${alert.environment}) - ${alert.status}\n`;
        });
        context += '\n';
      }

      if (topicsResult.data && topicsResult.data.length > 0) {
        context += 'Kafka Topics:\n';
        const envGroups = topicsResult.data.reduce((acc, topic) => {
          if (!acc[topic.environment]) acc[topic.environment] = 0;
          acc[topic.environment]++;
          return acc;
        }, {} as Record<string, number>);

        Object.entries(envGroups).forEach(([env, count]) => {
          context += `- ${env}: ${count} topics\n`;
        });
      }

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
                Ask me about your Kafka topics, incidents, alerts, or system health
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
