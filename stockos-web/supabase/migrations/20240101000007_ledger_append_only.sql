-- Harden stock_ledger append-only: triggers raise on UPDATE/DELETE
-- (RLS restrictive policies alone can no-op without error when 0 rows match)

create or replace function deny_stock_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'stock_ledger is append-only — UPDATE/DELETE are forbidden';
end;
$$;

drop trigger if exists stock_ledger_forbid_update on stock_ledger;
create trigger stock_ledger_forbid_update
  before update on stock_ledger
  for each row execute function deny_stock_ledger_mutation();

drop trigger if exists stock_ledger_forbid_delete on stock_ledger;
create trigger stock_ledger_forbid_delete
  before delete on stock_ledger
  for each row execute function deny_stock_ledger_mutation();
