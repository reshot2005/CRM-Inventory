-- ════════════════════════════════════════════════════════════
-- STOCKOS SCHEMA — Run in Supabase SQL Editor (Step 1)
-- ════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ── PROFILES ──────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  company_gstin text,
  company_address text,
  phone text,
  logo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── LOCATIONS ─────────────────────────────────────────────
create table if not exists locations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  code text not null,
  type text not null check (type in ('FACTORY','HUB','WAREHOUSE')),
  address text,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(user_id, code)
);

-- ── ITEMS ─────────────────────────────────────────────────
create table if not exists items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  standardized_name text not null,
  product_code text not null,
  brand text,
  category text not null check (category in ('RAW_MATERIAL','FINISHED_GOOD','PACKAGING','OTHER')),
  packaging_type text check (packaging_type in ('BOX','PACKETS','BAGS','ROLL','SHEET','SACKS','OTHERS')),
  packaging_size text,
  min_stock_level numeric default 0,
  specifications jsonb default '{}',
  image_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, product_code)
);

-- ── INVENTORY ─────────────────────────────────────────────
create table if not exists inventory (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  location_id uuid references locations(id) on delete cascade not null,
  item_id uuid references items(id) on delete cascade not null,
  quantity numeric default 0,
  reserved_qty numeric default 0,
  unit_cost numeric default 0,
  updated_at timestamptz default now(),
  unique(user_id, location_id, item_id)
);

-- ── STOCK LEDGER (immutable) ──────────────────────────────
create table if not exists stock_ledger (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  location_id uuid references locations(id) not null,
  item_id uuid references items(id) not null,
  movement_type text not null check (movement_type in (
    'IN','OUT','ADJUSTMENT','TRANSFER_IN','TRANSFER_OUT',
    'PRODUCTION_IN','PRODUCTION_OUT','PURCHASE_RECEIVE','RETURN'
  )),
  quantity numeric not null,
  balance_after numeric not null,
  unit_cost numeric,
  reference_type text,
  reference_id uuid,
  notes text,
  created_at timestamptz default now()
);

-- ── STOCK ADJUSTMENTS ─────────────────────────────────────
create table if not exists stock_adjustments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  item_id uuid references items(id) not null,
  location_id uuid references locations(id) not null,
  quantity numeric not null,
  reason text not null check (reason in ('DAMAGED','EXPIRED','COUNT_CORRECTION','RETURN_FROM_CUSTOMER','PRODUCTION_WASTE','OTHER')),
  notes text,
  status text default 'APPROVED',
  created_at timestamptz default now()
);

-- ── MOVE ORDERS ───────────────────────────────────────────
create table if not exists move_orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  order_number text not null,
  type text not null check (type in ('SALE','TRANSFER','PURCHASE_RECEIVE','RETURN')),
  status text default 'DRAFT' check (status in ('DRAFT','PENDING','APPROVED','IN_TRANSIT','COMPLETED','CANCELLED')),
  from_location_id uuid references locations(id),
  to_location_id uuid references locations(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, order_number)
);

create table if not exists move_order_lines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  move_order_id uuid references move_orders(id) on delete cascade not null,
  item_id uuid references items(id) not null,
  requested_qty numeric not null,
  dispatched_qty numeric,
  received_qty numeric
);

-- ── VENDORS ───────────────────────────────────────────────
create table if not exists vendors (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  vendor_id_display text not null,
  company_name text not null,
  gstin text,
  payment_terms text default 'NET_30',
  remarks text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, vendor_id_display)
);

create table if not exists vendor_contacts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  vendor_id uuid references vendors(id) on delete cascade not null,
  name text not null,
  role text,
  phones text[] default '{}',
  email text,
  is_primary boolean default false
);

create table if not exists vendor_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  vendor_id uuid references vendors(id) on delete cascade not null,
  item_id uuid references items(id) on delete cascade not null,
  unit_price numeric,
  lead_time_days int,
  is_preferred boolean default false,
  unique(user_id, vendor_id, item_id)
);

-- ── PURCHASE ORDERS ───────────────────────────────────────
create table if not exists purchase_orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  po_number text not null,
  vendor_id uuid references vendors(id) not null,
  status text default 'DRAFT' check (status in ('DRAFT','SENT','PARTIALLY_RECEIVED','RECEIVED','CANCELLED')),
  expected_date date,
  total_amount numeric default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, po_number)
);

