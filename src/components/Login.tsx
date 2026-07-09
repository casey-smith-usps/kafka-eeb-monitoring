import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, AlertCircle, Mail } from 'lucide-react';

interface LoginProps {
  onShowRequestAccess?: () => void;
}

export default function Login({ onShowRequestAccess }: LoginProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.toLowerCase().endsWith('@usps.gov')) {
      setError('Access is restricted to @usps.gov email addresses only.');
      return;
    }

    setLoading(true);

    try {
      const result = await signIn(email);
      if (!result.success) {
        setError(result.error || 'Invalid email or account not active');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 rounded-lg shadow-2xl p-8 border border-slate-700">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              EEB Kafka Dashboard
            </h1>
            <p className="text-slate-400">
              Sign in to your account
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="firstname.lastname@usps.gov"
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                USPS network credentials required — @usps.gov addresses only
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-slate-900 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400">
              <strong className="text-slate-300">Need access?</strong>{' '}
              <button
<<<<<<< HEAD
                onClick={() => onShowRequestAccess?.()}
=======
                onClick={() => window.location.search = ''}
>>>>>>> e9125b2b0d26e410bf42439ee467f41686918854
                className="text-blue-400 hover:text-blue-300 underline cursor-pointer bg-transparent border-none p-0"
              >
                Request access here
              </button>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-slate-400">
          <p>Enterprise Event Broker Monitoring Platform</p>
          <p className="mt-1">Secure access required</p>
        </div>
      </div>
    </div>
  );
}
