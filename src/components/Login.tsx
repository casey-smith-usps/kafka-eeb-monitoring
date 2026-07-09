import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
<<<<<<< HEAD
import { LogIn, AlertCircle, Mail } from 'lucide-react';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
=======
import { LogIn, AlertCircle, Key } from 'lucide-react';

export default function Login() {
  const { signInWithToken } = useAuth();
  const [token, setToken] = useState('');
>>>>>>> 6bc78242c88c95991dd5e273c0e0936c4196082e
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
<<<<<<< HEAD

    if (!email.toLowerCase().endsWith('@usps.gov')) {
      setError('Access is restricted to @usps.gov email addresses only.');
      return;
    }

    setLoading(true);

    try {
      const result = await signIn(email);
      if (!result.success) {
        setError(result.error || 'Invalid email or account not active');
=======
    setLoading(true);

    try {
      const result = await signInWithToken(token);
      if (!result.success) {
        setError(result.error || 'Invalid access token');
>>>>>>> 6bc78242c88c95991dd5e273c0e0936c4196082e
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
<<<<<<< HEAD
              <Mail className="w-8 h-8 text-white" />
=======
              <Key className="w-8 h-8 text-white" />
>>>>>>> 6bc78242c88c95991dd5e273c0e0936c4196082e
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              EEB Kafka Dashboard
            </h1>
            <p className="text-slate-400">
<<<<<<< HEAD
              Sign in to your account
=======
              Enter your access token to continue
>>>>>>> 6bc78242c88c95991dd5e273c0e0936c4196082e
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
<<<<<<< HEAD
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
=======
              <label htmlFor="token" className="block text-sm font-medium text-slate-300 mb-2">
                Access Token
              </label>
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="Enter your access token"
              />
              <p className="mt-2 text-xs text-slate-400">
                Contact an administrator to receive your access token
>>>>>>> 6bc78242c88c95991dd5e273c0e0936c4196082e
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
<<<<<<< HEAD
                <span>Signing in...</span>
=======
                <span>Authenticating...</span>
>>>>>>> 6bc78242c88c95991dd5e273c0e0936c4196082e
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
<<<<<<< HEAD
              <strong className="text-slate-300">Need access?</strong>{' '}
              <a href="/" className="text-blue-400 hover:text-blue-300 underline">
                Request access here
              </a>
=======
              <strong className="text-slate-300">Note:</strong> Access tokens are provided by system administrators. If you need access, please contact your team administrator.
>>>>>>> 6bc78242c88c95991dd5e273c0e0936c4196082e
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-slate-400">
          <p>Enterprise Event Bus Monitoring Platform</p>
          <p className="mt-1">Secure access required</p>
        </div>
      </div>
    </div>
  );
}
