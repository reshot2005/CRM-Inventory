import type { Tables } from '@/lib/supabase/client';

export const PRODUCTION_STATUSES = [
  'PLANNED',
  'IN_PROGRESS',
  'PAUSED',
  'COMPLETED',
  'BLOCKED',
  'CANCELLED',
] as const;
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export const MACHINE_STATUSES = ['IDLE', 'RUNNING', 'MAINTENANCE', 'DOWN'] as const;
export type MachineStatus = (typeof MACHINE_STATUSES)[number];

export const QUALITY_STATUSES = ['PENDING', 'PASSED', 'FAILED', 'QUARANTINED'] as const;
export type QualityStatus = (typeof QUALITY_STATUSES)[number];

export type ProductionView = 'list' | 'kanban';
export const PRODUCTION_VIEW_STORAGE_KEY = 'stockos-production-view';

export interface ItemEmbed {
  id: string;
  standardized_name: string;
  product_code: string;
  unit: string | null;
}

export interface LocationEmbed {
  id: string;
  name: string;
  code: string;
}

export interface MachineEmbed {
  id: string;
  name: string;
  code: string;
  status: string | null;
}

export interface BomWithFinishedGood extends Tables<'boms'> {
  items: ItemEmbed | null;
}

export interface BomWithLines extends BomWithFinishedGood {
  bom_lines: Array<Tables<'bom_lines'> & { items: ItemEmbed | null }>;
}

export interface ProductionOrderRow extends Tables<'production_orders'> {
  boms: BomWithFinishedGood | null;
  machines: MachineEmbed | null;
  locations: LocationEmbed | null;
}

export interface MaterialLineWithItem extends Tables<'production_material_lines'> {
  items: ItemEmbed | null;
}

export interface InventoryCostRow {
  item_id: string;
  quantity: number;
  unit_cost: number;
}
