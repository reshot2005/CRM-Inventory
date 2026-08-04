-- Emergency rollback for 20240101000009_org_access.sql.
-- Non-destructive: organization data/columns are retained, but all business
-- access and SECURITY DEFINER RPCs return to user_id-only isolation.
-- Run explicitly; normal migration tooling must ignore rollback_*.sql.
begin;

-- user_id becomes the tenant boundary again. Canonicalize it from the trusted
-- organization owner mapping before any user-scoped policy is enabled.
do $rollback$
declare
  t text;
  mismatches bigint;
begin
  foreach t in array array[
    'locations','items','inventory','stock_ledger','stock_adjustments',
    'move_orders','move_order_lines','vendors','vendor_contacts','vendor_items',
    'purchase_orders','purchase_order_lines','customers','customer_contacts',
    'customer_activities','sale_orders','sale_order_lines','payments',
    'delivery_challans','boms','bom_lines','production_orders',
    'production_material_lines','documents','audit_logs',
    'machines','batches','labour_entries','notifications'
  ]
  loop
    execute format('alter table public.%I disable trigger user', t);
    execute format(
      'update public.%I x
          set user_id = o.owner_id
         from public.organizations o
        where x.org_id = o.id
          and x.user_id is distinct from o.owner_id',
      t
    );
    execute format(
      'select count(*)
         from public.%I x
         left join public.organizations o on o.id = x.org_id
        where o.id is null or x.user_id is distinct from o.owner_id',
      t
    ) into mismatches;
    if mismatches <> 0 then
      raise exception 'ROLLBACK_001: % has % untrusted user_id mappings',
        t, mismatches;
    end if;
    execute format('alter table public.%I enable trigger user', t);
  end loop;
end
$rollback$;

-- Remove organization-scoped business policies and restore the Week 1/3 set.
do $rollback$
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
    execute format(
      'drop policy if exists %I on public.%I',
      t || '_org_policy', t
    );
    execute format(
      'drop policy if exists %I on public.%I',
      t || '_all_policy', t
    );
    execute format(
      'create policy %I on public.%I for all
       using (user_id = auth.uid())
       with check (user_id = auth.uid())',
      t || '_all_policy', t
    );
  end loop;

  -- Week 3 tables used per-command policies, not a single ALL policy.
  foreach t in array array['machines','batches','labour_entries','notifications']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_org_policy', t);
    execute format('drop policy if exists %I on public.%I', t || '_all_policy', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select using (user_id = auth.uid())',
      t || '_select', t
    );
    execute format(
      'create policy %I on public.%I for insert with check (user_id = auth.uid())',
      t || '_insert', t
    );
    execute format(
      'create policy %I on public.%I for update using (user_id = auth.uid())',
      t || '_update', t
    );
    execute format(
      'create policy %I on public.%I for delete using (user_id = auth.uid())',
      t || '_delete', t
    );
  end loop;
end
$rollback$;

drop policy if exists vendors_delete_role_restricted on vendors;
drop policy if exists customers_delete_role_restricted on customers;
drop policy if exists stock_adjustments_approve_role_restricted on stock_adjustments;
drop policy if exists audit_logs_select_role_restricted on audit_logs;
drop policy if exists audit_logs_no_update on audit_logs;
drop policy if exists audit_logs_no_delete on audit_logs;

drop policy if exists stock_ledger_no_delete on stock_ledger;
drop policy if exists stock_ledger_no_update on stock_ledger;
create policy stock_ledger_no_delete on stock_ledger
  as restrictive for delete using (false);
create policy stock_ledger_no_update on stock_ledger
  as restrictive for update using (false);

drop policy if exists profiles_select on profiles;
drop policy if exists profiles_insert on profiles;
drop policy if exists profiles_update on profiles;
create policy profiles_select on profiles for select using (id = auth.uid());
create policy profiles_insert on profiles for insert with check (id = auth.uid());
create policy profiles_update on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Restore the original user-scoped business identifier constraints.
alter table locations drop constraint if exists locations_org_id_code_key;
alter table locations drop constraint if exists locations_user_id_code_key;
alter table locations add constraint locations_user_id_code_key unique(user_id, code);
alter table items drop constraint if exists items_org_id_product_code_key;
alter table items drop constraint if exists items_user_id_product_code_key;
alter table items add constraint items_user_id_product_code_key unique(user_id, product_code);
alter table inventory drop constraint if exists inventory_org_location_item_key;
alter table inventory drop constraint if exists inventory_user_id_location_id_item_id_key;
alter table inventory add constraint inventory_user_id_location_id_item_id_key
  unique(user_id, location_id, item_id);
