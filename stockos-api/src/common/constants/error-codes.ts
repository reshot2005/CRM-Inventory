/**
 * Canonical string codes for API errors (matches product spec).
 * Use with HttpException / filters for stable client handling.
 */
export const ErrorCodes = {
  AUTH_001: 'AUTH_001',
  AUTH_002: 'AUTH_002',
  AUTH_003: 'AUTH_003',
  AUTH_004: 'AUTH_004',
  AUTH_005: 'AUTH_005',
  AUTH_006: 'AUTH_006',
  AUTH_007: 'AUTH_007',
  AUTH_008: 'AUTH_008',
  INV_001: 'INV_001',
  INV_002: 'INV_002',
  INV_003: 'INV_003',
  INV_004: 'INV_004',
  INV_005: 'INV_005',
  INV_006: 'INV_006',
  INV_007: 'INV_007',
  MFG_001: 'MFG_001',
  MFG_002: 'MFG_002',
  MFG_003: 'MFG_003',
  MFG_004: 'MFG_004',
  CRM_001: 'CRM_001',
  CRM_002: 'CRM_002',
  CRM_003: 'CRM_003',
  SALES_001: 'SALES_001',
  SALES_002: 'SALES_002',
  SALES_003: 'SALES_003',
  SALES_004: 'SALES_004',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
