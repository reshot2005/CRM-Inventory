-- StockOS Week 4 — organization access
-- This is the highest-risk migration in the project. Keep every operation atomic.
begin;

create extension if not exists "uuid-ossp";

create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_id uuid references auth.users(id) not null,
  plan text default 'FREE' check (plan in ('FREE','GROWTH','SCALE')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- A user has one active StockOS organization in the Week 4 model.
create unique index if not exists organizations_owner_id_key
  on organizations(owner_id);

create table if not exists organization_members (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('OWNER','ADMIN','MANAGER','STAFF')),
  invited_by uuid references auth.users(id),
  invited_at timestamptz default now(),
  joined_at timestamptz,
  status text default 'PENDING' check (status in ('PENDING','ACTIVE','REVOKED')),
  unique(org_id, user_id)
);

-- Prevent the helper's LIMIT 1 from hiding an ambiguous active membership.
create unique index if not exists organization_members_one_active_org_per_user
  on organization_members(user_id) where status = 'ACTIVE';
create index if not exists organization_members_org_status_idx
  on organization_members(org_id, status);

create table if not exists organization_invites (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade not null,
  email text not null,
  role text not null check (role in ('ADMIN','MANAGER','STAFF')),
  token uuid default uuid_generate_v4() not null,
  invited_by uuid references auth.users(id) not null,
  expires_at timestamptz default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz default now(),
  unique(org_id, email, token)
);

create unique index if not exists organization_invites_token_key
  on organization_invites(token);
create index if not exists organization_invites_org_pending_idx
  on organization_invites(org_id, created_at desc) where accepted_at is null;

-- These helpers are deliberately no-argument and resolve only the JWT subject.
create or replace function get_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id
  from organization_members
  where user_id = auth.uid()
    and status = 'ACTIVE'
  limit 1
$$;

create or replace function get_user_org_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from organization_members
  where user_id = auth.uid()
    and org_id = get_user_org_id()
    and status = 'ACTIVE'
  limit 1
$$;

