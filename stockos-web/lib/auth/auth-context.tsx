'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { createClient } from '../supabase/client';

export type AppRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER';

export interface AppProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  jobTitle: string | null;
  role: AppRole;
  status: string;
  allowedLocations: string[];
  permissions: string[];
}

interface AppUser {
  supabaseUser: User;
  profile: AppProfile | null;
  accessToken: string;
}

export interface SignUpResult {
  error: string | null;
  /** True when Supabase requires email confirmation before a session exists */
  needsEmailConfirmation: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (input: {
    email: string;
    password: string;
    name: string;
    phone: string;
    companyName: string;
    jobTitle?: string;
  }) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  resendConfirmationEmail: (
    email: string,
  ) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function apiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001'
  );
}

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const cancelledRef = useRef(false);

  const fetchProfile = useCallback(
    async (accessToken: string): Promise<AppProfile | null> => {
      try {
        const response = await fetch(`${apiBase()}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
          return null;
        }
        const json = (await response.json()) as { data: AppProfile };
        return json.data;
      } catch {
        return null;
      }
    },
    [],
  );

  /** Apply session immediately so pages can query; Nest sync runs in background. */
  const applySession = useCallback((session: Session) => {
    setUser((prev) => ({
      supabaseUser: session.user,
      accessToken: session.access_token,
      profile: prev?.profile ?? null,
    }));
  }, []);

  const syncWithBackend = useCallback(
    async (session: Session) => {
      applySession(session);

      try {
        await fetch(`${apiBase()}/api/v1/auth/sync`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (err) {
        console.error(
          `Could not reach API at ${apiBase()} — is stockos-api running?`,
          err,
        );
      }

      const profile = await fetchProfile(session.access_token);
      if (!cancelledRef.current) {
        setUser({
          supabaseUser: session.user,
          profile,
          accessToken: session.access_token,
        });
      }
    },
    [applySession, fetchProfile],
  );

  useEffect(() => {
    cancelledRef.current = false;

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelledRef.current) return;
      if (session) {
        applySession(session);
        setLoading(false);
        void syncWithBackend(session);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        applySession(session);
        void syncWithBackend(session);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setUser((prev) =>
          prev
            ? { ...prev, accessToken: session.access_token }
            : null,
        );
      }
    });

    return () => {
      cancelledRef.current = true;
      subscription.unsubscribe();
    };
  }, [supabase, syncWithBackend, applySession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const signUp = useCallback(
    async (input: {
      email: string;
      password: string;
      name: string;
      phone: string;
      companyName: string;
      jobTitle?: string;
    }): Promise<SignUpResult> => {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            name: input.name,
            phone: input.phone,
            company_name: input.companyName,
            ...(input.jobTitle?.trim()
              ? { job_title: input.jobTitle.trim() }
              : {}),
          },
          emailRedirectTo: `${appBaseUrl()}/auth/callback`,
        },
      });
      if (error) {
        return { error: error.message, needsEmailConfirmation: false };
      }
      const needsEmailConfirmation = !data.session;
      return { error: null, needsEmailConfirmation };
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const resetPassword = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appBaseUrl()}/auth/callback?next=/auth/reset-password`,
      });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const resendConfirmationEmail = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${appBaseUrl()}/auth/callback`,
        },
      });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      resendConfirmationEmail,
    }),
    [
      user,
      loading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      resendConfirmationEmail,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