alter table move_orders drop constraint if exists move_orders_org_order_number_key;
alter table move_orders drop constraint if exists move_orders_user_id_order_number_key;
alter table move_orders add constraint move_orders_user_id_order_number_key
  unique(user_id, order_number);
alter table vendors drop constraint if exists vendors_org_vendor_display_key;
alter table vendors drop constraint if exists vendors_user_id_vendor_id_display_key;
alter table vendors add constraint vendors_user_id_vendor_id_display_key
  unique(user_id, vendor_id_display);
alter table vendor_items drop constraint if exists vendor_items_org_vendor_item_key;
alter table vendor_items drop constraint if exists vendor_items_user_id_vendor_id_item_id_key;
alter table vendor_items add constraint vendor_items_user_id_vendor_id_item_id_key
  unique(user_id, vendor_id, item_id);
alter table purchase_orders drop constraint if exists purchase_orders_org_po_number_key;
alter table purchase_orders drop constraint if exists purchase_orders_user_id_po_number_key;
alter table purchase_orders add constraint purchase_orders_user_id_po_number_key
  unique(user_id, po_number);
alter table customers drop constraint if exists customers_org_customer_display_key;
alter table customers drop constraint if exists customers_user_id_customer_id_display_key;
alter table customers add constraint customers_user_id_customer_id_display_key
  unique(user_id, customer_id_display);
alter table sale_orders drop constraint if exists sale_orders_org_order_number_key;
alter table sale_orders drop constraint if exists sale_orders_user_id_order_number_key;
alter table sale_orders add constraint sale_orders_user_id_order_number_key
  unique(user_id, order_number);
alter table delivery_challans drop constraint if exists delivery_challans_org_challan_number_key;
alter table delivery_challans drop constraint if exists delivery_challans_user_id_challan_number_key;
alter table delivery_challans add constraint delivery_challans_user_id_challan_number_key
  unique(user_id, challan_number);
alter table production_orders drop constraint if exists production_orders_org_order_number_key;
alter table production_orders drop constraint if exists production_orders_user_id_order_number_key;
alter table production_orders add constraint production_orders_user_id_order_number_key
  unique(user_id, order_number);
alter table machines drop constraint if exists machines_org_code_key;
alter table machines drop constraint if exists machines_user_id_code_key;
alter table machines add constraint machines_user_id_code_key unique(user_id, code);
alter table batches drop constraint if exists batches_org_batch_number_key;
alter table batches drop constraint if exists batches_user_id_batch_number_key;
alter table batches add constraint batches_user_id_batch_number_key
  unique(user_id, batch_number);

-- Restore user-scoped SECURITY DEFINER behavior. Caller checks remain in place
-- to close the legacy forged-p_user_id vulnerability even during rollback.
create or replace function process_stock_movement(
  p_user_id uuid,
  p_location_id uuid,
  p_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_unit_cost numeric default null,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_notes text default null,
  p_created_by uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_qty numeric := 0;
  v_current_cost numeric := 0;
  v_new_qty numeric;
  v_new_cost numeric;
  v_delta numeric;
  v_ledger_id uuid;
begin
  perform assert_rpc_caller(p_user_id);
  if coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) <> 'service_role'
  and p_created_by is not null
  and p_created_by <> p_user_id then
    raise exception 'AUTH_002: created_by does not match authenticated user'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from locations
    where id = p_location_id and user_id = p_user_id
  ) or not exists (
    select 1 from items
    where id = p_item_id and user_id = p_user_id
  ) then
    raise exception 'AUTH_003: item or location belongs to another user'
      using errcode = '42501';
  end if;

  if p_movement_type in (
    'IN','ADJUSTMENT_IN','TRANSFER_IN','PRODUCTION_IN',
    'PURCHASE_RECEIVE','RETURN_IN'
  ) then
    v_delta := abs(p_quantity);
  else
    v_delta := -abs(p_quantity);
  end if;

  select quantity, unit_cost
  into v_current_qty, v_current_cost
  from inventory
  where user_id = p_user_id
    and location_id = p_location_id
    and item_id = p_item_id
  for update;

  if not found then
    if v_delta < 0 then
      raise exception 'INV_002: No inventory record found for this item at this location';
    end if;
    insert into inventory (
      user_id, org_id, location_id, item_id, quantity, unit_cost
    )
    values (
      p_user_id, get_active_org_for_user(p_user_id), p_location_id, p_item_id,
      0, coalesce(p_unit_cost, 0)
    );
    v_current_qty := 0;
    v_current_cost := 0;
  end if;

  v_new_qty := v_current_qty + v_delta;
  if v_new_qty < 0 then
    raise exception 'INV_003: Insufficient stock. Available: %, Requested: %',
      v_current_qty, abs(v_delta);
  end if;

  if v_delta > 0 and p_unit_cost is not null and p_unit_cost > 0 then
    if v_new_qty = 0 then
      v_new_cost := p_unit_cost;
    else
      v_new_cost := (
        (v_current_qty * v_current_cost) + (abs(v_delta) * p_unit_cost)
      ) / v_new_qty;
    end if;
  else
    v_new_cost := v_current_cost;
  end if;

  update inventory
  set quantity = v_new_qty, unit_cost = v_new_cost
  where user_id = p_user_id
    and location_id = p_location_id
    and item_id = p_item_id;

  insert into stock_ledger (
    user_id, org_id, location_id, item_id, movement_type, quantity,
    balance_after, unit_cost, reference_type, reference_id, notes, created_by
  )
  values (
    p_user_id, get_active_org_for_user(p_user_id), p_location_id, p_item_id,
    p_movement_type, abs(p_quantity), v_new_qty, v_new_cost, p_reference_type,
    p_reference_id, p_notes, coalesce(p_created_by, p_user_id)
  )
  returning id into v_ledger_id;

  return jsonb_build_object(
    'success', true,
    'new_balance', v_new_qty,
    'new_cost', v_new_cost,
    'ledger_id', v_ledger_id
  );
