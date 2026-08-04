import type { OrgRole } from '@/lib/auth/org-role';

export type RouteAccessRule = {
  /** Path prefix match (exact or startsWith). */
  prefix: string;
  /** Org roles allowed. Empty = any authenticated member. */
  roles: OrgRole[];
};

/**
 * Server-side route ACL mirroring DashboardLayoutClient nav flags.
 * Enforced in middleware — nav hiding is UX only.
 */
export const DASHBOARD_ROUTE_ACCESS: RouteAccessRule[] = [
  { prefix: '/dashboard/admin', roles: ['OWNER', 'ADMIN'] },
  { prefix: '/dashboard/delivery-types', roles: ['OWNER', 'ADMIN'] },
  { prefix: '/dashboard/settings/audit-log', roles: ['OWNER', 'ADMIN'] },
  { prefix: '/dashboard/settings/team', roles: ['OWNER', 'ADMIN'] },
  { prefix: '/dashboard/sales', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
  { prefix: '/dashboard/challans', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
  { prefix: '/dashboard/production', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
  { prefix: '/dashboard/boms', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
  { prefix: '/dashboard/invoices', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
  { prefix: '/dashboard/move-orders', roles: ['OWNER', 'ADMIN', 'MANAGER', 'STAFF'] },
];

export function requiredRolesForPath(pathname: string): OrgRole[] | null {
  const match = DASHBOARD_ROUTE_ACCESS.find(
    (rule) =>
      pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`),
  );
  return match ? match.roles : null;
}

export function isPathAllowedForOrgRole(
  pathname: string,
  role: string | null | undefined,
): boolean {
  const required = requiredRolesForPath(pathname);
  if (!required) return true;
  if (!role) return false;
  return (required as string[]).includes(role);
}
