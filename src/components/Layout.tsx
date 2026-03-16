import { ReactNode, useEffect, useState } from 'react';
import { LayoutDashboard, ListChecks, AlertCircle, GitBranch, Activity, FileText, Network, Phone, Sparkles, Radio, LogOut, User, Shield, Users, CreditCard as Edit3, Database, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface LayoutProps {
  children: ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
}

export default function Layout({ children, currentView, onViewChange }: LayoutProps) {
  const { user, userProfile, isAdmin, signOut } = useAuth();
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    if (isAdmin) {
      fetchPendingRequestsCount();

      const subscription = supabase
        .channel('access_requests_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'access_requests'
        }, () => {
          fetchPendingRequestsCount();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [isAdmin]);

  const fetchPendingRequestsCount = async () => {
    try {
      const { count, error } = await supabase
        .from('access_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (!error && count !== null) {
        setPendingRequestsCount(count);
      }
    } catch (err) {
      console.error('Error fetching pending requests count:', err);
    }
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'topics', label: 'All Topics', icon: ListChecks },
    { id: 'standup', label: 'Morning Standup', icon: Activity },
    { id: 'alerts', label: 'Alerts', icon: AlertCircle },
    { id: 'lineage', label: 'Cross-System Lineage', icon: GitBranch },
    { id: 'data-freshness', label: 'Data Freshness', icon: Clock },
    { id: 'streaming', label: 'Data Streaming', icon: Radio, adminOnly: true },
    { id: 'oncall', label: 'On-Call & Escalation', icon: Phone },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Sparkles },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'architecture', label: 'Architecture', icon: Network },
    { id: 'users', label: 'User Management', icon: Users, adminOnly: true },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="bg-white border-b border-slate-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Kafka EEB Monitoring</h1>
                <p className="text-sm text-slate-500">Event-Driven Ingestion Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-4 border-r border-slate-200 pr-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-700">
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {user?.email}
                  </p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 justify-end mt-0.5">
                    {userProfile?.role === 'admin' ? (
                      <>
                        <Shield className="w-3 h-3 text-red-600" />
                        <span className="text-red-600 font-medium">Administrator</span>
                      </>
                    ) : userProfile?.role === 'editor' ? (
                      <>
                        <Edit3 className="w-3 h-3 text-blue-600" />
                        <span className="text-blue-600 font-medium">Editor</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3 h-3 text-slate-600" />
                        <span>Viewer</span>
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-73px)] shadow-sm">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              const isHidden = item.adminOnly && !isAdmin;

              if (isHidden) return null;

              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-medium shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.id === 'users' && pendingRequestsCount > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full animate-pulse">
                      {pendingRequestsCount}
                    </span>
                  )}
                  {item.adminOnly && item.id !== 'users' && (
                    <Shield className="w-3 h-3 text-blue-600" title="Admin Only" />
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
