'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { useSessionUser } from '@/lib/auth/session-user-context';

/** Prefers RSC layout userId so queries start before Nest sync finishes. */
export function useUserId(): string | null {
  const session = useSessionUser();
  const { user } = useAuth();
  return session?.userId ?? user?.supabaseUser?.id ?? null;
}
