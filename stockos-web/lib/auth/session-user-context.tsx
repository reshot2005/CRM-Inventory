'use client';

import { createContext, useContext, useMemo } from 'react';
import type { AppRole } from '@/lib/auth/auth-context';

export interface SessionUser {
  userId: string;
  name: string;
  email: string;
  role: AppRole;
  status: string;
}

const SessionUserContext = createContext<SessionUser | null>(null);

export function SessionUserProvider({
  value,
  children,
}: {
  value: SessionUser;
  children: React.ReactNode;
}) {
  const memo = useMemo(() => value, [value.userId, value.name, value.email, value.role, value.status]);
  return (
    <SessionUserContext.Provider value={memo}>
      {children}
    </SessionUserContext.Provider>
  );
}

export function useSessionUser(): SessionUser | null {
  return useContext(SessionUserContext);
}
