'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';

export type OrgRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF';

export function useOrgRole() {
  const userId = useUserId();

  const query = useQuery({
    queryKey: ['org-role', userId ?? ''],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data: role, error: roleErr } = await supabase.rpc('get_user_org_role');
      if (roleErr) throw roleErr;
      const { data: orgId, error: orgErr } = await supabase.rpc('get_user_org_id');
      if (orgErr) throw orgErr;
      const orgRole = (role as OrgRole | null) ?? null;
      return {
        orgId: (orgId as string | null) ?? null,
        role: orgRole,
        isOwner: orgRole === 'OWNER',
        isAdmin: orgRole === 'OWNER' || orgRole === 'ADMIN',
        canManageTeam: orgRole === 'OWNER' || orgRole === 'ADMIN',
        canDeleteVendorsCustomers:
          orgRole === 'OWNER' || orgRole === 'ADMIN' || orgRole === 'MANAGER',
        canApproveAdjustments:
          orgRole === 'OWNER' || orgRole === 'ADMIN' || orgRole === 'MANAGER',
        isStaff: orgRole === 'STAFF',
      };
    },
  });

  return {
    loading: query.isLoading,
    orgId: query.data?.orgId ?? null,
    role: query.data?.role ?? null,
    isOwner: query.data?.isOwner ?? false,
    isAdmin: query.data?.isAdmin ?? false,
    canManageTeam: query.data?.canManageTeam ?? false,
    canDeleteVendorsCustomers: query.data?.canDeleteVendorsCustomers ?? false,
    canApproveAdjustments: query.data?.canApproveAdjustments ?? false,
    isStaff: query.data?.isStaff ?? false,
    refetch: query.refetch,
  };
}
