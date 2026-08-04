import type { Inserts, Tables, Updates } from '@/lib/supabase/client';

export type Profile = Tables<'profiles'>;
export type Location = Tables<'locations'>;
export type Item = Tables<'items'>;
export type Inventory = Tables<'inventory'>;
export type StockLedger = Tables<'stock_ledger'>;
export type StockAdjustment = Tables<'stock_adjustments'>;
export type MoveOrder = Tables<'move_orders'>;
export type MoveOrderLine = Tables<'move_order_lines'>;
export type Vendor = Tables<'vendors'>;
export type VendorContact = Tables<'vendor_contacts'>;
export type VendorItem = Tables<'vendor_items'>;
export type PurchaseOrder = Tables<'purchase_orders'>;
export type PurchaseOrderLine = Tables<'purchase_order_lines'>;
export type Customer = Tables<'customers'>;
export type CustomerContact = Tables<'customer_contacts'>;
export type CustomerActivity = Tables<'customer_activities'>;
export type SaleOrder = Tables<'sale_orders'>;
export type SaleOrderLine = Tables<'sale_order_lines'>;
export type Payment = Tables<'payments'>;
export type DeliveryChallan = Tables<'delivery_challans'>;
export type Bom = Tables<'boms'>;
export type BomLine = Tables<'bom_lines'>;
export type ProductionOrder = Tables<'production_orders'>;
export type ProductionMaterialLine = Tables<'production_material_lines'>;
export type Document = Tables<'documents'>;
export type AuditLog = Tables<'audit_logs'>;

export type ItemInsert = Inserts<'items'>;
export type ItemUpdate = Updates<'items'>;
export type InventoryInsert = Inserts<'inventory'>;

export type ItemCategory =
  | 'RAW_MATERIAL'
  | 'FINISHED_GOOD'
  | 'PACKAGING'
  | 'OTHER';

export type LocationType = 'FACTORY' | 'HUB' | 'WAREHOUSE' | 'STORE';

export interface DashboardKpis {
  total_skus: number;
  low_stock_items: number;
  open_purchase_orders: number;
  pending_deliveries: number;
  revenue_mtd: number;
  pending_adjustments: number;
}

export interface LowStockItem {
  item_id: string;
  item_name: string;
  product_code: string;
  category: string;
  location_id: string;
  location_name: string;
  current_qty: number;
  min_stock_level: number;
  deficit: number;
}
