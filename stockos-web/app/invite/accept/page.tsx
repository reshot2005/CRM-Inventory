'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

type State =
  | { kind: 'loading' }
  | { kind: 'need_auth'; token: string }
  | { kind: 'ready'; token: string; email: string | null }
  | { kind: 'error'; message: string }
  | { kind: 'success'; role: string };

function InviteAcceptInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!token) {
        setState({ kind: 'error', message: 'Missing invite token.' });
        return;
      }
      const uuidOk =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          token,
        );
      if (!uuidOk) {
        setState({ kind: 'error', message: 'Invalid invite token format.' });
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        if (!cancelled) setState({ kind: 'need_auth', token });
        return;
      }

      // Prefetch invite metadata for display (may fail RLS for outsider — ignore).
      const { data: invite } = await supabase
        .from('organization_invites')
        .select('email, expires_at, accepted_at, role')
        .eq('token', token)
        .maybeSingle();

      if (invite?.accepted_at) {
        if (!cancelled) {
          setState({ kind: 'error', message: 'This invite was already accepted.' });
        }
        return;
      }
      if (invite?.expires_at && new Date(invite.expires_at) < new Date()) {
        if (!cancelled) {
          setState({ kind: 'error', message: 'This invite has expired.' });
        }
        return;
      }

      if (!cancelled) {
        setState({
          kind: 'ready',
          token,
          email: invite?.email ?? sessionData.session.user.email ?? null,
        });
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [supabase, token]);

  async function accept() {
    if (!token) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('accept_organization_invite', {
      p_token: token,
    });
    setBusy(false);
    if (error) {
      const msg = error.message || 'Could not accept invite';
      if (/ORG_033|expired/i.test(msg)) {
        setState({ kind: 'error', message: 'This invite has expired.' });
      } else if (/ORG_032|already/i.test(msg)) {
        setState({ kind: 'error', message: 'This invite was already accepted.' });
      } else if (/ORG_034|email/i.test(msg)) {
        setState({
          kind: 'error',
          message:
            'Signed-in email does not match the invite. Sign out and use the invited account.',
        });
      } else if (/ORG_031|not found/i.test(msg)) {
        setState({ kind: 'error', message: 'Invite not found or revoked.' });
      } else {
        setState({ kind: 'error', message: msg });
      }
      return;
    }
    const role = (data as { role?: string } | null)?.role ?? 'member';
    setState({ kind: 'success', role });
    setTimeout(() => {
      router.replace('/dashboard');
      router.refresh();
    }, 1200);
  }

  const authHref = `/auth/login?next=${encodeURIComponent(`/invite/accept?token=${token ?? ''}`)}`;
  const registerHref = `/auth/register?next=${encodeURIComponent(`/invite/accept?token=${token ?? ''}`)}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          StockOS invite
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Join an existing organization with the role you were invited for.
        </p>

        {state.kind === 'loading' ? (
          <p className="mt-6 text-sm">Checking invite…</p>
        ) : null}

        {state.kind === 'need_auth' ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm">
              Sign in or create an account with the invited email to continue.
              Your invite token will be preserved.
            </p>
            <div className="flex gap-2">
              <Button asChild>
                <Link href={authHref}>Sign in</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={registerHref}>Create account</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {state.kind === 'ready' ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm">
              Accepting as <strong>{state.email ?? 'current user'}</strong>
            </p>
            <Button disabled={busy} onClick={() => void accept()} className="w-full">
              {busy ? 'Accepting…' : 'Accept invite'}
            </Button>
          </div>
        ) : null}

        {state.kind === 'success' ? (
          <p className="mt-6 text-sm text-emerald-700">
            Joined as {state.role}. Redirecting to dashboard…
          </p>
        ) : null}

        {state.kind === 'error' ? (
          <div className="mt-6 space-y-3">
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {state.message}
            </p>
            <Button variant="outline" asChild>
              <Link href="/">Back home</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6 text-sm text-muted-foreground">
          Loading invite…
        </div>
      }
    >
      <InviteAcceptInner />
    </Suspense>
  );
}