-- SECURITY DEFINER RPCs call this before accepting a legacy p_user_id.
create or replace function assert_rpc_caller(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
begin
  if v_role <> 'service_role' and (auth.uid() is null or auth.uid() <> p_user_id) then
    raise exception 'AUTH_001: RPC user does not match authenticated user'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function get_active_org_for_user(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id
  from organization_members
  where user_id = p_user_id
    and status = 'ACTIVE'
  limit 1
$$;

-- Backfill one organization and OWNER membership for every existing auth user.
-- auth.users is authoritative and also covers users with no business rows yet.
insert into organizations (name, owner_id)
select
  coalesce(nullif(btrim(p.company_name), ''), 'My Company'),
  u.id
from auth.users u
left join profiles p on p.id = u.id
on conflict (owner_id) do nothing;

do $migration$
begin
  if exists (
    select 1
    from organizations o
    join organization_members m on m.user_id = o.owner_id
    where (
      m.status = 'ACTIVE' and m.org_id <> o.id
    ) or (
      m.org_id = o.id
      and (m.status <> 'ACTIVE' or m.role <> 'OWNER')
    )
  ) then
    raise exception 'ORG_018: conflicting pre-existing owner membership';
  end if;
end
$migration$;

insert into organization_members (
  org_id, user_id, role, status, invited_at, joined_at
)
select o.id, o.owner_id, 'OWNER', 'ACTIVE', now(), now()
from organizations o
on conflict (org_id, user_id) do nothing;

do $migration$
begin
  if exists (
    select 1
    from organizations o
    left join organization_members m
      on m.org_id = o.id
     and m.user_id = o.owner_id
     and m.role = 'OWNER'
     and m.status = 'ACTIVE'
    where m.id is null
  ) then
    raise exception 'ORG_022: organization is missing its active OWNER';
  end if;
end
$migration$;

create unique index if not exists organization_members_one_owner_per_org
  on organization_members(org_id) where role = 'OWNER';

-- Profiles use id rather than user_id. The other 29 tables retain user_id as
-- creator/audit context, while org_id becomes the isolation key.
alter table profiles add column if not exists org_id uuid references organizations(id);

do $migration$
declare
  t text;
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
    execute format(
      'alter table public.%I add column if not exists org_id uuid references public.organizations(id)',
      t
    );
  end loop;
end
$migration$;

update profiles p
set org_id = m.org_id
from organization_members m
where m.user_id = p.id
  and m.role = 'OWNER'
  and m.status = 'ACTIVE'
  and p.org_id is null;

do $migration$
begin
  if exists (select 1 from profiles where org_id is null) then
    raise exception 'ORG_015: profile organization backfill is incomplete';
  end if;
end
$migration$;
alter table profiles alter column org_id set not null;

-- Append-only ledger triggers block org_id backfill UPDATEs. Disable only for
-- this backfill, then re-enable before constraints/policies continue.
alter table stock_ledger disable trigger stock_ledger_forbid_update;
alter table stock_ledger disable trigger stock_ledger_forbid_delete;

do $migration$
declare
  t text;
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
    execute format(
      'update public.%I x
         set org_id = m.org_id
        from public.organization_members m
       where m.user_id = x.user_id
         and m.role = ''OWNER''
         and m.status = ''ACTIVE''
         and x.org_id is null',
      t
    );
  end loop;
end
$migration$;

alter table stock_ledger enable trigger stock_ledger_forbid_update;
alter table stock_ledger enable trigger stock_ledger_forbid_delete;

-- Abort the entire transaction instead of leaving a partially scoped table.
do $migration$
declare
  t text;
  null_count bigint;
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
    execute format('select count(*) from public.%I where org_id is null', t)
      into null_count;
    if null_count <> 0 then
      raise exception 'ORG_003: org_id backfill left % NULL rows in %',
        null_count, t;
    end if;
    execute format(
      'alter table public.%I alter column org_id set not null',
      t
    );
  end loop;
end
$migration$;

-- Existing clients need not send org_id. The trigger derives it exclusively
-- from the authenticated session; RLS still validates the resulting value.
create or replace function set_row_org_id()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is not null and new.user_id is distinct from auth.uid() then
    raise exception 'ORG_008: user_id must match authenticated user'
      using errcode = '42501';
  end if;
  if new.org_id is null then
    new.org_id := get_user_org_id();
  end if;
  if new.org_id is null then
    raise exception 'ORG_004: no active organization for authenticated user'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function protect_row_tenant_keys()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.org_id is distinct from old.org_id then
    raise exception 'ORG_016: org_id is immutable'
      using errcode = '42501';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'ORG_017: user_id creator attribution is immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

do $migration$
declare
  t text;
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
    execute format('drop trigger if exists set_%I_org_id on public.%I', t, t);
    execute format('drop trigger if exists a_set_%I_org_id on public.%I', t, t);
    execute format(
      'create trigger a_set_%I_org_id
       before insert on public.%I
       for each row execute function public.set_row_org_id()',
      t, t
    );
    execute format(
      'drop trigger if exists a_protect_%I_tenant_keys on public.%I',
      t, t
    );
    execute format(
      'create trigger a_protect_%I_tenant_keys
       before update on public.%I
       for each row execute function public.protect_row_tenant_keys()',
      t, t
    );
    execute format(
      'create index if not exists %I on public.%I(org_id)',
      'idx_' || t || '_org_id', t
    );
  end loop;
end
$migration$;

-- A plain org_id FK does not prove a child and its parent share an org. Every
-- organization-bound relationship is checked at the database boundary.
create or replace function enforce_same_org_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_id uuid;
  v_matches boolean;
begin
  v_parent_id := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;
  if v_parent_id is null then
    return new;
  end if;

  execute format(
    'select exists (
       select 1 from public.%I where id = $1 and org_id = $2
     )',
    tg_argv[1]
  )
  into v_matches
  using v_parent_id, new.org_id;

  if not v_matches then
    raise exception 'ORG_012: %.% references a row outside organization %',
      tg_table_name, tg_argv[0], new.org_id
      using errcode = '23503';
  end if;
  return new;
end;
$$;

do $relations$
declare
  r record;
  trigger_name text;
begin
  for r in
    select *
    from (values
      ('inventory','location_id','locations'),
      ('inventory','item_id','items'),
      ('stock_ledger','location_id','locations'),
      ('stock_ledger','item_id','items'),
      ('stock_adjustments','location_id','locations'),
      ('stock_adjustments','item_id','items'),
      ('move_orders','from_location_id','locations'),
      ('move_orders','to_location_id','locations'),
      ('move_order_lines','move_order_id','move_orders'),
      ('move_order_lines','item_id','items'),
      ('vendor_contacts','vendor_id','vendors'),
      ('vendor_items','vendor_id','vendors'),
      ('vendor_items','item_id','items'),
      ('purchase_orders','vendor_id','vendors'),
      ('purchase_order_lines','purchase_order_id','purchase_orders'),
      ('purchase_order_lines','item_id','items'),
      ('purchase_order_lines','location_id','locations'),
      ('customer_contacts','customer_id','customers'),
      ('customer_activities','customer_id','customers'),
      ('sale_orders','customer_id','customers'),
      ('sale_orders','location_id','locations'),
      ('sale_order_lines','sale_order_id','sale_orders'),
      ('sale_order_lines','item_id','items'),
      ('payments','sale_order_id','sale_orders'),
      ('delivery_challans','sale_order_id','sale_orders'),
      ('boms','finished_good_id','items'),
      ('bom_lines','bom_id','boms'),
      ('bom_lines','raw_material_id','items'),
      ('production_orders','bom_id','boms'),
      ('production_orders','machine_id','machines'),
      ('production_orders','location_id','locations'),
      ('production_material_lines','production_order_id','production_orders'),
      ('production_material_lines','raw_material_id','items'),
      ('machines','location_id','locations'),
      ('batches','production_order_id','production_orders'),
      ('labour_entries','production_order_id','production_orders')
    ) as refs(child_table, child_column, parent_table)
  loop
    trigger_name :=
      'enforce_' || r.child_table || '_' || r.child_column || '_org';
    execute format(
      'drop trigger if exists %I on public.%I',
      trigger_name, r.child_table
    );
    execute format(
      'create trigger %I
       before insert or update of org_id, %I on public.%I
       for each row execute function public.enforce_same_org_reference(%L, %L)',
      trigger_name, r.child_column, r.child_table,
      r.child_column, r.parent_table
    );
  end loop;
end
$relations$;

do $validate_relations$
declare
  r record;
  mismatch_count bigint;
begin
  for r in
    select *
    from (values
      ('inventory','location_id','locations'),
      ('inventory','item_id','items'),
      ('stock_ledger','location_id','locations'),
      ('stock_ledger','item_id','items'),
      ('stock_adjustments','location_id','locations'),
      ('stock_adjustments','item_id','items'),
      ('move_orders','from_location_id','locations'),
      ('move_orders','to_location_id','locations'),
      ('move_order_lines','move_order_id','move_orders'),
      ('move_order_lines','item_id','items'),
      ('vendor_contacts','vendor_id','vendors'),
      ('vendor_items','vendor_id','vendors'),
      ('vendor_items','item_id','items'),
      ('purchase_orders','vendor_id','vendors'),
      ('purchase_order_lines','purchase_order_id','purchase_orders'),
      ('purchase_order_lines','item_id','items'),
      ('purchase_order_lines','location_id','locations'),
      ('customer_contacts','customer_id','customers'),
      ('customer_activities','customer_id','customers'),
      ('sale_orders','customer_id','customers'),
      ('sale_orders','location_id','locations'),
      ('sale_order_lines','sale_order_id','sale_orders'),
      ('sale_order_lines','item_id','items'),
      ('payments','sale_order_id','sale_orders'),
      ('delivery_challans','sale_order_id','sale_orders'),
      ('boms','finished_good_id','items'),
      ('bom_lines','bom_id','boms'),
      ('bom_lines','raw_material_id','items'),
      ('production_orders','bom_id','boms'),
      ('production_orders','machine_id','machines'),
      ('production_orders','location_id','locations'),
      ('production_material_lines','production_order_id','production_orders'),
      ('production_material_lines','raw_material_id','items'),
      ('machines','location_id','locations'),
      ('batches','production_order_id','production_orders'),
      ('labour_entries','production_order_id','production_orders')
    ) as refs(child_table, child_column, parent_table)
  loop
    execute format(
      'select count(*)
         from public.%I child
         join public.%I parent on parent.id = child.%I
        where child.org_id is distinct from parent.org_id',
      r.child_table, r.parent_table, r.child_column
    ) into mismatch_count;
    if mismatch_count <> 0 then
      raise exception 'ORG_020: %.% has % cross-organization references',
        r.child_table, r.child_column, mismatch_count;
    end if;
  end loop;
end
$validate_relations$;

create or replace function enforce_document_entity_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
  v_matches boolean;
begin
  v_table := case new.entity_type
    when 'VENDOR' then 'vendors'
    when 'CUSTOMER' then 'customers'
    when 'PURCHASE_ORDER' then 'purchase_orders'
    when 'SALE_ORDER' then 'sale_orders'
    when 'ITEM' then 'items'
  end;
  if v_table is null then
    raise exception 'ORG_013: unsupported document entity type %', new.entity_type
      using errcode = '23514';
  end if;
  execute format(
    'select exists (
       select 1 from public.%I where id = $1 and org_id = $2
     )',
    v_table
  )
  into v_matches
  using new.entity_id, new.org_id;
  if not v_matches then
    raise exception 'ORG_014: document entity belongs to another organization'
      using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_documents_entity_org on documents;
