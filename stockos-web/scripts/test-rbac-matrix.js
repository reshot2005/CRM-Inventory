/**
 * BUG-3: Role × nav × route access matrix (unit-level, no DB).
 * Run: node scripts/test-rbac-matrix.js
 */
const assert = require('assert');

/** Mirrors lib/auth/route-access.ts + DashboardLayoutClient navVisible. */
const ROUTE_ACCESS = [
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

const NAV = [
  { href: '/dashboard', roles: ['VIEWER', 'STAFF', 'MANAGER', 'ADMIN', 'OWNER'] },
  { href: '/dashboard/adjustments', roles: ['VIEWER', 'STAFF', 'MANAGER', 'ADMIN', 'OWNER'] },
  { href: '/dashboard/sales', roles: ['MANAGER', 'ADMIN', 'OWNER'] },
  { href: '/dashboard/admin/locations', roles: ['ADMIN', 'OWNER'] },
  { href: '/dashboard/admin/users', roles: ['ADMIN', 'OWNER'] },
  { href: '/dashboard/settings/audit-log', roles: ['ADMIN', 'OWNER'] },
  { href: '/dashboard/machines', roles: [] }, // removed from nav
  { href: '/dashboard/labour', roles: [] }, // removed from nav
];

function orgToApp(role) {
  if (role === 'OWNER' || role === 'ADMIN') return 'ADMIN';
  if (role === 'MANAGER') return 'MANAGER';
  if (role === 'STAFF') return 'STAFF';
  return 'VIEWER';
}

function pathAllowed(pathname, orgRole) {
  const match = ROUTE_ACCESS.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + '/'),
  );
  if (!match) return true;
  return match.roles.includes(orgRole);
}

function navVisible(href, appRole, orgRole) {
  const item = NAV.find((n) => n.href === href);
  if (!item) return false;
  if (item.roles.length === 0) return false;
  // OWNER is mapped to ADMIN for app role checks on adminOnly items
  const effective = orgRole === 'OWNER' ? 'OWNER' : orgRole;
  return item.roles.includes(effective) || item.roles.includes(appRole);
}

const ROLES = ['VIEWER', 'STAFF', 'MANAGER', 'ADMIN', 'OWNER'];

const expected = {
  VIEWER: {
    nav: ['/dashboard', '/dashboard/adjustments'],
    denyRoutes: ['/dashboard/admin/locations', '/dashboard/sales', '/dashboard/admin/users'],
  },
  STAFF: {
    nav: ['/dashboard', '/dashboard/adjustments'],
    denyRoutes: ['/dashboard/admin/locations', '/dashboard/sales'],
    allowRoutes: ['/dashboard/move-orders'],
  },
  MANAGER: {
    nav: ['/dashboard', '/dashboard/adjustments', '/dashboard/sales'],
    denyRoutes: ['/dashboard/admin/locations', '/dashboard/admin/users'],
    allowRoutes: ['/dashboard/sales', '/dashboard/production'],
  },
  ADMIN: {
    nav: [
      '/dashboard',
      '/dashboard/adjustments',
      '/dashboard/sales',
      '/dashboard/admin/locations',
      '/dashboard/admin/users',
      '/dashboard/settings/audit-log',
    ],
    allowRoutes: ['/dashboard/admin/locations', '/dashboard/admin/users'],
  },
  OWNER: {
    nav: [
      '/dashboard',
      '/dashboard/adjustments',
      '/dashboard/sales',
      '/dashboard/admin/locations',
      '/dashboard/admin/users',
      '/dashboard/settings/audit-log',
    ],
    allowRoutes: ['/dashboard/admin/locations', '/dashboard/admin/users'],
  },
};

let failures = 0;
for (const role of ROLES) {
  const appRole = orgToApp(role === 'VIEWER' ? null : role);
  const exp = expected[role];

  for (const href of exp.nav) {
    try {
      assert.strictEqual(
        navVisible(href, appRole, role),
        true,
        `${role} should see ${href}`,
      );
      console.log(`PASS  ${role} nav sees ${href}`);
    } catch (e) {
      failures++;
      console.log(`FAIL  ${e.message}`);
    }
  }

  for (const href of ['/dashboard/machines', '/dashboard/labour']) {
    try {
      assert.strictEqual(
        navVisible(href, appRole, role),
        false,
        `${role} must not see stub ${href}`,
      );
      console.log(`PASS  ${role} nav hides stub ${href}`);
    } catch (e) {
      failures++;
      console.log(`FAIL  ${e.message}`);
    }
  }

  for (const path of exp.denyRoutes || []) {
    const orgRole = role === 'VIEWER' ? null : role;
    try {
      assert.strictEqual(
        pathAllowed(path, orgRole),
        false,
        `${role} must be denied ${path}`,
      );
      console.log(`PASS  ${role} denied route ${path}`);
    } catch (e) {
      failures++;
      console.log(`FAIL  ${e.message}`);
    }
  }

  for (const path of exp.allowRoutes || []) {
    try {
      assert.strictEqual(
        pathAllowed(path, role),
        true,
        `${role} must be allowed ${path}`,
      );
      console.log(`PASS  ${role} allowed route ${path}`);
    } catch (e) {
      failures++;
      console.log(`FAIL  ${e.message}`);
    }
  }
}

// Nest API expectation note (documented in matrix):
console.log(
  'NOTE  Nest /api/v1/users/* remains @Roles(ADMIN|MANAGER) — independent of org nav.',
);

process.exit(failures ? 1 : 0);
