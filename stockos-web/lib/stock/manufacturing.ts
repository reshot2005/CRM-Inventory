import { createClient } from '@/lib/supabase/client';

export type NotificationType =
  | 'LOW_STOCK'
  | 'PO_RECEIVED'
  | 'SO_DISPATCHED'
  | 'PRODUCTION_COMPLETE'
  | 'ADJUSTMENT_PENDING'
  | 'SYSTEM';

export async function insertNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
    is_read: false,
  });
  if (error) {
    // Non-fatal — never block stock mutations on notification failure
    console.error('notification insert failed:', error.message);
  }
}

/** required_qty = bom_line.qty * (target / yield) * (1 + waste/100) */
export function computeRequiredQty(
  bomLineQty: number,
  targetQty: number,
  yieldQty: number,
  wastePercent: number,
): number {
  const yieldSafe = yieldQty > 0 ? yieldQty : 1;
  const waste = Math.max(0, wastePercent) / 100;
  return Number((bomLineQty * (targetQty / yieldSafe) * (1 + waste)).toFixed(4));
}

export function computeBomLineCost(
  qty: number,
  unitCost: number,
  wastePercent: number,
): number {
  const waste = Math.max(0, wastePercent) / 100;
  return qty * (1 + waste) * unitCost;
}
