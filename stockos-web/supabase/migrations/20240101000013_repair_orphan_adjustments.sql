-- Data repair (reversible): void orphan APPROVED adjustments that never wrote a ledger.
-- Does NOT mutate inventory.quantity — orphans never changed stock; voiding restores truth.
-- Reversal: see scripts/repair-orphan-adjustments-rollback.sql

begin;

create table if not exists stock_adjustment_repair_log (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null,
  org_id uuid,
  item_id uuid,
  location_id uuid,
  quantity numeric(15,4),
  adjustment_type text,
  previous_status text not null,
  new_status text not null,
  repaired_at timestamptz not null default now(),
  notes text
);

-- Capture orphans before mutating.
insert into stock_adjustment_repair_log (
  adjustment_id, org_id, item_id, location_id, quantity,
  adjustment_type, previous_status, new_status, notes
)
select
  a.id,
  a.org_id,
  a.item_id,
  a.location_id,
  a.quantity,
  a.adjustment_type,
  a.status,
  'REJECTED',
  'DATA_REPAIR: APPROVED without stock_ledger(reference_type=ADJUSTMENT)'
from stock_adjustments a
where a.status = 'APPROVED'
  and not exists (
    select 1
    from stock_ledger l
    where l.reference_type = 'ADJUSTMENT'
      and l.reference_id = a.id
  )
  and not exists (
    select 1
    from stock_adjustment_repair_log r
    where r.adjustment_id = a.id
      and r.new_status = 'REJECTED'
  );

update stock_adjustments a
set
  status = 'REJECTED',
  rejection_reason = coalesce(
    nullif(a.rejection_reason, ''),
    'DATA_REPAIR: orphan APPROVED without matching stock_ledger entry'
  ),
  notes = case
    when a.notes is null or btrim(a.notes) = '' then
      'DATA_REPAIR: voided orphan APPROVED (no ledger / no qty change)'
    else
      a.notes || E'\nDATA_REPAIR: voided orphan APPROVED (no ledger / no qty change)'
  end
where a.status = 'APPROVED'
  and not exists (
    select 1
    from stock_ledger l
    where l.reference_type = 'ADJUSTMENT'
      and l.reference_id = a.id
  );

-- Ops visibility: raise notice with affected SKU/location summary.
do $repair$
declare
  rec record;
  n int;
begin
  select count(*) into n from stock_adjustment_repair_log
  where repaired_at > now() - interval '1 minute';

  raise warning 'ADJ_REPAIR: voided % orphan APPROVED adjustment(s)', n;

  for rec in
    select
      coalesce(it.product_code, a.item_id::text) as sku,
      coalesce(loc.name, a.location_id::text) as location,
      a.quantity,
      a.adjustment_type,
      a.id
    from stock_adjustment_repair_log log
    join stock_adjustments a on a.id = log.adjustment_id
    left join items it on it.id = a.item_id
    left join locations loc on loc.id = a.location_id
    where log.repaired_at > now() - interval '1 minute'
  loop
    raise warning
      'ADJ_REPAIR_ROW: adjustment=% sku=% location=% type=% qty=% (inventory unchanged)',
      rec.id, rec.sku, rec.location, rec.adjustment_type, rec.quantity;
  end loop;
end
$repair$;

commit;
