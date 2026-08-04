-- StockOS Week 1 — Initial multi-tenant schema (idempotent)
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  company_gstin text,
  company_address text,
  company_phone text,
  logo_url text,
  timezone text default 'Asia/Kolkata',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles add column if not exists company_phone text;
alter table profiles add column if not exists timezone text default 'Asia/Kolkata';

create table if not exists locations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  code text not null,
  type text not null check (type in ('FACTORY','HUB','WAREHOUSE','STORE')),
  address text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, code)
);

create table if not exists items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  standardized_name text not null,
  product_code text not null,
  brand text,
  category text not null check (category in ('RAW_MATERIAL','FINISHED_GOOD','PACKAGING','OTHER')),
  packaging_type text check (packaging_type in ('BOX','PACKETS','BAGS','ROLL','SHEET','SACKS','OTHERS')),
  packaging_size text,
  unit text default 'pcs',
  min_stock_level numeric(15,4) default 0,
  specifications jsonb default '{}',
  image_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, product_code)
);

create table if not exists inventory (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  location_id uuid references locations(id) on delete cascade not null,
  item_id uuid references items(id) on delete cascade not null,
  quantity numeric(15,4) default 0 check (quantity >= 0),
  reserved_qty numeric(15,4) default 0 check (reserved_qty >= 0),
  unit_cost numeric(15,4) default 0,
  updated_at timestamptz default now(),
  unique(user_id, location_id, item_id)
);

create table if not exists stock_ledger (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  location_id uuid references locations(id) not null,
  item_id uuid references items(id) not null,
  movement_type text not null check (movement_type in (
    'IN','OUT','ADJUSTMENT_IN','ADJUSTMENT_OUT','TRANSFER_IN','TRANSFER_OUT',
    'PRODUCTION_IN','PRODUCTION_OUT','PURCHASE_RECEIVE','SALE_DISPATCH','RETURN_IN','RETURN_OUT'
  )),
  quantity numeric(15,4) not null check (quantity > 0),
  balance_after numeric(15,4) not null,
  unit_cost numeric(15,4) default 0,
  reference_type text check (reference_type in (
    'PURCHASE_ORDER','SALE_ORDER','MOVE_ORDER','PRODUCTION_ORDER','ADJUSTMENT','MANUAL'
  )),
  reference_id uuid,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists stock_adjustments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  item_id uuid references items(id) not null,
  location_id uuid references locations(id) not null,
  quantity numeric(15,4) not null,
  adjustment_type text not null check (adjustment_type in ('ADD','REMOVE','CORRECT')),
  reason text not null check (reason in (
    'DAMAGED','EXPIRED','COUNT_CORRECTION','RETURN_FROM_CUSTOMER',
    'PRODUCTION_WASTE','THEFT','FOUND','OTHER'
  )),
  notes text,
  status text default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists move_orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  order_number text not null,
  type text not null check (type in ('SALE','TRANSFER','PURCHASE_RECEIVE','RETURN')),
  status text default 'DRAFT' check (status in (
    'DRAFT','PENDING','APPROVED','IN_TRANSIT','COMPLETED','CANCELLED'
  )),
  from_location_id uuid references locations(id),
  to_location_id uuid references locations(id),
  dispatched_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, order_number)
);

create table if not exists move_order_lines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  move_order_id uuid references move_orders(id) on delete cascade not null,
  item_id uuid references items(id) not null,
  requested_qty numeric(15,4) not null check (requested_qty > 0),
  dispatched_qty numeric(15,4) default 0,
  received_qty numeric(15,4) default 0
);

create table if not exists vendors (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  vendor_id_display text not null,
  company_name text not null,
  gstin text,
  pan text,
  payment_terms text default 'NET_30' check (payment_terms in (
    'ADVANCE','COD','NET_7','NET_15','NET_30','NET_45','NET_60','NET_90'
  )),
  credit_limit numeric(15,2) default 0,
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
  is_primary boolean default false,
  created_at timestamptz default now()
);

create table if not exists vendor_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  vendor_id uuid references vendors(id) on delete cascade not null,
  item_id uuid references items(id) on delete cascade not null,
  unit_price numeric(15,4),
  lead_time_days int default 7,
  is_preferred boolean default false,
  unique(user_id, vendor_id, item_id)
);

create table if not exists purchase_orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  po_number text not null,
  vendor_id uuid references vendors(id) not null,
  status text default 'DRAFT' check (status in (
    'DRAFT','SENT','PARTIALLY_RECEIVED','RECEIVED','CANCELLED'
  )),
  expected_date date,
  total_amount numeric(15,2) default 0,
  received_amount numeric(15,2) default 0,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, po_number)
);

