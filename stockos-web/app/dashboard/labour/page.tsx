'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Week3DeferredPage from '@/components/dashboard/Week3DeferredPage';

/** Standalone Labour nav stub removed — logging lives in Production drawer. */
export default function LabourPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/production');
  }, [router]);

  return (
    <Week3DeferredPage
      title="Labour"
      description="Labour logging is managed from Manufacturing / Production — redirecting…"
    />
  );
}
