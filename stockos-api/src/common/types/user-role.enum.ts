export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  STAFF = 'STAFF',
  VIEWER = 'VIEWER',
}

export const PERMISSIONS = {
  INV_READ: 'inv:read',
  INV_WRITE: 'inv:write',
  INV_APPROVE: 'inv:approve',
  INV_ADJUST: 'inv:adjust',
  MFG_READ: 'mfg:read',
  MFG_WRITE: 'mfg:write',
  MFG_APPROVE: 'mfg:approve',
  CRM_READ: 'crm:read',
  CRM_WRITE: 'crm:write',
  SALES_READ: 'sales:read',
  SALES_WRITE: 'sales:write',
  SALES_APPROVE: 'sales:approve',
  REPORTS_READ: 'reports:read',
  REPORTS_CUSTOM: 'reports:custom',
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_APPROVE: 'users:approve',
  SYSTEM_CONFIG: 'system:config',
  AUDIT_READ: 'audit:read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: ALL_PERMISSIONS,

  [UserRole.MANAGER]: ALL_PERMISSIONS.filter(
    (p) =>
      p !== PERMISSIONS.SYSTEM_CONFIG &&
      p !== PERMISSIONS.USERS_WRITE &&
      p !== PERMISSIONS.USERS_APPROVE,
  ),

  [UserRole.STAFF]: [
    PERMISSIONS.INV_READ,
    PERMISSIONS.INV_WRITE,
    PERMISSIONS.MFG_READ,
    PERMISSIONS.MFG_WRITE,
    PERMISSIONS.CRM_READ,
    PERMISSIONS.CRM_WRITE,
    PERMISSIONS.SALES_READ,
    PERMISSIONS.SALES_WRITE,
    PERMISSIONS.REPORTS_READ,
  ],

  [UserRole.VIEWER]: [
    PERMISSIONS.INV_READ,
    PERMISSIONS.MFG_READ,
    PERMISSIONS.CRM_READ,
    PERMISSIONS.SALES_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.AUDIT_READ,
  ],
};