create trigger enforce_documents_entity_org
before insert or update of org_id, entity_type, entity_id on documents
for each row execute function enforce_document_entity_org();

do $validate_documents$
declare
  mismatch_count bigint;
begin
  select count(*) into mismatch_count
  from documents d
  where not case d.entity_type
    when 'VENDOR' then exists (
      select 1 from vendors x where x.id = d.entity_id and x.org_id = d.org_id
    )
    when 'CUSTOMER' then exists (
      select 1 from customers x where x.id = d.entity_id and x.org_id = d.org_id
    )
    when 'PURCHASE_ORDER' then exists (
      select 1 from purchase_orders x where x.id = d.entity_id and x.org_id = d.org_id
    )
    when 'SALE_ORDER' then exists (
      select 1 from sale_orders x where x.id = d.entity_id and x.org_id = d.org_id
    )
    when 'ITEM' then exists (
      select 1 from items x where x.id = d.entity_id and x.org_id = d.org_id
    )
    else false
  end;
  if mismatch_count <> 0 then
    raise exception 'ORG_021: documents has % invalid organization references',
      mismatch_count;
  end if;
end
$validate_documents$;

-- Business identifiers are organization-scoped now, not creator-scoped.
alter table locations drop constraint if exists locations_user_id_code_key;
alter table locations drop constraint if exists locations_org_id_code_key;
alter table locations add constraint locations_org_id_code_key unique(org_id, code);
alter table items drop constraint if exists items_user_id_product_code_key;
alter table items drop constraint if exists items_org_id_product_code_key;
alter table items add constraint items_org_id_product_code_key unique(org_id, product_code);
alter table inventory drop constraint if exists inventory_user_id_location_id_item_id_key;
alter table inventory drop constraint if exists inventory_org_location_item_key;
alter table inventory add constraint inventory_org_location_item_key
  unique(org_id, location_id, item_id);
