import { createClient } from '@/lib/supabase/client';
import type { StockLedgerReferenceType } from '@/lib/stock/reference-types';

export type StockMovementType =
  | 'PURCHASE_RECEIVE'
  | 'SALE_DISPATCH'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'PRODUCTION_IN'
  | 'PRODUCTION_OUT'
  | 'RETURN_IN'
  | 'RETURN_OUT';

export interface ProcessStockMovementParams {
  userId: string;
  locationId: string;
  itemId: string;
  movementType: StockMovementType | string;
  quantity: number;
  unitCost?: number | null;
  referenceType?: StockLedgerReferenceType | null;
  referenceId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}

/** Sole allowed way to change inventory.quantity (generic movements). */
export async function processStockMovement(
  params: ProcessStockMovementParams,
): Promise<unknown> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('process_stock_movement', {
    p_user_id: params.userId,
    p_location_id: params.locationId,
    p_item_id: params.itemId,
    p_movement_type: params.movementType,
    p_quantity: params.quantity,
    p_unit_cost: params.unitCost ?? null,
    p_reference_type: params.referenceType ?? null,
    p_reference_id: params.referenceId ?? null,
    p_notes: params.notes ?? null,
    p_created_by: params.createdBy ?? params.userId,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Atomic approve: status → APPROVED + ledger + quantity (or idempotent no-op). */
export async function applyStockAdjustment(
  userId: string,
  adjustmentId: string,
): Promise<unknown> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('apply_stock_adjustment', {
    p_user_id: userId,
    p_adjustment_id: adjustmentId,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Reject PENDING adjustment — never touches stock. */
export async function rejectStockAdjustment(
  userId: string,
  adjustmentId: string,
  reason: string,
): Promise<unknown> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('reject_stock_adjustment', {
    p_user_id: userId,
    p_adjustment_id: adjustmentId,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function generateOrderNumber(
  userId: string,
  prefix: string,
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('generate_order_number', {
    p_user_id: userId,
    p_prefix: prefix,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Failed to generate order number');
  return data;
}
