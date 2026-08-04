-- ════════════════════════════════════════════════════════════
-- STOCKOS V2 SCHEMA — Advanced Production Automation
-- Run AFTER 001-004 in Supabase SQL Editor
-- ════════════════════════════════════════════════════════════

-- ── ROLES & RBAC ──────────────────────────────────────────
create table if not exists user_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null,
  role text not null default 'STAFF' check (role in ('ADMIN','MANAGER','SUPERVISOR','STAFF','VIEWER','AUDITOR')),
  permissions jsonb default '[]',
  allowed_locations uuid[] default '{}',
  allowed_categories text[] default '{}',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, profile_id)
);

-- ── LABOUR MANAGEMENT ─────────────────────────────────────
create table if not exists labour (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  employee_code text not null,
  full_name text not null,
  phone text,
  email text,
  designation text,
  department text check (department in ('PRODUCTION','PACKAGING','QA','MAINTENANCE','WAREHOUSE','ADMIN','OTHER')),
  daily_wage numeric default 0,
  monthly_salary numeric default 0,
  pay_type text default 'DAILY' check (pay_type in ('DAILY','MONTHLY','CONTRACT')),
  bank_account text,
  bank_ifsc text,
  aadhar_number text,
  pan_number text,
  address text,
  join_date date,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, employee_code)
);

create table if not exists labour_attendance (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  labour_id uuid references labour(id) on delete cascade not null,
  date date not null,
  check_in timestamptz,
  check_out timestamptz,
  status text default 'PRESENT' check (status in ('PRESENT','ABSENT','HALF_DAY','LEAVE','HOLIDAY')),
  hours_worked numeric default 0,
  overtime_hours numeric default 0,
  notes text,
  location_id uuid references locations(id),
  created_at timestamptz default now(),
  unique(user_id, labour_id, date)
);

create table if not exists labour_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  labour_id uuid references labour(id) on delete cascade not null,
  doc_type text not null check (doc_type in ('AADHAR','PAN','BANK_PROOF','PHOTO','CONTRACT','OTHER')),
  file_name text not null,
  file_url text not null,
  uploaded_at timestamptz default now()
);

create table if not exists payroll (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  labour_id uuid references labour(id) on delete cascade not null,
  period_start date not null,
  period_end date not null,
  days_present integer default 0,
  days_absent integer default 0,
  days_half integer default 0,
  overtime_hours numeric default 0,
  base_pay numeric default 0,
  overtime_pay numeric default 0,
  deductions numeric default 0,
  bonuses numeric default 0,
  net_pay numeric default 0,
  status text default 'DRAFT' check (status in ('DRAFT','APPROVED','PAID','CANCELLED')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- ── WIP CUSTOM STAGES ─────────────────────────────────────
create table if not exists wip_stage_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  stages jsonb not null default '[]',
  is_default boolean default false,
  created_at timestamptz default now(),
  unique(user_id, name)
);

create table if not exists wip_tracking (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  production_order_id uuid references production_orders(id) on delete cascade not null,
  stage_name text not null,
  stage_order integer not null,
  status text default 'PENDING' check (status in ('PENDING','IN_PROGRESS','COMPLETED','SKIPPED','BLOCKED')),
  started_at timestamptz,
  completed_at timestamptz,
  assigned_labour_id uuid references labour(id),
  machine_id uuid,
  quantity_in numeric default 0,
  quantity_out numeric default 0,
  rejection_qty numeric default 0,
  notes text,
  created_at timestamptz default now()
);

-- ── BATCH & EXPIRY MANAGEMENT ─────────────────────────────
create table if not exists batches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  batch_number text not null,
  item_id uuid references items(id) on delete cascade not null,
  location_id uuid references locations(id) not null,
  quantity numeric not null default 0,
  manufacturing_date date,
  expiry_date date,
  status text default 'ACTIVE' check (status in ('ACTIVE','EXPIRED','RECALLED','CONSUMED','QUARANTINE')),
  source_type text check (source_type in ('PRODUCTION','PURCHASE','TRANSFER','MANUAL')),
  source_id uuid,
  notes text,
  created_at timestamptz default now(),
  unique(user_id, batch_number, item_id)
);

