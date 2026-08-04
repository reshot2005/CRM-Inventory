-- StockOS Week 1 — Functions & triggers (idempotent)

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into locations (user_id, name, code, type, address)
  values (new.id, 'Main Warehouse', 'WH-001', 'WAREHOUSE', 'Default Location')
  on conflict (user_id, code) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_items_updated_at on items;
create trigger update_items_updated_at before update on items
  for each row execute function update_updated_at_column();

drop trigger if exists update_inventory_updated_at on inventory;
create trigger update_inventory_updated_at before update on inventory
  for each row execute function update_updated_at_column();

drop trigger if exists update_vendors_updated_at on vendors;
create trigger update_vendors_updated_at before update on vendors
  for each row execute function update_updated_at_column();

drop trigger if exists update_customers_updated_at on customers;
create trigger update_customers_updated_at before update on customers
  for each row execute function update_updated_at_column();

drop trigger if exists update_sale_orders_updated_at on sale_orders;
create trigger update_sale_orders_updated_at before update on sale_orders
  for each row execute function update_updated_at_column();

drop trigger if exists update_purchase_orders_updated_at on purchase_orders;
create trigger update_purchase_orders_updated_at before update on purchase_orders
  for each row execute function update_updated_at_column();

drop trigger if exists update_move_orders_updated_at on move_orders;
create trigger update_move_orders_updated_at before update on move_orders
  for each row execute function update_updated_at_column();

drop trigger if exists update_production_orders_updated_at on production_orders;
create trigger update_production_orders_updated_at before update on production_orders
  for each row execute function update_updated_at_column();

drop trigger if exists update_profiles_updated_at on profiles;
create trigger update_profiles_updated_at before update on profiles
  for each row execute function update_updated_at_column();

drop trigger if exists update_locations_updated_at on locations;
create trigger update_locations_updated_at before update on locations
  for each row execute function update_updated_at_column();

drop trigger if exists update_boms_updated_at on boms;
create trigger update_boms_updated_at before update on boms
  for each row execute function update_updated_at_column();

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
  if p_movement_type in (
    'IN','ADJUSTMENT_IN','TRANSFER_IN','PRODUCTION_IN','PURCHASE_RECEIVE','RETURN_IN'
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
    insert into inventory (user_id, location_id, item_id, quantity, unit_cost)
    values (p_user_id, p_location_id, p_item_id, 0, coalesce(p_unit_cost, 0));
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
      v_new_cost := ((v_current_qty * v_current_cost) + (abs(v_delta) * p_unit_cost)) / v_new_qty;
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
    user_id, location_id, item_id, movement_type, quantity, balance_after,
    unit_cost, reference_type, reference_id, notes, created_by
  ) values (
    p_user_id, p_location_id, p_item_id, p_movement_type, abs(p_quantity), v_new_qty,
    v_new_cost, p_reference_type, p_reference_id, p_notes, p_created_by
  ) returning id into v_ledger_id;

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
  select count(*) into v_total_skus
  from items where user_id = p_user_id and is_active = true;

  select count(distinct i.item_id) into v_low_stock
  from inventory i
  join items it on it.id = i.item_id
  where i.user_id = p_user_id
    and i.quantity <= it.min_stock_level
    and it.min_stock_level > 0
    and it.is_active = true;

  select count(*) into v_purchase_orders
  from purchase_orders
  where user_id = p_user_id and status not in ('CANCELLED','RECEIVED');

  select count(*) into v_pending_deliveries
  from sale_orders
  where user_id = p_user_id and status in ('CONFIRMED','PROCESSING','DISPATCHED');

  select coalesce(sum(total_amount), 0) into v_revenue_mtd
  from sale_orders
  where user_id = p_user_id
    and status not in ('CANCELLED')
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
  return query
  select
    i.item_id,
    it.standardized_name,
    it.product_code,
    it.category,
    i.location_id,
    l.name,
    i.quantity,
    it.min_stock_level,
    (it.min_stock_level - i.quantity) as deficit
  from inventory i
  join items it on it.id = i.item_id
  join locations l on l.id = i.location_id
  where i.user_id = p_user_id
    and i.quantity <= it.min_stock_level
    and it.min_stock_level > 0
    and it.is_active = true
  order by (i.quantity / nullif(it.min_stock_level, 0)) asc;
end;
$$;

create or replace function generate_order_number(p_user_id uuid, p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_year text;
begin
  v_year := to_char(now(), 'YY');
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

grant execute on function process_stock_movement to authenticated, service_role;
grant execute on function get_dashboard_kpis to authenticated, service_role;
grant execute on function get_low_stock_items to authenticated, service_role;
grant execute on function generate_order_number to authenticated, service_role;
