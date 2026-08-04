import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  DashboardLayoutClient,
  type DashboardProfile,
} from '@/components/dashboard/DashboardLayoutClient';
import { orgRoleToAppRole } from '@/lib/auth/org-role';
import { isPathAllowedForOrgRole } from '@/lib/auth/route-access';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  ) {
    redirect('/auth/login?error=missing_supabase_env');
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth/login');
  }

  const [{ data: profileRow }, { data: orgRoleRaw }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.rpc('get_user_org_role'),
  ]);

  const orgRole =
    typeof orgRoleRaw === 'string' ? orgRoleRaw : null;
  const appRole = orgRoleToAppRole(orgRole);

  const headerList = headers();
  const pathname =
    headerList.get('x-pathname') ||
    headerList.get('x-invoke-path') ||
    headerList.get('next-url') ||
    '';

  // Defense in depth with middleware — block restricted routes if pathname known.
  if (pathname.startsWith('/dashboard') && !isPathAllowedForOrgRole(pathname, orgRole)) {
    redirect('/unauthorized');
  }

  const profile: DashboardProfile = {
    id: user.id,
    name: profileRow?.full_name || user.user_metadata?.name || user.email || 'User',
    email: user.email || '',
    role: appRole,
    orgRole,
    status: 'ACTIVE',
    allowedLocations: [],
  };

  return <DashboardLayoutClient profile={profile}>{children}</DashboardLayoutClient>;
}
