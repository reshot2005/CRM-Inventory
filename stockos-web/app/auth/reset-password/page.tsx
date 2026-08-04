'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters');
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push('/auth/login?message=password_updated');
    router.refresh();
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: '#F0F4FF' }}
    >
      <div className="w-full max-w-md rounded-xl border border-[#E2E8F0] bg-white p-8 shadow-[0_1px_4px_rgba(30,42,74,0.07)]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[#1E2B4A] text-lg font-bold text-white">
            S
          </div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Set new password</h1>
        </div>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <label className="block text-sm font-medium text-[#334155]">
            New password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-[#334155]">
            Confirm password
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md py-2.5 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#1E90FF' }}
          >
            {submitting ? 'Saving…' : 'Update password'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link href="/auth/login" className="text-[#1E90FF] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
