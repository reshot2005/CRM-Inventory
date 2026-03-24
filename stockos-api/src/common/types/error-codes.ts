import { HttpStatus } from '@nestjs/common';
import { ErrorCodes } from '../constants/error-codes';

export interface ErrorCodeEntry {
  code: string;
  message: string;
  httpStatus: HttpStatus;
}

export const ERROR_CODES = {
  AUTH_001: {
    code: ErrorCodes.AUTH_001,
    message: 'Invalid credentials',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  AUTH_002: {
    code: ErrorCodes.AUTH_002,
    message: 'Account pending approval',
    httpStatus: HttpStatus.FORBIDDEN,
  },
  AUTH_003: {
    code: ErrorCodes.AUTH_003,
    message: 'Account suspended',
    httpStatus: HttpStatus.FORBIDDEN,
  },
  AUTH_004: {
    code: ErrorCodes.AUTH_004,
    message: 'Account rejected',
    httpStatus: HttpStatus.FORBIDDEN,
  },
  AUTH_005: {
    code: ErrorCodes.AUTH_005,
    message: 'Token expired',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  AUTH_006: {
    code: ErrorCodes.AUTH_006,
    message: 'Token invalid',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },
  AUTH_007: {
    code: ErrorCodes.AUTH_007,
    message: 'Two-factor code invalid',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  AUTH_008: {
    code: ErrorCodes.AUTH_008,
    message: 'Two-factor authentication required',
    httpStatus: HttpStatus.UNAUTHORIZED,
  },

  INV_001: {
    code: ErrorCodes.INV_001,
    message: 'Item not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  INV_002: {
    code: ErrorCodes.INV_002,
    message: 'Insufficient stock',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  INV_003: {
    code: ErrorCodes.INV_003,
    message: 'Product code already exists',
    httpStatus: HttpStatus.CONFLICT,
  },
  INV_004: {
    code: ErrorCodes.INV_004,
    message: 'Cannot delete — active orders reference this item',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  INV_005: {
    code: ErrorCodes.INV_005,
    message: 'Move order not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  INV_006: {
    code: ErrorCodes.INV_006,
    message: 'Invalid move order status transition',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  INV_007: {
    code: ErrorCodes.INV_007,
    message: 'Location not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },

  MFG_001: {
    code: ErrorCodes.MFG_001,
    message: 'BOM not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  MFG_002: {
    code: ErrorCodes.MFG_002,
    message: 'Production order not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  MFG_003: {
    code: ErrorCodes.MFG_003,
    message: 'Insufficient raw materials for production',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  MFG_004: {
    code: ErrorCodes.MFG_004,
    message: 'Invalid production status transition',
    httpStatus: HttpStatus.BAD_REQUEST,
  },

  CRM_001: {
    code: ErrorCodes.CRM_001,
    message: 'Vendor not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  CRM_002: {
    code: ErrorCodes.CRM_002,
    message: 'Customer not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  CRM_003: {
    code: ErrorCodes.CRM_003,
    message: 'Duplicate GSTIN',
    httpStatus: HttpStatus.CONFLICT,
  },

  SALES_001: {
    code: ErrorCodes.SALES_001,
    message: 'Sale order not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
  SALES_002: {
    code: ErrorCodes.SALES_002,
    message: 'Customer credit limit exceeded',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  SALES_003: {
    code: ErrorCodes.SALES_003,
    message: 'Cannot cancel dispatched order',
    httpStatus: HttpStatus.BAD_REQUEST,
  },
  SALES_004: {
    code: ErrorCodes.SALES_004,
    message: 'Challan not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
} as const satisfies Record<string, ErrorCodeEntry>;

export type ErrorCodeKey = keyof typeof ERROR_CODES;