create table if not exists purchase_order_lines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  purchase_order_id uuid references purchase_orders(id) on delete cascade not null,
  item_id uuid references items(id) not null,
  ordered_qty numeric(15,4) not null check (ordered_qty > 0),
  received_qty numeric(15,4) default 0,
  unit_price numeric(15,4) not null check (unit_price >= 0),
  batch_number text,
  expiry_date date,
  location_id uuid references locations(id)
);

create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  customer_id_display text not null,
  type text default 'BUSINESS' check (type in ('INDIVIDUAL','BUSINESS')),
  company_name text,
  primary_contact text not null,
  phones text[] default '{}',
  address text,
  city text,
  state text,
  gstin text,
  pan text,
  credit_limit numeric(15,2) default 0,
  outstanding_balance numeric(15,2) default 0,
  payment_terms text default 'NET_30',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
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

create table if not exists customer_activities (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete cascade not null,
  type text not null check (type in ('NOTE','CALL','ORDER','PAYMENT','SYSTEM','EMAIL')),
  content text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists sale_orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  order_number text not null,
  customer_id uuid references customers(id) not null,
  status text default 'DRAFT' check (status in (
    'DRAFT','CONFIRMED','PROCESSING','DISPATCHED','DELIVERED','CANCELLED','RETURNED'
  )),
  location_id uuid references locations(id),
  total_amount numeric(15,2) default 0,
  amount_paid numeric(15,2) default 0,
  payment_status text default 'PENDING' check (payment_status in (
    'PENDING','PARTIAL','PAID','OVERDUE'
  )),
  notes text,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, order_number)
);

create table if not exists sale_order_lines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  sale_order_id uuid references sale_orders(id) on delete cascade not null,
  item_id uuid references items(id) not null,
  quantity numeric(15,4) not null check (quantity > 0),
  unit_price numeric(15,4) not null check (unit_price >= 0),
  total_price numeric(15,4) not null
);

create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  sale_order_id uuid references sale_orders(id) not null,
  amount numeric(15,2) not null check (amount > 0),
  mode text not null check (mode in ('CASH','CHEQUE','NEFT','RTGS','UPI','CREDIT','OTHER')),
  reference_no text,
  bank_name text,
  clearance_date date,
  notes text,
  received_by uuid references auth.users(id),
  received_at timestamptz default now()
);

create table if not exists delivery_challans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  challan_number text not null,
  sale_order_id uuid references sale_orders(id) not null,
  from_address text not null,
  to_address text not null,
  vehicle_no text,
  driver_name text,
  driver_phone text,
  status text default 'DRAFT' check (status in ('DRAFT','GENERATED','DELIVERED')),
  pdf_url text,
  generated_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, challan_number)
);

create table if not exists boms (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  finished_good_id uuid references items(id) not null,
  version text default '1.0',
  yield_qty numeric(15,4) default 1,
  yield_unit text default 'unit',
  is_active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists bom_lines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  bom_id uuid references boms(id) on delete cascade not null,
  raw_material_id uuid references items(id) not null,
  quantity numeric(15,4) not null check (quantity > 0),
  unit text not null,
  waste_percent numeric(5,2) default 0 check (waste_percent >= 0 and waste_percent <= 100)
);

create table if not exists production_orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  order_number text not null,
  bom_id uuid references boms(id) not null,
  target_qty numeric(15,4) not null check (target_qty > 0),
  actual_qty numeric(15,4),
  status text default 'PLANNED' check (status in (
    'PLANNED','IN_PROGRESS','PAUSED','COMPLETED','BLOCKED','CANCELLED'
  )),
  deadline date,
  started_at timestamptz,
  completed_at timestamptz,
  batch_number text,
  yield_percent numeric(5,2),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, order_number)
);

create table if not exists production_material_lines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  production_order_id uuid references production_orders(id) on delete cascade not null,
  raw_material_id uuid references items(id) not null,
  required_qty numeric(15,4) not null,
  consumed_qty numeric(15,4) default 0,
  variance numeric(15,4) default 0
);

create table if not exists documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entity_type text not null check (entity_type in (
    'VENDOR','CUSTOMER','PURCHASE_ORDER','SALE_ORDER','ITEM'
  )),
  entity_id uuid not null,
  file_name text not null,
  file_key text not null,
  file_url text,
  mime_type text not null,
  file_size_bytes int,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz default now()
);

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  action text not null check (action in (
    'CREATE','UPDATE','DELETE','APPROVE','REJECT','LOGIN','LOGOUT'
  )),
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);
