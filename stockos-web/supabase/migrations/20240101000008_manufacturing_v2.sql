-- StockOS Week 3 — Manufacturing v2 (idempotent)
-- machines, batches, labour_entries, notifications + production_orders.machine_id/location_id

create extension if not exists "uuid-ossp";

create table if not exists machines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  code text not null,
  location_id uuid references locations(id),
  status text default 'IDLE' check (status in ('IDLE','RUNNING','MAINTENANCE','DOWN')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, code)
);

create table if not exists batches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  production_order_id uuid references production_orders(id) on delete cascade not null,
  batch_number text not null,
  quantity numeric(15,4) not null check (quantity > 0),
  quality_status text default 'PENDING' check (quality_status in ('PENDING','PASSED','FAILED','QUARANTINED')),
  expiry_date date,
  notes text,
  created_at timestamptz default now(),
  unique(user_id, batch_number)
);

create table if not exists labour_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  production_order_id uuid references production_orders(id) on delete cascade not null,
  worker_name text not null,
  hours numeric(6,2) not null check (hours > 0),
  rate numeric(10,2) default 0,
  notes text,
  created_at timestamptz default now()
);

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in (
    'LOW_STOCK','PO_RECEIVED','SO_DISPATCHED','PRODUCTION_COMPLETE','ADJUSTMENT_PENDING','SYSTEM'
  )),
  title text not null,
  body text,
  link text,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table production_orders
  add column if not exists machine_id uuid references machines(id);

alter table production_orders
  add column if not exists location_id uuid references locations(id);

-- Indexes
create index if not exists idx_machines_user_status on machines(user_id, status);
create index if not exists idx_batches_production_order on batches(production_order_id);
create index if not exists idx_labour_production_order on labour_entries(production_order_id);
create index if not exists idx_notifications_user_unread
  on notifications(user_id, is_read) where is_read = false;
create index if not exists idx_notifications_user_created
  on notifications(user_id, created_at desc);

-- updated_at triggers
drop trigger if exists update_machines_updated_at on machines;
create trigger update_machines_updated_at before update on machines
  for each row execute function update_updated_at_column();

-- RLS
alter table machines enable row level security;
alter table batches enable row level security;
alter table labour_entries enable row level security;
alter table notifications enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['machines','batches','labour_entries','notifications']
  loop
    execute format('drop policy if exists %I_select on %I', t, t);
    execute format('drop policy if exists %I_insert on %I', t, t);
    execute format('drop policy if exists %I_update on %I', t, t);
    execute format('drop policy if exists %I_delete on %I', t, t);

    execute format(
      'create policy %I_select on %I for select using (user_id = auth.uid())',
      t, t
    );
    execute format(
      'create policy %I_insert on %I for insert with check (user_id = auth.uid())',
      t, t
    );
    execute format(
      'create policy %I_update on %I for update using (user_id = auth.uid())',
      t, t
    );
    execute format(
      'create policy %I_delete on %I for delete using (user_id = auth.uid())',
      t, t
    );
  end loop;
end $$;

-- Realtime (ignore if already members)
do $$
begin
  begin
    alter publication supabase_realtime add table notifications;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table production_orders;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table machines;
  exception when duplicate_object then null;
  end;
end $$;
