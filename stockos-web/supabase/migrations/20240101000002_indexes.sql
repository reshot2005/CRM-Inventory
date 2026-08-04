-- StockOS Week 1 — Performance indexes (idempotent)
create index if not exists idx_items_user_category on items(user_id, category) where is_active = true;
create index if not exists idx_items_user_code on items(user_id, product_code);
create index if not exists idx_items_search on items using gin(standardized_name gin_trgm_ops);
create index if not exists idx_inventory_user_item on inventory(user_id, item_id);
create index if not exists idx_inventory_user_location on inventory(user_id, location_id);
create index if not exists idx_inventory_low_stock on inventory(user_id, quantity, item_id);
create index if not exists idx_stock_ledger_user_date on stock_ledger(user_id, created_at desc);
create index if not exists idx_stock_ledger_item on stock_ledger(user_id, item_id, created_at desc);
create index if not exists idx_stock_ledger_location on stock_ledger(user_id, location_id, created_at desc);
create index if not exists idx_sale_orders_user_status on sale_orders(user_id, status);
create index if not exists idx_sale_orders_customer on sale_orders(user_id, customer_id);
create index if not exists idx_purchase_orders_user_status on purchase_orders(user_id, status);
create index if not exists idx_purchase_orders_vendor on purchase_orders(user_id, vendor_id);
create index if not exists idx_customers_search on customers using gin(company_name gin_trgm_ops);
create index if not exists idx_vendors_search on vendors using gin(company_name gin_trgm_ops);
create index if not exists idx_audit_logs_user_date on audit_logs(user_id, created_at desc);
create index if not exists idx_production_orders_status on production_orders(user_id, status);
