'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    const { error: err } = await resetPassword(email);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    setMessage('Password reset link sent. Check your email.');
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
          <h1 className="text-xl font-semibold text-[#0F172A]">Forgot password</h1>
        </div>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <label className="block text-sm font-medium text-[#334155]">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? (
            <p className="text-sm text-emerald-700">{message}</p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md py-2.5 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#1E90FF' }}
          >
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link href="/auth/login" className="text-[#1E90FF] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