create table if not exists purchase_order_lines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  purchase_order_id uuid references purchase_orders(id) on delete cascade not null,
  item_id uuid references items(id) not null,
  ordered_qty numeric not null,
  received_qty numeric default 0,
  unit_price numeric not null,
  batch_number text,
  expiry_date date
);

-- ── CUSTOMERS ─────────────────────────────────────────────
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  customer_id_display text not null,
  type text default 'BUSINESS' check (type in ('INDIVIDUAL','BUSINESS')),
  company_name text,
  primary_contact text not null,
  phones text[] default '{}',
  address text,
  gstin text,
  credit_limit numeric,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(user_id, customer_id_display)
);

create table if not exists customer_contacts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete cascade not null,
  name text not null,
  role text,
  phones text[] default '{}',
  email text,
  is_primary boolean default false
);

-- ── SALE ORDERS ───────────────────────────────────────────
create table if not exists sale_orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  order_number text not null,
  customer_id uuid references customers(id) not null,
  status text default 'DRAFT' check (status in ('DRAFT','CONFIRMED','PROCESSING','DISPATCHED','DELIVERED','CANCELLED','RETURNED')),
  location_id uuid references locations(id),
  total_amount numeric default 0,
  amount_paid numeric default 0,
  payment_status text default 'PENDING' check (payment_status in ('PENDING','PARTIAL','PAID','OVERDUE')),
  notes text,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, order_number)
);

create table if not exists sale_order_lines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  sale_order_id uuid references sale_orders(id) on delete cascade not null,
  item_id uuid references items(id) not null,
  quantity numeric not null,
  unit_price numeric not null,
  total_price numeric not null
);

-- ── DELIVERY CHALLANS ─────────────────────────────────────
create table if not exists delivery_challans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  challan_number text not null,
  sale_order_id uuid references sale_orders(id) not null,
  from_address text not null,
  to_address text not null,
  vehicle_no text,
  status text default 'DRAFT' check (status in ('DRAFT','GENERATED','DELIVERED')),
  pdf_url text,
  generated_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, challan_number)
);

-- ── BOMS ──────────────────────────────────────────────────
create table if not exists boms (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  finished_good_id uuid references items(id) not null,
  version text default '1.0',
  yield_qty numeric default 1,
  is_active boolean default true,
  notes text,
  created_at timestamptz default now()
);

create table if not exists bom_lines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  bom_id uuid references boms(id) on delete cascade not null,
  raw_material_id uuid references items(id) not null,
  quantity numeric not null,
  unit text not null,
  waste_percent numeric default 0
);

-- ── PRODUCTION ORDERS ─────────────────────────────────────
create table if not exists production_orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  order_number text not null,
  bom_id uuid references boms(id) not null,
  target_qty numeric not null,
  actual_qty numeric,
  status text default 'PLANNED' check (status in ('PLANNED','IN_PROGRESS','PAUSED','COMPLETED','BLOCKED','CANCELLED')),
  deadline date,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  unique(user_id, order_number)
);

-- ── TRIGGERS ──────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function create_default_location()
returns trigger as $$
begin
  insert into public.locations (user_id, name, code, type)
  values (new.id, 'Main Warehouse', 'WH-001', 'WAREHOUSE');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_profile_created on profiles;
create trigger on_profile_created
  after insert on profiles
  for each row execute function create_default_location();

-- ── updated_at auto-update ────────────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array[
    'items','inventory','move_orders','vendors',
    'purchase_orders','sale_orders','profiles'
  ] loop
    execute format(
      'drop trigger if exists set_%s_updated_at on %s; create trigger set_%s_updated_at before update on %s for each row execute function set_updated_at()',
      t, t, t, t
    );
  end loop;
end $$;

-- ── SEQUENCES ─────────────────────────────────────────────
create sequence if not exists po_seq start 1000;
create sequence if not exists so_seq start 1000;
create sequence if not exists mo_seq start 1000;
create sequence if not exists dc_seq start 1000;
create sequence if not exists prod_seq start 1000;