end;
$$;

create or replace function get_dashboard_kpis(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_skus int;
  v_low_stock int;
  v_purchase_orders int;
  v_pending_deliveries int;
  v_revenue_mtd numeric;
  v_pending_approvals int;
begin
  perform assert_rpc_caller(p_user_id);

  select count(*) into v_total_skus
  from items where user_id = p_user_id and is_active = true;

  select count(distinct i.item_id) into v_low_stock
  from inventory i
  join items it on it.id = i.item_id and it.user_id = i.user_id
  where i.user_id = p_user_id
    and i.quantity <= it.min_stock_level
    and it.min_stock_level > 0
    and it.is_active = true;

  select count(*) into v_purchase_orders
  from purchase_orders
  where user_id = p_user_id and status not in ('CANCELLED','RECEIVED');

  select count(*) into v_pending_deliveries
  from sale_orders
  where user_id = p_user_id
    and status in ('CONFIRMED','PROCESSING','DISPATCHED');

  select coalesce(sum(total_amount), 0) into v_revenue_mtd
  from sale_orders
  where user_id = p_user_id
    and status <> 'CANCELLED'
    and date_trunc('month', created_at) = date_trunc('month', now());

  select count(*) into v_pending_approvals
  from stock_adjustments
  where user_id = p_user_id and status = 'PENDING';

  return jsonb_build_object(
    'total_skus', v_total_skus,
    'low_stock_items', v_low_stock,
    'open_purchase_orders', v_purchase_orders,
    'pending_deliveries', v_pending_deliveries,
    'revenue_mtd', v_revenue_mtd,
    'pending_adjustments', v_pending_approvals
  );
end;
$$;

create or replace function get_low_stock_items(p_user_id uuid)
returns table(
  item_id uuid,
  item_name text,
  product_code text,
  category text,
  location_id uuid,
  location_name text,
  current_qty numeric,
  min_stock_level numeric,
  deficit numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform assert_rpc_caller(p_user_id);
  return query
  select
    i.item_id, it.standardized_name, it.product_code, it.category,
    i.location_id, l.name, i.quantity, it.min_stock_level,
    (it.min_stock_level - i.quantity)
  from inventory i
  join items it on it.id = i.item_id and it.user_id = i.user_id
  join locations l on l.id = i.location_id and l.user_id = i.user_id
  where i.user_id = p_user_id
    and i.quantity <= it.min_stock_level
    and it.min_stock_level > 0
    and it.is_active = true
  order by (i.quantity / nullif(it.min_stock_level, 0)) asc;
end;
$$;

create or replace function generate_order_number(
  p_user_id uuid,
  p_prefix text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_year text := to_char(now(), 'YY');
begin
  perform assert_rpc_caller(p_user_id);
  case p_prefix
    when 'PO' then select count(*) + 1 into v_count from purchase_orders where user_id = p_user_id;
    when 'SO' then select count(*) + 1 into v_count from sale_orders where user_id = p_user_id;
    when 'MO' then select count(*) + 1 into v_count from move_orders where user_id = p_user_id;
    when 'DC' then select count(*) + 1 into v_count from delivery_challans where user_id = p_user_id;
    when 'PRD' then select count(*) + 1 into v_count from production_orders where user_id = p_user_id;
    when 'VEN' then select count(*) + 1 into v_count from vendors where user_id = p_user_id;
    when 'CUS' then select count(*) + 1 into v_count from customers where user_id = p_user_id;
    else v_count := 1;
  end case;
  return p_prefix || '-' || v_year || '-' || lpad(v_count::text, 4, '0');
end;
$$;

commit;