create table if not exists expiry_alerts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  batch_id uuid references batches(id) on delete cascade not null,
  alert_type text not null check (alert_type in ('APPROACHING','EXPIRED','RECALLED')),
  days_until_expiry integer,
  acknowledged boolean default false,
  acknowledged_at timestamptz,
  created_at timestamptz default now()
);

-- ── MACHINE MAINTENANCE ───────────────────────────────────
create table if not exists machines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  machine_code text not null,
  name text not null,
  location_id uuid references locations(id),
  type text,
  manufacturer text,
  model text,
  serial_number text,
  purchase_date date,
  warranty_until date,
  status text default 'OPERATIONAL' check (status in ('OPERATIONAL','MAINTENANCE','BREAKDOWN','RETIRED')),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, machine_code)
);

create table if not exists maintenance_schedules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  machine_id uuid references machines(id) on delete cascade not null,
  type text not null check (type in ('PREVENTIVE','CORRECTIVE','PREDICTIVE','CALIBRATION')),
  title text not null,
  description text,
  frequency_days integer,
  last_done_at timestamptz,
  next_due_at timestamptz not null,
  assigned_to text,
  status text default 'SCHEDULED' check (status in ('SCHEDULED','IN_PROGRESS','COMPLETED','OVERDUE','CANCELLED')),
  cost numeric default 0,
  notes text,
  created_at timestamptz default now()
);

create table if not exists maintenance_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  schedule_id uuid references maintenance_schedules(id),
  machine_id uuid references machines(id) on delete cascade not null,
  type text not null,
  description text,
  performed_by text,
  performed_at timestamptz default now(),
  downtime_hours numeric default 0,
  cost numeric default 0,
  parts_replaced text,
  notes text,
  created_at timestamptz default now()
);

-- ── QA REPORTS ────────────────────────────────────────────
create table if not exists qa_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  category text,
  checklist jsonb not null default '[]',
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(user_id, name)
);

create table if not exists qa_reports (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  report_number text not null,
  template_id uuid references qa_templates(id),
  item_id uuid references items(id),
  batch_id uuid references batches(id),
  production_order_id uuid references production_orders(id),
  auditor_name text not null,
  inspection_date date not null default current_date,
  result text not null check (result in ('PASS','FAIL','CONDITIONAL','PENDING')),
  checklist_results jsonb default '[]',
  defects_found text,
  corrective_action text,
  attachments text[] default '{}',
  status text default 'DRAFT' check (status in ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED')),
  reviewed_by text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  unique(user_id, report_number)
);

-- ── INVOICES & BILLS ──────────────────────────────────────
create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  invoice_number text not null,
  type text not null check (type in ('SALE','PURCHASE','CREDIT_NOTE','DEBIT_NOTE')),
  reference_type text check (reference_type in ('SALE_ORDER','PURCHASE_ORDER','RETURN')),
  reference_id uuid,
  party_type text check (party_type in ('CUSTOMER','VENDOR','EMPLOYEE')),
  party_id uuid,
  party_name text not null,
  party_gstin text,
  party_address text,
  invoice_date date not null default current_date,
  due_date date,
  subtotal numeric default 0,
  tax_amount numeric default 0,
  discount_amount numeric default 0,
  total_amount numeric default 0,
  amount_paid numeric default 0,
  payment_status text default 'UNPAID' check (payment_status in ('UNPAID','PARTIAL','PAID','OVERDUE','CANCELLED')),
  cgst_rate numeric default 0,
  sgst_rate numeric default 0,
  igst_rate numeric default 0,
  notes text,
  pdf_url text,
  status text default 'DRAFT' check (status in ('DRAFT','GENERATED','SENT','CANCELLED')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, invoice_number)
);

create table if not exists invoice_lines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  invoice_id uuid references invoices(id) on delete cascade not null,
  item_id uuid references items(id),
  description text not null,
  hsn_code text,
  quantity numeric not null,
  unit text default 'pcs',
  unit_price numeric not null,
  tax_rate numeric default 0,
  tax_amount numeric default 0,
  discount numeric default 0,
  total numeric not null
);

