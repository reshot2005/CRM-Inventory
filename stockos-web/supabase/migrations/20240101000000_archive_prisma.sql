-- StockOS Week 1 — Archive Nest/Prisma camelCase tables if present
-- Idempotent: only runs when Prisma-shaped `items.standardizedName` exists

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'items'
      and column_name = 'standardizedName'
  ) then
    alter table if exists production_material_lines rename to _nest_production_material_lines;
    alter table if exists bom_lines rename to _nest_bom_lines;
    alter table if exists boms rename to _nest_boms;
    alter table if exists production_orders rename to _nest_production_orders;
    alter table if exists delivery_challans rename to _nest_delivery_challans;
    alter table if exists payments rename to _nest_payments;
    alter table if exists sale_order_lines rename to _nest_sale_order_lines;
    alter table if exists sale_orders rename to _nest_sale_orders;
    alter table if exists customer_activities rename to _nest_customer_activities;
    alter table if exists customer_contacts rename to _nest_customer_contacts;
    alter table if exists customers rename to _nest_customers;
    alter table if exists purchase_order_lines rename to _nest_purchase_order_lines;
    alter table if exists purchase_orders rename to _nest_purchase_orders;
    alter table if exists vendor_items rename to _nest_vendor_items;
    alter table if exists vendor_contacts rename to _nest_vendor_contacts;
    alter table if exists vendors rename to _nest_vendors;
    alter table if exists move_order_lines rename to _nest_move_order_lines;
    alter table if exists move_orders rename to _nest_move_orders;
    alter table if exists stock_adjustments rename to _nest_stock_adjustments;
    alter table if exists stock_ledger rename to _nest_stock_ledger;
    alter table if exists inventory rename to _nest_inventory;
    alter table if exists documents rename to _nest_documents;
    alter table if exists audit_logs rename to _nest_audit_logs;
    alter table if exists items rename to _nest_items;
    alter table if exists locations rename to _nest_locations;
    alter table if exists sequence_counters rename to _nest_sequence_counters;
  end if;
end $$;
