import type { AppRole } from '@/lib/auth/auth-context';

export type OrgRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF';

/** Map org membership role → Nest/dashboard AppRole used by nav filters. */
export function orgRoleToAppRole(role: string | null | undefined): AppRole {
  if (role === 'OWNER' || role === 'ADMIN') return 'ADMIN';
  if (role === 'MANAGER') return 'MANAGER';
  if (role === 'STAFF') return 'STAFF';
  return 'VIEWER';
}

export function isOrgAdmin(role: string | null | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function canApproveAdjustments(role: string | null | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER';
}

export function roleRankOrg(role: string | null | undefined): number {
  const order = ['STAFF', 'MANAGER', 'ADMIN', 'OWNER'] as const;
  const idx = order.indexOf(role as (typeof order)[number]);
  return idx < 0 ? -1 : idx;
}
