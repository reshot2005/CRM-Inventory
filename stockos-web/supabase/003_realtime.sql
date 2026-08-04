-- ════════════════════════════════════════════════════════════
-- STOCKOS REALTIME — Run in Supabase SQL Editor (Step 3)
-- ════════════════════════════════════════════════════════════

alter publication supabase_realtime add table inventory;
alter publication supabase_realtime add table stock_ledger;
alter publication supabase_realtime add table sale_orders;
alter publication supabase_realtime add table purchase_orders;
alter publication supabase_realtime add table move_orders;
alter publication supabase_realtime add table production_orders;
alter publication supabase_realtime add table items;