alter table move_orders drop constraint if exists move_orders_user_id_order_number_key;
alter table move_orders drop constraint if exists move_orders_org_order_number_key;
alter table move_orders add constraint move_orders_org_order_number_key
  unique(org_id, order_number);
alter table vendors drop constraint if exists vendors_user_id_vendor_id_display_key;
alter table vendors drop constraint if exists vendors_org_vendor_display_key;
alter table vendors add constraint vendors_org_vendor_display_key
  unique(org_id, vendor_id_display);
alter table vendor_items drop constraint if exists vendor_items_user_id_vendor_id_item_id_key;
alter table vendor_items drop constraint if exists vendor_items_org_vendor_item_key;
alter table vendor_items add constraint vendor_items_org_vendor_item_key
  unique(org_id, vendor_id, item_id);
alter table purchase_orders drop constraint if exists purchase_orders_user_id_po_number_key;
alter table purchase_orders drop constraint if exists purchase_orders_org_po_number_key;
alter table purchase_orders add constraint purchase_orders_org_po_number_key
  unique(org_id, po_number);
alter table customers drop constraint if exists customers_user_id_customer_id_display_key;
alter table customers drop constraint if exists customers_org_customer_display_key;
alter table customers add constraint customers_org_customer_display_key
  unique(org_id, customer_id_display);
