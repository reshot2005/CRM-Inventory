-- StockOS Week 1 — RLS (idempotent: drop+create)

alter table profiles enable row level security;
alter table locations enable row level security;
alter table items enable row level security;
alter table inventory enable row level security;
alter table stock_ledger enable row level security;
alter table stock_adjustments enable row level security;
alter table move_orders enable row level security;
alter table move_order_lines enable row level security;
alter table vendors enable row level security;
alter table vendor_contacts enable row level security;
alter table vendor_items enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_lines enable row level security;
alter table customers enable row level security;
alter table customer_contacts enable row level security;
alter table customer_activities enable row level security;
alter table sale_orders enable row level security;
alter table sale_order_lines enable row level security;
alter table payments enable row level security;
alter table delivery_challans enable row level security;
alter table boms enable row level security;
alter table bom_lines enable row level security;
alter table production_orders enable row level security;
alter table production_material_lines enable row level security;
alter table documents enable row level security;
alter table audit_logs enable row level security;

drop policy if exists profiles_select on profiles;
drop policy if exists profiles_insert on profiles;
drop policy if exists profiles_update on profiles;
create policy profiles_select on profiles for select using (id = auth.uid());
create policy profiles_insert on profiles for insert with check (id = auth.uid());
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

do $$
declare
  t text;
begin
  foreach t in array array[
    'locations','items','inventory','stock_ledger','stock_adjustments',
    'move_orders','move_order_lines','vendors','vendor_contacts','vendor_items',
    'purchase_orders','purchase_order_lines','customers','customer_contacts',
    'customer_activities','sale_orders','sale_order_lines','payments',
    'delivery_challans','boms','bom_lines','production_orders',
    'production_material_lines','documents','audit_logs'
  ]
  loop
    execute format('drop policy if exists %I_all_policy on %I', t, t);
    execute format(
      'create policy %I_all_policy on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t, t
    );
  end loop;
end $$;

drop policy if exists stock_ledger_no_delete on stock_ledger;
drop policy if exists stock_ledger_no_update on stock_ledger;
create policy stock_ledger_no_delete on stock_ledger as restrictive for delete using (false);
create policy stock_ledger_no_update on stock_ledger as restrictive for update using (false);
