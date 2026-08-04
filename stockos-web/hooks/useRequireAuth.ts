'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import type { AppRole } from '@/lib/auth/auth-context';

export function useRequireAuth(requiredRole?: AppRole) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
      return;
    }
    if (!loading && user && user.profile === null) {
      return;
    }
    if (!loading && user?.profile && user.profile.status === 'REJECTED') {
      router.push('/auth/login?error=rejected');
      return;
    }
    if (!loading && user?.profile && user.profile.status !== 'ACTIVE') {
      router.push('/auth/pending-approval');
      return;
    }
    if (
      requiredRole &&
      user?.profile?.status === 'ACTIVE' &&
      user.profile.role !== requiredRole &&
      user.profile.role !== 'ADMIN'
    ) {
      router.push('/unauthorized');
    }
  }, [user, loading, requiredRole, router]);

  return { user, loading };
}
