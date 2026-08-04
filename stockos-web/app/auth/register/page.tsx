'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';

/** Only allow same-origin relative paths (blocks open redirects). */
function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

const schema = z
  .object({
    name: z.string().min(2, 'Enter your full name'),
    email: z.string().email('Enter a valid email'),
    phone: z
      .string()
      .min(8, 'Enter a valid phone number')
      .max(24, 'Phone is too long')
      .regex(
        /^[\d\s+().-]{8,24}$/,
        'Use digits and optional + ( ) space -',
      ),
    companyName: z
      .string()
      .min(2, 'Company name is required')
      .max(200, 'Company name is too long'),
    jobTitle: z.string().max(120, 'Too long'),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Need one uppercase letter')
      .regex(/[0-9]/, 'Need one number'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type FormValues = z.infer<typeof schema>;

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
  );
}

const inputClass =
  'mt-1 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20';

function RegisterForm() {
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get('next'));
  const loginHref = nextPath
    ? `/auth/login?next=${encodeURIComponent(nextPath)}`
    : '/auth/login';

  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      companyName: '',
      jobTitle: '',
      password: '',
      confirm: '',
    },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          name: values.name.trim(),
          phone: values.phone.trim(),
          company_name: values.companyName.trim(),
          ...(values.jobTitle?.trim()
            ? { job_title: values.jobTitle.trim() }
            : {}),
        },
        emailRedirectTo: nextPath
          ? `${appBaseUrl()}/auth/callback?next=${encodeURIComponent(nextPath)}`
          : `${appBaseUrl()}/auth/callback`,
      },
    });
    setSubmitting(false);
    if (error) {
      setServerError(error.message);
      return;
    }
    setDone(true);
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ backgroundColor: '#F0F4FF' }}
    >
      <div className="w-full max-w-lg rounded-xl border border-[#E2E8F0] bg-white p-8 shadow-[0_1px_4px_rgba(30,42,74,0.07)]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[#1E2B4A] text-lg font-bold text-white">
            S
          </div>
          <h1 className="text-xl font-semibold text-[#0F172A]">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Tell us who you are and where you work. An admin will approve access.
          </p>
        </div>

        {done ? (
          <div className="space-y-4 text-center text-sm text-[#334155]">
            <p>
              Check your email to verify your account. Once verified, an admin will
              review your registration and activate your access.
            </p>
            <Link href={loginHref} className="inline-block text-[#2563EB] hover:underline font-medium">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit((v) => void onSubmit(v))}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#334155] sm:col-span-2">
                Full name
                <input {...form.register('name')} className={inputClass} autoComplete="name" />
                {form.formState.errors.name ? (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.name.message}
                  </p>
                ) : null}
              </label>
              <label className="block text-sm font-medium text-[#334155] sm:col-span-2">
                Work email
                <input
                  type="email"
                  {...form.register('email')}
                  className={inputClass}
                  autoComplete="email"
                />
                {form.formState.errors.email ? (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.email.message}
                  </p>
                ) : null}
              </label>
              <label className="block text-sm font-medium text-[#334155]">
                Phone
                <input
                  type="tel"
                  {...form.register('phone')}
                  className={inputClass}
                  autoComplete="tel"
                  placeholder="+91 …"
                />
                {form.formState.errors.phone ? (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.phone.message}
                  </p>
                ) : null}
              </label>
              <label className="block text-sm font-medium text-[#334155]">
                Job title{' '}
                <span className="font-normal text-[#94A3B8]">(optional)</span>
                <input
                  {...form.register('jobTitle')}
                  className={inputClass}
                  autoComplete="organization-title"
                  placeholder="e.g. Warehouse lead"
                />
                {form.formState.errors.jobTitle ? (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.jobTitle.message}
                  </p>
                ) : null}
              </label>
              <label className="block text-sm font-medium text-[#334155] sm:col-span-2">
                Company / organization name
                <input
                  {...form.register('companyName')}
                  className={inputClass}
                  autoComplete="organization"
                  placeholder="Legal or trading name"
                />
                {form.formState.errors.companyName ? (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.companyName.message}
                  </p>
                ) : null}
              </label>
            </div>

            <div className="border-t border-[#E2E8F0] pt-4 space-y-4">
              <label className="block text-sm font-medium text-[#334155]">
                Password
                <input
                  type="password"
                  {...form.register('password')}
                  className={inputClass}
                  autoComplete="new-password"
                />
                {form.formState.errors.password ? (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.password.message}
                  </p>
                ) : null}
              </label>
              <label className="block text-sm font-medium text-[#334155]">
                Confirm password
                <input
                  type="password"
                  {...form.register('confirm')}
                  className={inputClass}
                  autoComplete="new-password"
                />
                {form.formState.errors.confirm ? (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.confirm.message}
                  </p>
                ) : null}
              </label>
            </div>

            {serverError ? (
              <p className="text-sm text-red-600">{serverError}</p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50 bg-[#2563EB] hover:bg-[#1d4ed8] transition-colors"
            >
              {submitting ? 'Submitting…' : 'Register'}
            </button>
          </form>
        )}

        {!done ? (
          <p className="mt-6 text-center text-sm text-[#64748B]">
            Already have an account?{' '}
            <Link href={loginHref} className="text-[#2563EB] font-medium hover:underline">
              Sign in
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-[#64748B]">
          Loading…
        </main>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
