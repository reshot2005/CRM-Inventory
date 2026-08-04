'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';

function apiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001'
  );
}

export default function PendingApprovalPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const checkStatus = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return;
    }
    const r = await fetch(`${apiBase()}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    });
    if (!r.ok) {
      return;
    }
    const body = (await r.json()) as { data: { status: string } };
    if (body.data.status === 'ACTIVE') {
      router.push('/dashboard');
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    void checkStatus();
    const id = setInterval(() => void checkStatus(), 30_000);
    return () => clearInterval(id);
  }, [checkStatus]);

  const email =
    user?.profile?.email ?? user?.supabaseUser.email ?? 'your email';

  return (
    <main
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: '#F0F4FF' }}
    >
      <div className="w-full max-w-lg rounded-xl border border-[#E2E8F0] bg-white p-8 shadow-[0_1px_4px_rgba(30,42,74,0.07)]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[#1E2B4A] text-lg font-bold text-white">
            S
          </div>
          <h1 className="text-xl font-semibold text-[#0F172A]">
            Pending admin approval
          </h1>
        </div>
        <p className="text-sm font-medium text-[#0F172A]">
          {user?.profile?.name ?? user?.supabaseUser.user_metadata?.name ?? 'User'}
        </p>
        <p className="mt-1 text-sm text-[#64748B]">{email}</p>
        <p className="mt-6 text-sm text-[#334155]">
          Your account is pending admin approval. An administrator will review your
          registration and grant access. You will receive an email at{' '}
          <span className="font-medium text-[#0F172A]">{email}</span> once your
          account is activated.
        </p>
        <p className="mt-4 text-xs text-[#94A3B8]">
          This page checks your status every 30 seconds — no need to refresh.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md border border-[#E2E8F0] px-4 py-2 text-sm text-[#334155]"
          >
            Sign out
          </button>
          <Link
            href="/"
            className="rounded-md px-4 py-2 text-sm text-[#1E90FF] underline"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