create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  invoice_id uuid references invoices(id) on delete cascade not null,
  amount numeric not null,
  method text check (method in ('CASH','BANK_TRANSFER','UPI','CHEQUE','CREDIT','OTHER')),
  reference_number text,
  paid_at timestamptz default now(),
  notes text,
  created_at timestamptz default now()
);

-- ── DELIVERY TYPES (Client + Employee) ────────────────────
create table if not exists delivery_types (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  category text not null check (category in ('CLIENT','EMPLOYEE','INTERNAL','SAMPLE','RETURN','OTHER')),
  description text,
  requires_challan boolean default true,
  requires_invoice boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(user_id, name)
);

-- Add delivery_type to sale_orders
alter table sale_orders add column if not exists delivery_type_id uuid references delivery_types(id);
alter table sale_orders add column if not exists recipient_type text check (recipient_type in ('CLIENT','EMPLOYEE','OTHER'));
alter table sale_orders add column if not exists employee_recipient_id uuid references labour(id);

-- ── PACKED BUT UNLABELED STOCK ────────────────────────────
alter table items add column if not exists sub_status text check (sub_status in ('UNLABELED','LABELED','QUARANTINE'));

-- ── ADDITIONAL ITEM HIERARCHY ─────────────────────────────
alter table items add column if not exists variant text;
alter table items add column if not exists parent_item_id uuid references items(id);

-- ── ENABLE RLS ON ALL NEW TABLES ──────────────────────────
do $$ declare t text;
begin
  foreach t in array array[
    'user_roles','labour','labour_attendance','labour_documents','payroll',
    'wip_stage_templates','wip_tracking',
    'batches','expiry_alerts',
    'machines','maintenance_schedules','maintenance_logs',
    'qa_templates','qa_reports',
    'invoices','invoice_lines','payments',
    'delivery_types'
  ] loop
    execute format('alter table %s enable row level security', t);
    execute format(
      'drop policy if exists "%s_user_policy" on %s', t, t
    );
    execute format(
      'create policy "%s_user_policy" on %s for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t, t
    );
  end loop;
end $$;

-- ── REALTIME ON NEW TABLES ────────────────────────────────
alter publication supabase_realtime add table labour_attendance;
alter publication supabase_realtime add table wip_tracking;
alter publication supabase_realtime add table batches;
alter publication supabase_realtime add table maintenance_schedules;
alter publication supabase_realtime add table qa_reports;
alter publication supabase_realtime add table invoices;

-- ── SEQUENCES ─────────────────────────────────────────────
create sequence if not exists inv_seq start 1000;
create sequence if not exists qa_seq start 100;
create sequence if not exists lab_seq start 100;

-- ── AUTO updated_at ───────────────────────────────────────
do $$ declare t text;
begin
  foreach t in array array[
    'labour','machines','invoices','user_roles'
  ] loop
    execute format(
      'drop trigger if exists set_%s_updated_at on %s; create trigger set_%s_updated_at before update on %s for each row execute function set_updated_at()',
      t, t, t, t
    );
  end loop;
end $$;

-- ── STORAGE for labour docs ───────────────────────────────
-- Create bucket 'labour-docs' in Supabase Dashboard (PRIVATE, 10MB)
drop policy if exists "user_owns_labour_docs" on storage.objects;
create policy "user_owns_labour_docs"
  on storage.objects for all
  using (bucket_id = 'labour-docs' AND (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'labour-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── STORAGE for invoices ──────────────────────────────────
-- Create bucket 'invoices' in Supabase Dashboard (PRIVATE, 10MB)
drop policy if exists "user_owns_invoices" on storage.objects;
create policy "user_owns_invoices"
  on storage.objects for all
  using (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── STORAGE for QA attachments ────────────────────────────
-- Create bucket 'qa-attachments' in Supabase Dashboard (PRIVATE, 10MB)
drop policy if exists "user_owns_qa_attachments" on storage.objects;
create policy "user_owns_qa_attachments"
  on storage.objects for all
  using (bucket_id = 'qa-attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'qa-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