alter table sale_orders drop constraint if exists sale_orders_user_id_order_number_key;
alter table sale_orders drop constraint if exists sale_orders_org_order_number_key;
alter table sale_orders add constraint sale_orders_org_order_number_key
  unique(org_id, order_number);
alter table delivery_challans drop constraint if exists delivery_challans_user_id_challan_number_key;
alter table delivery_challans drop constraint if exists delivery_challans_org_challan_number_key;
alter table delivery_challans add constraint delivery_challans_org_challan_number_key
  unique(org_id, challan_number);
alter table production_orders drop constraint if exists production_orders_user_id_order_number_key;
alter table production_orders drop constraint if exists production_orders_org_order_number_key;
alter table production_orders add constraint production_orders_org_order_number_key
  unique(org_id, order_number);
alter table machines drop constraint if exists machines_user_id_code_key;
alter table machines drop constraint if exists machines_org_code_key;
alter table machines add constraint machines_org_code_key unique(org_id, code);
alter table batches drop constraint if exists batches_user_id_batch_number_key;
alter table batches drop constraint if exists batches_org_batch_number_key;
alter table batches add constraint batches_org_batch_number_key unique(org_id, batch_number);

-- RLS for organization control tables.
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table organization_invites enable row level security;

drop policy if exists organizations_select on organizations;
drop policy if exists organizations_update on organizations;
create policy organizations_select on organizations for select
  using (id = get_user_org_id());
create policy organizations_update on organizations for update
  using (
    id = get_user_org_id()
    and get_user_org_role() = 'OWNER'
  )
  with check (
    id = get_user_org_id()
    and owner_id = auth.uid()
  );

revoke insert, delete on organizations from anon, authenticated;
revoke update on organizations from anon, authenticated;
grant select on organizations to authenticated;
grant update (name, updated_at) on organizations to authenticated;

create or replace function protect_organization_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'ORG_009: organization owner_id is immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_organization_owner_update on organizations;
create trigger protect_organization_owner_update
before update on organizations
for each row execute function protect_organization_owner();

drop policy if exists organization_members_select on organization_members;
drop policy if exists organization_members_insert on organization_members;
drop policy if exists organization_members_update on organization_members;
drop policy if exists organization_members_delete on organization_members;
create policy organization_members_select on organization_members for select
  using (org_id = get_user_org_id());
create policy organization_members_insert on organization_members for insert
  with check (
    org_id = get_user_org_id()
    and get_user_org_role() in ('OWNER','ADMIN')
    and role <> 'OWNER'
  );
create policy organization_members_update on organization_members for update
  using (
    org_id = get_user_org_id()
    and get_user_org_role() in ('OWNER','ADMIN')
  )
  with check (
    org_id = get_user_org_id()
    and role <> 'OWNER'
  );
create policy organization_members_delete on organization_members for delete
  using (
    org_id = get_user_org_id()
    and get_user_org_role() in ('OWNER','ADMIN')
  );

