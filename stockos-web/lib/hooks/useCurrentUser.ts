'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient, type Tables } from '@/lib/supabase/client';
import { useSessionUser } from '@/lib/auth/session-user-context';

type Profile = Tables<'profiles'>;

/** Auth user + profile. Prefer SessionUserProvider userId when in dashboard. */
export function useCurrentUser() {
  const sessionUser = useSessionUser();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        void supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (!cancelled) {
              setProfile(data);
              setLoading(false);
            }
          });
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const userId = sessionUser?.userId ?? user?.id ?? null;

  return { user, profile, loading, userId };
}
