import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, AlertTriangle, Ban } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireEditor?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false, requireEditor = false }: ProtectedRouteProps) {
  const { userProfile, isAdmin, isEditor, isActive, isLoading } = useAuth();

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

  if (!userProfile) {
    return null;
  }

  if (!isActive) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-lg shadow-xl p-8 border border-slate-700 max-w-md w-full text-center">
          <Ban className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">Account Disabled</h2>
          <p className="text-slate-300 mb-6">
            Your account has been disabled. Please contact an administrator.
          </p>
          <div className="bg-slate-900 rounded p-4 border border-slate-700">
            <p className="text-sm text-slate-400">
              <strong className="text-slate-300">Status:</strong> {userProfile.status}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              <strong className="text-slate-300">Email:</strong> {userProfile.email}
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
            This feature requires administrator privileges.
          </p>
          <div className="bg-slate-900 rounded p-4 border border-slate-700">
            <p className="text-sm text-slate-400">
              <strong className="text-slate-300">Your Role:</strong> {userProfile.role}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (requireEditor && !isEditor) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-lg shadow-xl p-8 border border-slate-700 max-w-md w-full text-center">
          <Shield className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">Editor Access Required</h2>
          <p className="text-slate-300 mb-6">
            This feature requires editor or admin privileges.
          </p>
          <div className="bg-slate-900 rounded p-4 border border-slate-700">
            <p className="text-sm text-slate-400">
              <strong className="text-slate-300">Your Role:</strong> {userProfile.role}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
