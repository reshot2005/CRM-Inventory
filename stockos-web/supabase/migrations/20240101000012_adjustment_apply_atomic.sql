-- BUG-1: Atomic, idempotent stock adjustment apply/reject + ledger reference integrity.
-- reference_type CHECK already allows 'ADJUSTMENT' (not 'STOCK_ADJUSTMENT').

begin;

alter table stock_adjustments
  add column if not exists rejection_reason text;

-- One ledger row per applied adjustment (blocks double-apply at DB level).
create unique index if not exists stock_ledger_adjustment_ref_uidx
  on stock_ledger (reference_id)
  where reference_type = 'ADJUSTMENT' and reference_id is not null;

create or replace function resolve_adjustment_movement(
  p_adjustment_type text,
  p_quantity numeric
) returns table (movement_type text, qty numeric)
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_adjustment_type = 'ADD' then
    return query select 'ADJUSTMENT_IN'::text, abs(p_quantity);
  elsif p_adjustment_type = 'REMOVE' then
    return query select 'ADJUSTMENT_OUT'::text, abs(p_quantity);
  elsif p_adjustment_type = 'CORRECT' then
    if p_quantity > 0 then
      return query select 'ADJUSTMENT_IN'::text, p_quantity;
    elsif p_quantity < 0 then
      return query select 'ADJUSTMENT_OUT'::text, abs(p_quantity);
    else
      raise exception 'ADJ_001: correction quantity cannot be zero'
        using errcode = '22023';
    end if;
  else
    raise exception 'ADJ_001: unknown adjustment_type %', p_adjustment_type
      using errcode = '22023';
  end if;
end;
$$;

-- Approve PENDING → APPROVED + ledger + quantity in ONE transaction.
-- Idempotent: re-apply of an already-applied adjustment (ledger present) returns success.
create or replace function apply_stock_adjustment(
  p_user_id uuid,
  p_adjustment_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_adj stock_adjustments%rowtype;
  v_movement_type text;
  v_qty numeric;
  v_ledger_id uuid;
  v_result jsonb;
  v_updated int;
begin
  perform assert_rpc_caller(p_user_id);
  v_org_id := get_active_org_for_user(p_user_id);
  if v_org_id is null then
    raise exception 'ORG_006: user has no active organization'
      using errcode = '42501';
  end if;

  select role into v_role
  from organization_members
  where user_id = p_user_id
    and org_id = v_org_id
    and status = 'ACTIVE'
  limit 1;

  if v_role is null or v_role not in ('OWNER', 'ADMIN', 'MANAGER') then
    raise exception 'ADJ_004: insufficient role to approve adjustments'
      using errcode = '42501';
  end if;

  select * into v_adj
  from stock_adjustments
  where id = p_adjustment_id
  for update;

  if not found then
    raise exception 'ADJ_006: adjustment not found'
      using errcode = 'P0002';
  end if;

  if v_adj.org_id is distinct from v_org_id then
    raise exception 'ORG_007: adjustment belongs to another organization'
      using errcode = '42501';
  end if;

  -- Idempotent success: already applied with matching ledger.
  if v_adj.status = 'APPROVED' then
    select id into v_ledger_id
    from stock_ledger
    where reference_type = 'ADJUSTMENT'
      and reference_id = p_adjustment_id
    limit 1;

    if v_ledger_id is not null then
      raise warning 'ADJ_IDEMPOTENT: apply_stock_adjustment no-op for %', p_adjustment_id;
      return jsonb_build_object(
        'success', true,
        'idempotent', true,
        'adjustment_id', p_adjustment_id,
        'status', 'APPROVED',
        'ledger_id', v_ledger_id
      );
    end if;

    raise exception
      'ADJ_007: orphan APPROVED adjustment % has no ledger — run data-repair script',
      p_adjustment_id
      using errcode = 'P0001';
  end if;

  if v_adj.status = 'REJECTED' then
    raise exception 'ADJ_003: adjustment was rejected'
      using errcode = 'P0001';
  end if;

  if v_adj.status is distinct from 'PENDING' then
    raise exception 'ADJ_005: adjustment is not pending (status=%)', v_adj.status
      using errcode = 'P0001';
  end if;

  select m.movement_type, m.qty
  into v_movement_type, v_qty
  from resolve_adjustment_movement(v_adj.adjustment_type, v_adj.quantity) m;

  update stock_adjustments
  set
    status = 'APPROVED',
    approved_by = p_user_id,
    approved_at = now(),
    rejection_reason = null
  where id = p_adjustment_id
    and status = 'PENDING';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'ADJ_005: concurrent status change — adjustment is no longer pending'
      using errcode = '40001';
  end if;

  begin
    v_result := process_stock_movement(
      p_user_id,
      v_adj.location_id,
      v_adj.item_id,
      v_movement_type,
      v_qty,
      null,
      'ADJUSTMENT',
      p_adjustment_id,
      coalesce(v_adj.notes, v_adj.adjustment_type || ': ' || v_adj.reason),
      p_user_id
    );
  exception
    when others then
      raise warning
        'ADJ_LEDGER_FAIL: apply_stock_adjustment % failed: %',
        p_adjustment_id, sqlerrm;
      raise;
  end;

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'adjustment_id', p_adjustment_id,
    'status', 'APPROVED',
    'movement', v_result
  );
