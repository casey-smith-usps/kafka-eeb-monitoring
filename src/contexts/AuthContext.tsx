import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'editor' | 'viewer';
  status: 'active' | 'pending' | 'disabled';
  access_token: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  isEditor: boolean;
  isActive: boolean;
  isLoading: boolean;
  signIn: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signInWithToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loginAtRef = useRef<Date | null>(null);
  const activityLogIdRef = useRef<string | null>(null);

  const logActivity = async (
    email: string,
    userId: string | null,
    eventType: 'login' | 'logout' | 'session_expired',
    loginAt?: Date,
    logoutAt?: Date
  ) => {
    const durationSeconds =
      loginAt && logoutAt
        ? Math.round((logoutAt.getTime() - loginAt.getTime()) / 1000)
        : null;

    const { data } = await supabase.from('user_activity_log').insert([{
      user_id: userId,
      email,
      event_type: eventType,
      login_at: eventType === 'login' ? (loginAt ?? new Date()).toISOString() : null,
      logout_at: logoutAt ? logoutAt.toISOString() : null,
      duration_seconds: durationSeconds,
      user_agent: navigator.userAgent.slice(0, 500),
    }]).select('id').maybeSingle();

    return data?.id ?? null;
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      if (data) {
        await supabase
          .from('user_profiles')
          .update({ last_access: new Date().toISOString() })
          .eq('id', data.id);
      }

      return data as UserProfile | null;
    } catch (error) {
      console.error('Exception fetching user profile:', error);
      return null;
    }
  };

  const refreshUserProfile = async () => {
    if (user) {
      const profile = await fetchUserProfile(user.id);
      setUserProfile(profile);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id).then((profile) => {
          setUserProfile(profile);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          setUserProfile(profile);
        } else if (event === 'SIGNED_OUT') {
          setUserProfile(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, _password?: string) => {
    try {
      if (!email.toLowerCase().endsWith('@usps.gov')) {
        return { success: false, error: 'Access is restricted to @usps.gov email addresses only.' };
      }

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', email)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        return { success: false, error: 'Failed to authenticate' };
      }

      if (!profile) {
        return { success: false, error: 'User not found or account not active' };
      }

      if (profile.access_token) {
        localStorage.setItem('access_token', profile.access_token);
      }

      setUserProfile(profile as UserProfile);

      const now = new Date();
      loginAtRef.current = now;

      await supabase
        .from('user_profiles')
        .update({ last_access: now.toISOString() })
        .eq('id', profile.id);

      const logId = await logActivity(email, profile.id, 'login', now);
      activityLogIdRef.current = logId;

      return { success: true };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: 'Failed to authenticate' };
    }
  };

  const signInWithToken = async (token: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('access_token', token)
        .eq('status', 'active')
        .maybeSingle();

      if (error || !profile) {
        return { success: false, error: 'Invalid token' };
      }

      localStorage.setItem('access_token', token);
      setUserProfile(profile as UserProfile);

      const now = new Date();
      loginAtRef.current = now;

      await supabase
        .from('user_profiles')
        .update({ last_access: now.toISOString() })
        .eq('id', profile.id);

      const logId = await logActivity(profile.email, profile.id, 'login', now);
      activityLogIdRef.current = logId;

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to authenticate' };
    }
  };

  const signOut = async () => {
    const profile = userProfile;
    const loginAt = loginAtRef.current;
    const logoutAt = new Date();

    await supabase.auth.signOut();
    localStorage.removeItem('access_token');

    if (profile) {
      await logActivity(
        profile.email,
        profile.id,
        'logout',
        loginAt ?? undefined,
        logoutAt
      );
    }

    loginAtRef.current = null;
    activityLogIdRef.current = null;
    setUser(null);
    setUserProfile(null);
  };

  const isAdmin = userProfile?.role === 'admin';
  const isEditor = userProfile?.role === 'editor' || userProfile?.role === 'admin';
  const isActive = userProfile?.status === 'active';

  const value = {
    user,
    userProfile,
    isAdmin,
    isEditor,
    isActive,
    isLoading,
    signIn,
    signInWithToken,
    signOut,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