-- OWNER membership cannot be changed or removed. Ownership transfer is
-- intentionally out of scope and must be a separate audited transaction.
create or replace function protect_owner_membership()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.role = 'OWNER' and not exists (
      select 1 from organizations
      where id = new.org_id and owner_id = new.user_id
    ) then
      raise exception 'ORG_010: OWNER membership must match organization owner'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- Cascading organization deletes remove OWNER rows after the parent is gone.
  if tg_op = 'DELETE'
    and old.role = 'OWNER'
    and not exists (select 1 from organizations where id = old.org_id)
  then
    return old;
  end if;

  if old.role = 'OWNER' then
    raise exception 'ORG_005: owner membership cannot be changed or removed'
      using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (
    new.org_id is distinct from old.org_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'ORG_019: membership organization and user are immutable'
      using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.role = 'OWNER' then
    raise exception 'ORG_011: ownership transfer requires a dedicated workflow'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_owner_membership_insert on organization_members;
create trigger protect_owner_membership_insert
before insert on organization_members
for each row execute function protect_owner_membership();
drop trigger if exists protect_owner_membership_update on organization_members;
create trigger protect_owner_membership_update
before update on organization_members
for each row execute function protect_owner_membership();
drop trigger if exists protect_owner_membership_delete on organization_members;
create trigger protect_owner_membership_delete
before delete on organization_members
for each row execute function protect_owner_membership();

drop policy if exists organization_invites_select on organization_invites;
drop policy if exists organization_invites_insert on organization_invites;
drop policy if exists organization_invites_update on organization_invites;
drop policy if exists organization_invites_delete on organization_invites;
create policy organization_invites_select on organization_invites for select
  using (org_id = get_user_org_id());
create policy organization_invites_insert on organization_invites for insert
  with check (
    org_id = get_user_org_id()
    and invited_by = auth.uid()
    and get_user_org_role() in ('OWNER','ADMIN')
  );
create policy organization_invites_update on organization_invites for update
  using (
    org_id = get_user_org_id()
    and get_user_org_role() in ('OWNER','ADMIN')
  )
  with check (org_id = get_user_org_id());
create policy organization_invites_delete on organization_invites for delete
  using (
    org_id = get_user_org_id()
    and get_user_org_role() in ('OWNER','ADMIN')
  );

-- Profiles are readable by organization peers but writable only by their user.
drop policy if exists profiles_select on profiles;
drop policy if exists profiles_insert on profiles;
drop policy if exists profiles_update on profiles;
create policy profiles_select on profiles for select
  using (id = auth.uid() or org_id = get_user_org_id());
create policy profiles_insert on profiles for insert
  with check (id = auth.uid());
create policy profiles_update on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and org_id = get_user_org_id());

