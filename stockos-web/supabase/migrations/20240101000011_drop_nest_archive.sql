-- Week 4 — drop archived Nest/Prisma camelCase tables (_nest_*).
-- Safe only after WEEK4_NEST_DECISIONS.md records DELETE for inventory/CRM/sales/mfg/reports/storage
-- and application grep shows zero _nest_ references outside docs/migrations.

drop table if exists _nest_production_material_lines cascade;
drop table if exists _nest_bom_lines cascade;
drop table if exists _nest_boms cascade;
drop table if exists _nest_production_orders cascade;
drop table if exists _nest_delivery_challans cascade;
drop table if exists _nest_payments cascade;
drop table if exists _nest_sale_order_lines cascade;
drop table if exists _nest_sale_orders cascade;
drop table if exists _nest_customer_activities cascade;
drop table if exists _nest_customer_contacts cascade;
drop table if exists _nest_customers cascade;
drop table if exists _nest_purchase_order_lines cascade;
drop table if exists _nest_purchase_orders cascade;
drop table if exists _nest_vendor_items cascade;
drop table if exists _nest_vendor_contacts cascade;
drop table if exists _nest_vendors cascade;
drop table if exists _nest_move_order_lines cascade;
drop table if exists _nest_move_orders cascade;
drop table if exists _nest_stock_adjustments cascade;
drop table if exists _nest_stock_ledger cascade;
drop table if exists _nest_inventory cascade;
drop table if exists _nest_documents cascade;
drop table if exists _nest_audit_logs cascade;
drop table if exists _nest_items cascade;
drop table if exists _nest_locations cascade;
drop table if exists _nest_sequence_counters cascade;
