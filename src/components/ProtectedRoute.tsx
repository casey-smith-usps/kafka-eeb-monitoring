import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, AlertTriangle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, userRole, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !userRole) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-lg shadow-xl p-8 border border-slate-700 max-w-md w-full text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">Access Pending</h2>
          <p className="text-slate-300 mb-6">
            Your account has been created, but you don't have access yet. Please contact an administrator to assign you a role.
          </p>
          <div className="bg-slate-900 rounded p-4 border border-slate-700">
            <p className="text-sm text-slate-400">
              <strong className="text-slate-300">Your Email:</strong> {user?.email}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-lg shadow-xl p-8 border border-slate-700 max-w-md w-full text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">Admin Access Required</h2>
          <p className="text-slate-300 mb-6">
            This feature requires administrator privileges. You are currently signed in as a viewer.
          </p>
          <div className="bg-slate-900 rounded p-4 border border-slate-700">
            <p className="text-sm text-slate-400">
              <strong className="text-slate-300">Your Role:</strong> {userRole.role}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
