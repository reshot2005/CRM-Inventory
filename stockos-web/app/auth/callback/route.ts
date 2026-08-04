import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';

/**
 * Handles Supabase email confirmation, magic links, OAuth, and password-recovery (PKCE `?code=`).
 * Add to Supabase → Authentication → URL Configuration → Redirect URLs:
 *   http://localhost:3000/auth/callback
 *   https://your-domain.vercel.app/auth/callback
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextParam = requestUrl.searchParams.get('next');
  const nextPath =
    nextParam && nextParam.startsWith('/') ? nextParam : '/dashboard';
  const origin = requestUrl.origin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=missing_supabase_env`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_callback`);
  }

  const cookieStore = cookies();
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] =
    [];

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        pendingCookies.push(...cookiesToSet);
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  const target = error
    ? `${origin}/auth/login?error=auth_callback`
    : `${origin}${nextPath}`;

  const response = NextResponse.redirect(target);
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}