-- Replace every legacy user_id policy with one org policy.
do $migration$
declare
  t text;
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
    execute format('drop policy if exists %I on public.%I', t || '_all_policy', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('drop policy if exists %I on public.%I', t || '_org_policy', t);

    execute format(
      'create policy %I on public.%I for all
       using (org_id = public.get_user_org_id())
       with check (org_id = public.get_user_org_id())',
      t || '_org_policy', t
    );
  end loop;
end
$migration$;

-- Ledger remains immutable even for OWNER.
drop policy if exists stock_ledger_no_delete on stock_ledger;
drop policy if exists stock_ledger_no_update on stock_ledger;
create policy stock_ledger_no_delete on stock_ledger
  as restrictive for delete using (false);
create policy stock_ledger_no_update on stock_ledger
  as restrictive for update using (false);

-- STAFF can run daily operations but cannot perform these destructive actions.
drop policy if exists vendors_delete_role_restricted on vendors;
create policy vendors_delete_role_restricted on vendors
  as restrictive for delete
  using (get_user_org_role() in ('OWNER','ADMIN','MANAGER'));

drop policy if exists customers_delete_role_restricted on customers;
create policy customers_delete_role_restricted on customers
  as restrictive for delete
  using (get_user_org_role() in ('OWNER','ADMIN','MANAGER'));

-- For STAFF, both the old and new adjustment must remain PENDING. This blocks
-- PENDING -> APPROVED/REJECTED even when sent directly to PostgREST.
drop policy if exists stock_adjustments_approve_role_restricted on stock_adjustments;
create policy stock_adjustments_approve_role_restricted on stock_adjustments
  as restrictive for update
  using (
    get_user_org_role() in ('OWNER','ADMIN','MANAGER')
    or status = 'PENDING'
  )
  with check (
    get_user_org_role() in ('OWNER','ADMIN','MANAGER')
    or status = 'PENDING'
  );

drop policy if exists audit_logs_select_role_restricted on audit_logs;
create policy audit_logs_select_role_restricted on audit_logs
  as restrictive for select
  using (get_user_org_role() in ('OWNER','ADMIN'));

drop policy if exists audit_logs_no_update on audit_logs;
drop policy if exists audit_logs_no_delete on audit_logs;
create policy audit_logs_no_update on audit_logs
  as restrictive for update using (false);
create policy audit_logs_no_delete on audit_logs
  as restrictive for delete using (false);

create or replace function prevent_audit_log_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'AUDIT_001: audit log is append-only'
    using errcode = '42501';
end;
$$;

drop trigger if exists prevent_audit_log_update on audit_logs;
create trigger prevent_audit_log_update
before update on audit_logs
for each row execute function prevent_audit_log_mutation();
drop trigger if exists prevent_audit_log_delete on audit_logs;
create trigger prevent_audit_log_delete
before delete on audit_logs
for each row execute function prevent_audit_log_mutation();

-- New signups get an organization before any org-scoped row is inserted.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  insert into organizations (name, owner_id)
  values (
    coalesce(nullif(new.raw_user_meta_data->>'company_name', ''), 'My Company'),
    new.id
  )
  on conflict (owner_id) do update set owner_id = excluded.owner_id
  returning id into v_org_id;

  insert into profiles (id, full_name, org_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_org_id
  )
  on conflict (id) do update
  set org_id = excluded.org_id;

  insert into organization_members (
    org_id, user_id, role, status, invited_at, joined_at
  )
  values (v_org_id, new.id, 'OWNER', 'ACTIVE', now(), now())
  on conflict (org_id, user_id) do nothing;

  insert into locations (user_id, org_id, name, code, type, address)
  values (
    new.id, v_org_id, 'Main Warehouse', 'WH-001', 'WAREHOUSE',
    'Default Location'
  )
  on conflict (org_id, code) do nothing;

  return new;
end;
$$;

-- The signature remains compatible, but p_user_id can no longer be forged by
-- an authenticated caller to cross an organization boundary.
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
  v_org_id uuid;
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
  v_org_id := get_active_org_for_user(p_user_id);
  if v_org_id is null then
    raise exception 'ORG_006: user has no active organization'
      using errcode = '42501';
  end if;

  -- Foreign keys alone do not guarantee that these records share an org.
  if not exists (
    select 1 from locations
    where id = p_location_id and org_id = v_org_id
  ) or not exists (
    select 1 from items
    where id = p_item_id and org_id = v_org_id
  ) then
    raise exception 'ORG_007: item or location belongs to another organization'
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
  where org_id = v_org_id
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
      p_user_id, v_org_id, p_location_id, p_item_id, 0,
      coalesce(p_unit_cost, 0)
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
  where org_id = v_org_id
    and location_id = p_location_id
    and item_id = p_item_id;

  insert into stock_ledger (
    user_id, org_id, location_id, item_id, movement_type, quantity,
    balance_after, unit_cost, reference_type, reference_id, notes, created_by
  )
  values (
    p_user_id, v_org_id, p_location_id, p_item_id, p_movement_type,
    abs(p_quantity), v_new_qty, v_new_cost, p_reference_type, p_reference_id,
    p_notes, coalesce(p_created_by, p_user_id)
  )
  returning id into v_ledger_id;

  return jsonb_build_object(
    'success', true,
    'new_balance', v_new_qty,
    'new_cost', v_new_cost,
    'ledger_id', v_ledger_id,
    'org_id', v_org_id
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
  v_org_id uuid;
  v_total_skus int;
  v_low_stock int;
  v_purchase_orders int;
  v_pending_deliveries int;
  v_revenue_mtd numeric;
  v_pending_approvals int;
begin
  perform assert_rpc_caller(p_user_id);
  v_org_id := get_active_org_for_user(p_user_id);

  select count(*) into v_total_skus
  from items where org_id = v_org_id and is_active = true;

  select count(distinct i.item_id) into v_low_stock
  from inventory i
  join items it on it.id = i.item_id and it.org_id = i.org_id
  where i.org_id = v_org_id
    and i.quantity <= it.min_stock_level
    and it.min_stock_level > 0
    and it.is_active = true;

  select count(*) into v_purchase_orders
  from purchase_orders
  where org_id = v_org_id and status not in ('CANCELLED','RECEIVED');

  select count(*) into v_pending_deliveries
  from sale_orders
  where org_id = v_org_id
    and status in ('CONFIRMED','PROCESSING','DISPATCHED');

  select coalesce(sum(total_amount), 0) into v_revenue_mtd
  from sale_orders
  where org_id = v_org_id
    and status <> 'CANCELLED'
    and date_trunc('month', created_at) = date_trunc('month', now());

  select count(*) into v_pending_approvals
  from stock_adjustments
  where org_id = v_org_id and status = 'PENDING';

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
declare
  v_org_id uuid;
begin
  perform assert_rpc_caller(p_user_id);
  v_org_id := get_active_org_for_user(p_user_id);

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
    (it.min_stock_level - i.quantity)
  from inventory i
  join items it on it.id = i.item_id and it.org_id = i.org_id
  join locations l on l.id = i.location_id and l.org_id = i.org_id
  where i.org_id = v_org_id
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
  v_org_id uuid;
  v_count int;
  v_year text := to_char(now(), 'YY');
begin
  perform assert_rpc_caller(p_user_id);
  v_org_id := get_active_org_for_user(p_user_id);
  if v_org_id is null then
    raise exception 'ORG_006: user has no active organization'
      using errcode = '42501';
  end if;

  case p_prefix
    when 'PO' then select count(*) + 1 into v_count from purchase_orders where org_id = v_org_id;
    when 'SO' then select count(*) + 1 into v_count from sale_orders where org_id = v_org_id;
    when 'MO' then select count(*) + 1 into v_count from move_orders where org_id = v_org_id;
    when 'DC' then select count(*) + 1 into v_count from delivery_challans where org_id = v_org_id;
    when 'PRD' then select count(*) + 1 into v_count from production_orders where org_id = v_org_id;
    when 'VEN' then select count(*) + 1 into v_count from vendors where org_id = v_org_id;
    when 'CUS' then select count(*) + 1 into v_count from customers where org_id = v_org_id;
    else v_count := 1;
  end case;

  return p_prefix || '-' || v_year || '-' || lpad(v_count::text, 4, '0');
end;
$$;

revoke all on function assert_rpc_caller(uuid) from public, anon, authenticated;
revoke all on function get_active_org_for_user(uuid) from public, anon, authenticated;
revoke all on function get_user_org_id() from public, anon;
revoke all on function get_user_org_role() from public, anon;
revoke all on function process_stock_movement(
  uuid,uuid,uuid,text,numeric,numeric,text,uuid,text,uuid
) from public, anon;
revoke all on function get_dashboard_kpis(uuid) from public, anon;
revoke all on function get_low_stock_items(uuid) from public, anon;
revoke all on function generate_order_number(uuid,text) from public, anon;
revoke all on function enforce_same_org_reference() from public, anon, authenticated;
revoke all on function enforce_document_entity_org() from public, anon, authenticated;
grant execute on function get_user_org_id() to authenticated;
grant execute on function get_user_org_role() to authenticated;
grant execute on function process_stock_movement(
  uuid,uuid,uuid,text,numeric,numeric,text,uuid,text,uuid
) to authenticated, service_role;
grant execute on function get_dashboard_kpis(uuid) to authenticated, service_role;
grant execute on function get_low_stock_items(uuid) to authenticated, service_role;
grant execute on function generate_order_number(uuid,text) to authenticated, service_role;

commit;
