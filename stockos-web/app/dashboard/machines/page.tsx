'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Week3DeferredPage from '@/components/dashboard/Week3DeferredPage';

/** Standalone Machines nav stub removed — functionality lives in Production. */
export default function MachinesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/production');
  }, [router]);

  return (
    <Week3DeferredPage
      title="Machines"
      description="Machine scheduling is managed from Manufacturing / Production — redirecting…"
    />
  );
}
