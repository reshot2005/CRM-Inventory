'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function apiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001'
  );
}

/** Only allow same-origin relative paths (blocks open redirects). */
function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

interface MeProfile {
  status: string;
  name: string;
  email: string;
}

function StockOSMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="stockos-ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F05A28" />
          <stop offset="45%" stopColor="#E03D4A" />
          <stop offset="100%" stopColor="#C41E6A" />
        </linearGradient>
      </defs>
      <circle
        cx="20"
        cy="20"
        r="15"
        fill="none"
        stroke="url(#stockos-ring)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="72 22"
        transform="rotate(-35 20 20)"
      />
    </svg>
  );
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[200px] xl:w-[230px]">
      <div className="rounded-[2.1rem] border-[5px] border-[#2e2e2e] bg-[#0d0d0d] p-1.5 shadow-[0_40px_90px_rgba(0,0,0,0.65)]">
        <div className="overflow-hidden rounded-[1.6rem] bg-[#151515] px-3.5 pb-5 pt-3.5 text-white">
          <div className="mb-5 flex items-center justify-between text-[10px] text-white/55">
            <span className="font-medium">9:41</span>
            <span className="h-1.5 w-14 rounded-full bg-white/25" />
            <span className="tracking-tighter">●●●</span>
          </div>
          <p className="text-[11px] text-white/50">Stock value</p>
          <p className="mt-0.5 text-[1.65rem] font-bold tracking-tight">
            ₹8,97,000
          </p>
          <div className="mt-6 flex h-28 items-end gap-1 px-0.5">
            {[42, 62, 38, 78, 52, 90, 68, 82, 48, 95, 58, 74].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-[2px]"
                style={{
                  height: `${h}%`,
                  background:
                    i % 3 === 0
                      ? 'linear-gradient(180deg,#F05A28 0%,#C41E6A 100%)'
                      : 'rgba(255,255,255,0.88)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('message') === 'password_updated') {
      setInfo('Password updated. Please log in.');
    }
  }, [searchParams]);

  useEffect(() => {
    const q = searchParams.get('error');
    if (q === 'auth_callback') {
      setError(
        'Could not complete sign-in from email link. Try again or sign in manually.',
      );
    } else if (q === 'missing_supabase_env') {
      setError('App configuration error: Supabase URL or anon key is missing.');
    } else if (q === 'rejected') {
      setError('Your account was not approved. Contact administrator.');
    }
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const supabase = createClient();
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr) {
      setSubmitting(false);
      setError(signErr.message);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setSubmitting(false);
      setError('No session after sign-in.');
      return;
    }

    const sync = await fetch(`${apiBase()}/api/v1/auth/sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!sync.ok) {
      setSubmitting(false);
      setError('Could not sync profile with server.');
      return;
    }

    const me = await fetch(`${apiBase()}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!me.ok) {
      setSubmitting(false);
      setError('Could not load profile.');
      return;
    }
    const body = (await me.json()) as { data: MeProfile };
    const status = body.data.status;
    setSubmitting(false);

    if (status === 'PENDING') {
      router.push('/auth/pending-approval');
      router.refresh();
      return;
    }
    if (status === 'REJECTED') {
      setError('Your account was not approved. Contact administrator.');
      return;
    }
    router.push(safeNextPath(searchParams.get('next')) ?? '/dashboard');
    router.refresh();
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1c1917] font-body">
      {/* Left promotional panel */}
      <section className="relative hidden min-h-screen w-[44%] flex-col px-12 pb-8 pt-14 lg:flex xl:w-[42%] xl:px-16">
        <p className="max-w-[260px] text-[13px] leading-[1.55] text-white/50">
          Factory inventory made simple — real-time stock control for you.
        </p>

        <div className="relative flex flex-1 flex-col">
          {/* Concentric circles behind headline + phone */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[42%] top-[48%] h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2"
          >
            {[200, 290, 380, 470, 560].map((size) => (
              <div
                key={size}
                className="absolute left-1/2 top-1/2 rounded-full border border-white/[0.07]"
                style={{
                  width: size,
                  height: size,
                  marginLeft: -size / 2,
                  marginTop: -size / 2,
                }}
              />
            ))}
          </div>

          <h1 className="relative z-10 mt-[18vh] max-w-[300px] font-heading text-[3rem] font-bold leading-[1.08] tracking-tight text-white xl:text-[3.5rem]">
            Manage your stock
          </h1>

          <div className="relative z-10 mt-auto flex justify-center pb-2">
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* Right white card with large rounded left edge */}
      <section className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.18)] lg:left-[40%] lg:w-auto lg:rounded-l-[4.5rem] xl:left-[38%] xl:rounded-l-[5.5rem]">
        <div className="flex items-center justify-between px-7 pt-7 sm:px-10 lg:px-14 lg:pt-9">
          <Link href="/" className="flex items-center gap-2.5">
            <StockOSMark className="h-9 w-9" />
            <span className="font-heading text-[1.4rem] font-bold tracking-tight text-[#1a1a1a]">
              StockOS
            </span>
          </Link>
          <Link
            href="/auth/register"
            className="flex items-center gap-2 text-[14px] font-medium text-[#1a1a1a] transition-opacity hover:opacity-65"
          >
            <UserRound className="h-[18px] w-[18px]" strokeWidth={1.75} />
            Sign Up
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-center px-7 py-10 sm:px-10 lg:px-14 xl:px-24">
          <div className="mx-auto w-full max-w-[420px] lg:mx-0 lg:max-w-[440px]">
            <h2 className="font-heading text-[2.75rem] font-bold tracking-tight text-[#1a1a1a] sm:text-[3rem]">
              Sign In
            </h2>

            <form onSubmit={(e) => void onSubmit(e)} className="mt-11 space-y-4">
              <div>
                <label htmlFor="login-email" className="sr-only">
                  Email or Username
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email or Username"
                  className="h-[56px] w-full rounded-full border border-[#d0d0d0] bg-white px-7 text-[15px] text-[#1a1a1a] outline-none transition placeholder:text-[#9b9b9b] focus:border-[#F05A28] focus:ring-[3px] focus:ring-[#F05A28]/12"
                />
              </div>

              <div className="relative">
                <label htmlFor="login-password" className="sr-only">
                  Password
                </label>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="h-[56px] w-full rounded-full border border-[#d0d0d0] bg-white px-7 pr-14 text-[15px] text-[#1a1a1a] outline-none transition placeholder:text-[#9b9b9b] focus:border-[#F05A28] focus:ring-[3px] focus:ring-[#F05A28]/12"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-[#8a8a8a] transition hover:text-[#1a1a1a]"
                >
                  {showPassword ? (
                    <Eye className="h-5 w-5" strokeWidth={1.75} />
                  ) : (
                    <EyeOff className="h-5 w-5" strokeWidth={1.75} />
                  )}
                </button>
              </div>

              <div className="pt-1">
                <Link
                  href="/auth/forgot-password"
                  className="text-[14px] font-medium text-[#d45a2c] transition hover:text-[#b8481f]"
                >
                  Forgot password?
                </Link>
              </div>

              {info ? (
                <p role="status" className="text-sm text-emerald-700">
                  {info}
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="mt-3 flex h-[56px] w-full items-center justify-center gap-2.5 rounded-full text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(220,70,60,0.38)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background:
                    'linear-gradient(100deg, #F05A28 0%, #E03D4A 45%, #C41E6A 100%)',
                }}
              >
                <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.5} />
                {submitting ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>

        <footer className="flex items-center justify-between px-7 pb-7 text-[12px] text-[#9a9a9a] sm:px-10 lg:px-14">
          <p>{`© 2024–${new Date().getFullYear()} StockOS`}</p>
          <div className="flex items-center gap-6">
            <Link href="/" className="transition hover:text-[#1a1a1a]">
              Contact Us
            </Link>
            <span className="inline-flex items-center gap-1.5">
              English
              <svg
                width="10"
                height="6"
                viewBox="0 0 10 6"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M1 1l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </footer>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#1a1714]">
          <p className="text-white/60">Loading…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
