-- ════════════════════════════════════════════════════════════
-- STOCKOS RLS — Run in Supabase SQL Editor (Step 2)
-- ════════════════════════════════════════════════════════════

-- Enable RLS on every table
alter table profiles              enable row level security;
alter table locations             enable row level security;
alter table items                 enable row level security;
alter table inventory             enable row level security;
alter table stock_ledger          enable row level security;
alter table stock_adjustments     enable row level security;
alter table move_orders           enable row level security;
alter table move_order_lines      enable row level security;
alter table vendors               enable row level security;
alter table vendor_contacts       enable row level security;
alter table vendor_items          enable row level security;
alter table purchase_orders       enable row level security;
alter table purchase_order_lines  enable row level security;
alter table customers             enable row level security;
alter table customer_contacts     enable row level security;
alter table sale_orders           enable row level security;
alter table sale_order_lines      enable row level security;
alter table delivery_challans     enable row level security;
alter table boms                  enable row level security;
alter table bom_lines             enable row level security;
alter table production_orders     enable row level security;

-- user_id-scoped policies for all tables
do $$ declare t text;
begin
  foreach t in array array[
    'locations','items','inventory','stock_ledger',
    'stock_adjustments','move_orders','move_order_lines',
    'vendors','vendor_contacts','vendor_items',
    'purchase_orders','purchase_order_lines',
    'customers','customer_contacts',
    'sale_orders','sale_order_lines','delivery_challans',
    'boms','bom_lines','production_orders'
  ] loop
    execute format(
      'drop policy if exists "%s_user_policy" on %s', t, t
    );
    execute format(
      'create policy "%s_user_policy" on %s
       for all using (user_id = auth.uid())
       with check (user_id = auth.uid())', t, t
    );
  end loop;
end $$;

-- profiles: user sees only their own
drop policy if exists "profiles_user_policy" on profiles;
create policy "profiles_user_policy" on profiles
  for all using (id = auth.uid())
  with check (id = auth.uid());