end;
$$;

create or replace function reject_stock_adjustment(
  p_user_id uuid,
  p_adjustment_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_adj stock_adjustments%rowtype;
  v_updated int;
begin
  perform assert_rpc_caller(p_user_id);
  v_org_id := get_active_org_for_user(p_user_id);
  if v_org_id is null then
    raise exception 'ORG_006: user has no active organization'
      using errcode = '42501';
  end if;

  select role into v_role
  from organization_members
  where user_id = p_user_id
    and org_id = v_org_id
    and status = 'ACTIVE'
  limit 1;

  if v_role is null or v_role not in ('OWNER', 'ADMIN', 'MANAGER') then
    raise exception 'ADJ_004: insufficient role to reject adjustments'
      using errcode = '42501';
  end if;

  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'ADJ_008: rejection reason is required'
      using errcode = '22023';
  end if;

  select * into v_adj
  from stock_adjustments
  where id = p_adjustment_id
  for update;

  if not found then
    raise exception 'ADJ_006: adjustment not found'
      using errcode = 'P0002';
  end if;

  if v_adj.org_id is distinct from v_org_id then
    raise exception 'ORG_007: adjustment belongs to another organization'
      using errcode = '42501';
  end if;

  if v_adj.status = 'REJECTED' then
    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'adjustment_id', p_adjustment_id,
      'status', 'REJECTED'
    );
  end if;

  if v_adj.status = 'APPROVED' then
    raise exception 'ADJ_009: cannot reject an approved adjustment'
      using errcode = 'P0001';
  end if;

  update stock_adjustments
  set
    status = 'REJECTED',
    rejection_reason = btrim(p_reason),
    approved_by = p_user_id,
    approved_at = now()
  where id = p_adjustment_id
    and status = 'PENDING';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'ADJ_005: concurrent status change — adjustment is no longer pending'
      using errcode = '40001';
  end if;

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'adjustment_id', p_adjustment_id,
    'status', 'REJECTED'
  );
end;
$$;

revoke all on function resolve_adjustment_movement(text, numeric)
  from public, anon, authenticated;
revoke all on function apply_stock_adjustment(uuid, uuid)
  from public, anon;
revoke all on function reject_stock_adjustment(uuid, uuid, text)
  from public, anon;

grant execute on function apply_stock_adjustment(uuid, uuid)
  to authenticated, service_role;
grant execute on function reject_stock_adjustment(uuid, uuid, text)
  to authenticated, service_role;

commit;
