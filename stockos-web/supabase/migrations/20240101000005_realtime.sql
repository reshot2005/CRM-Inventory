-- StockOS Week 1 — Realtime publication (idempotent)
do $$
declare
  t text;
begin
  foreach t in array array[
    'inventory','stock_ledger','sale_orders','purchase_orders',
    'move_orders','production_orders','items','stock_adjustments'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception
      when duplicate_object then null;
      when others then
        if sqlerrm not like '%already member%' then
          raise notice 'realtime add %: %', t, sqlerrm;
        end if;
    end;
  end loop;
end $$;
