-- Reversible undo for 20240101000013_repair_orphan_adjustments.sql
-- Restores voided orphan rows to APPROVED. Does NOT invent ledger rows.
-- Only use if you intentionally need the pre-repair status for investigation.

begin;

update stock_adjustments a
set
  status = 'APPROVED',
  rejection_reason = case
    when rejection_reason like 'DATA_REPAIR:%' then null
    else rejection_reason
  end
from stock_adjustment_repair_log r
where r.adjustment_id = a.id
  and r.previous_status = 'APPROVED'
  and r.new_status = 'REJECTED'
  and a.status = 'REJECTED'
  and a.rejection_reason like 'DATA_REPAIR:%';

delete from stock_adjustment_repair_log
where new_status = 'REJECTED'
  and notes like 'DATA_REPAIR:%';

commit;
