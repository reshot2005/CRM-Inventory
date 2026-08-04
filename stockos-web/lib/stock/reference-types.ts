/**
 * Single source of truth for stock_ledger.reference_type values.
 * Must match the DB CHECK constraint in initial_schema.sql.
 */
export const STOCK_LEDGER_REFERENCE_TYPES = [
  'PURCHASE_ORDER',
  'SALE_ORDER',
  'MOVE_ORDER',
  'PRODUCTION_ORDER',
  'ADJUSTMENT',
  'MANUAL',
] as const;

export type StockLedgerReferenceType =
  (typeof STOCK_LEDGER_REFERENCE_TYPES)[number];

/** Correct value for adjustment ledger rows — NOT 'STOCK_ADJUSTMENT'. */
export const ADJUSTMENT_REFERENCE_TYPE: StockLedgerReferenceType = 'ADJUSTMENT';
