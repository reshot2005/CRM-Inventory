import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';
import { isPathAllowedForOrgRole } from '@/lib/auth/route-access';

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });
  supabaseResponse.headers.set('x-pathname', request.nextUrl.pathname);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        const headers = new Headers(request.headers);
        headers.set('x-pathname', request.nextUrl.pathname);
        supabaseResponse = NextResponse.next({
          request: { headers },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          const o = options as CookieOptions | undefined;
          supabaseResponse.cookies.set(name, value, o);
        });
        supabaseResponse.headers.set('x-pathname', request.nextUrl.pathname);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      const login = new URL('/auth/login', request.url);
      login.searchParams.set('next', pathname);
      return NextResponse.redirect(login);
    }

    const { data: orgRole } = await supabase.rpc('get_user_org_role');
    const role = typeof orgRole === 'string' ? orgRole : null;

    if (!isPathAllowedForOrgRole(pathname, role)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/dashboard/:path*', '/auth/:path*', '/invite/:path*'],
};
