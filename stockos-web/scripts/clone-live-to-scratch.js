/**
 * Clone live StockOS public data into scratch + recreate auth users via Admin API.
 * Does NOT apply Week 4 org migration. Live is read-only.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.join(__dirname, '..');
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');

const LIVE_URL =
  process.env.SUPABASE_DB_URL ||
  'postgresql://postgres.msfnajafbdmjixbqqhvn:aksharaintern123@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

const OWNER_EMAIL = 'admin@stockos.com';
const OWNER_PASSWORD = 'ScratchOwner@123';
const OUTSIDER_EMAIL = 'aksharaenterprisesintern@gmail.com';
const OUTSIDER_PASSWORD = 'ScratchOutsider@123';

const TABLES = [
  'profiles',
  'locations',
  'items',
  'inventory',
  'stock_ledger',
  'stock_adjustments',
  'move_orders',
  'move_order_lines',
  'vendors',
  'vendor_contacts',
  'vendor_items',
  'purchase_orders',
  'purchase_order_lines',
  'customers',
  'customer_contacts',
  'customer_activities',
  'sale_orders',
  'sale_order_lines',
  'payments',
  'delivery_challans',
  'boms',
  'bom_lines',
  'production_orders',
  'production_material_lines',
  'documents',
  'audit_logs',
  'machines',
  'batches',
  'labour_entries',
  'notifications',
];

function loadScratchEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(ROOT, '.env.scratch'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function pg(url) {
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
}

async function applyWeek1to3(scratch) {
  const files = fs
    .readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('rollback_') && !f.includes('00009'))
    .sort();
  for (const file of files) {
    process.stdout.write(`Applying ${file}... `);
    await scratch.query(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
    console.log('OK');
  }
}

async function recreateAuthUsers(live, scratchAdmin) {
  const { rows } = await live.query(
    `select id, email, raw_user_meta_data
     from auth.users
     where email is not null
     order by created_at`,
  );
  console.log(
    'LIVE_USERS',
    rows.map((r) => ({ id: r.id, email: r.email })),
  );

  for (const id of rows.map((r) => r.id)) {
    await scratchAdmin.auth.admin.deleteUser(id).catch(() => {});
  }
  const existing = await scratchAdmin.auth.admin.listUsers({ perPage: 100 });
  for (const u of existing.data?.users || []) {
    await scratchAdmin.auth.admin.deleteUser(u.id).catch(() => {});
  }
  await new Promise((r) => setTimeout(r, 1500));

  const created = [];
  for (const u of rows) {
    const email = (u.email || '').toLowerCase();
    let password = `ScratchUser@${u.id.slice(0, 8)}`;
    if (email === OWNER_EMAIL) password = OWNER_PASSWORD;
    if (email === OUTSIDER_EMAIL) password = OUTSIDER_PASSWORD;

    let data;
    let error;
    ({ data, error } = await scratchAdmin.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password,
      email_confirm: true,
      user_metadata: u.raw_user_meta_data || {},
    }));
    if (error && /already/i.test(error.message)) {
      ({ data, error } = await scratchAdmin.auth.admin.updateUserById(u.id, {
        password,
        email_confirm: true,
        user_metadata: u.raw_user_meta_data || {},
      }));
      if (!error) data = { user: { id: u.id, email: u.email } };
    }
    if (error) throw new Error(`createUser ${u.email}: ${error.message}`);
    created.push({ id: data.user.id, email: data.user.email || u.email, password });
    console.log('AUTH_READY', data.user.email || u.email, data.user.id);
  }
  return created;
}

async function copyPublicTables(live, scratch) {
  await scratch.query('begin');
  try {
    await scratch.query('set local session_replication_role = replica');
    for (const table of [...TABLES].reverse()) {
      await scratch.query(`truncate table public.${table} cascade`);
    }
    for (const table of TABLES) {
      const { rows } = await live.query(`select * from public.${table}`);
      if (!rows.length) {
        console.log(`COPY ${table}: 0`);
        continue;
      }
      const cols = Object.keys(rows[0]);
      for (const row of rows) {
        await scratch.query(
          `insert into public.${table} (${cols.join(',')})
           values (${cols.map((_, i) => `$${i + 1}`).join(',')})`,
          cols.map((c) => row[c]),
        );
      }
      console.log(`COPY ${table}: ${rows.length}`);
    }
    await scratch.query('commit');
  } catch (e) {
    await scratch.query('rollback');
    throw e;
  }
}

async function installSentinel(scratch, projectRef) {
  await scratch.query(`
    create table if not exists public.migration_test_sentinel (
      environment text primary key,
      project_ref text not null,
      allow_destructive_tests boolean not null
    )
  `);
  await scratch.query(
    `
    insert into public.migration_test_sentinel
      (environment, project_ref, allow_destructive_tests)
    values ('scratch', $1, true)
    on conflict (environment) do update
    set project_ref = excluded.project_ref,
        allow_destructive_tests = excluded.allow_destructive_tests
  `,
    [projectRef],
  );
}

async function countOwner(scratch, table, ownerId) {
  const col = table === 'profiles' ? 'id' : 'user_id';
  const { rows } = await scratch.query(
    `select count(*)::int as n from public.${table} where ${col} = $1`,
    [ownerId],
  );
  return rows[0].n;
}

async function seedOwnerFixtures(scratch, ownerId) {
  const loc = (
    await scratch.query(
      `select id from locations where user_id = $1 and is_active = true limit 1`,
      [ownerId],
    )
  ).rows[0];
  const item = (
    await scratch.query(`select id from items where user_id = $1 limit 1`, [ownerId])
  ).rows[0];
  const raw = (
    await scratch.query(
      `select id from items where user_id = $1 and category = 'RAW_MATERIAL' limit 1`,
      [ownerId],
    )
  ).rows[0];
  const fg = (
    await scratch.query(
      `select id from items where user_id = $1 and category = 'FINISHED_GOOD' limit 1`,
      [ownerId],
    )
  ).rows[0];
  const vendor = (
    await scratch.query(`select id from vendors where user_id = $1 limit 1`, [ownerId])
  ).rows[0];
  const customer = (
    await scratch.query(`select id from customers where user_id = $1 limit 1`, [ownerId])
  ).rows[0];
  const po = (
    await scratch.query(`select id from purchase_orders where user_id = $1 limit 1`, [
      ownerId,
    ])
  ).rows[0];
  const so = (
    await scratch.query(`select id from sale_orders where user_id = $1 limit 1`, [ownerId])
  ).rows[0];
  const bom = (
    await scratch.query(`select id from boms where user_id = $1 limit 1`, [ownerId])
  ).rows[0];
  const prd = (
    await scratch.query(
      `select id from production_orders where user_id = $1 limit 1`,
      [ownerId],
    )
  ).rows[0];

  if (!loc || !item || !vendor || !customer) {
    throw new Error('Clone missing core Owner fixtures (location/item/vendor/customer)');
  }

  if ((await countOwner(scratch, 'stock_adjustments', ownerId)) === 0) {
    await scratch.query(
      `insert into stock_adjustments
        (user_id, item_id, location_id, quantity, adjustment_type, reason, status, created_by)
       values ($1,$2,$3,1,'ADD','COUNT_CORRECTION','PENDING',$1)`,
      [ownerId, item.id, loc.id],
    );
  }

  let moveId = (
    await scratch.query(`select id from move_orders where user_id = $1 limit 1`, [ownerId])
  ).rows[0]?.id;
  if (!moveId) {
    const ins = await scratch.query(
      `insert into move_orders
        (user_id, order_number, type, status, from_location_id, to_location_id, created_by)
       values ($1,'MO-FIX-0001','TRANSFER','DRAFT',$2,$2,$1)
       returning id`,
      [ownerId, loc.id],
    );
    moveId = ins.rows[0].id;
  }
  if ((await countOwner(scratch, 'move_order_lines', ownerId)) === 0) {
    await scratch.query(
      `insert into move_order_lines (user_id, move_order_id, item_id, requested_qty)
       values ($1,$2,$3,1)`,
      [ownerId, moveId, item.id],
    );
  }

  if ((await countOwner(scratch, 'vendor_contacts', ownerId)) === 0) {
    await scratch.query(
      `insert into vendor_contacts (user_id, vendor_id, name, is_primary)
       values ($1,$2,'Fixture Contact',true)`,
      [ownerId, vendor.id],
    );
  }
  if ((await countOwner(scratch, 'vendor_items', ownerId)) === 0) {
    await scratch.query(
      `insert into vendor_items (user_id, vendor_id, item_id, unit_price)
       values ($1,$2,$3,10)`,
      [ownerId, vendor.id, item.id],
    );
  }

  if ((await countOwner(scratch, 'customer_contacts', ownerId)) === 0) {
    await scratch.query(
      `insert into customer_contacts (user_id, customer_id, name, is_primary)
       values ($1,$2,'Fixture Contact',true)`,
      [ownerId, customer.id],
    );
  }
  if ((await countOwner(scratch, 'customer_activities', ownerId)) === 0) {
    await scratch.query(
      `insert into customer_activities (user_id, customer_id, type, content, created_by)
       values ($1,$2,'NOTE','fixture',$1)`,
      [ownerId, customer.id],
    );
  }

  if (so && (await countOwner(scratch, 'payments', ownerId)) === 0) {
    await scratch.query(
      `insert into payments (user_id, sale_order_id, amount, mode, received_by)
       values ($1,$2,1,'CASH',$1)`,
      [ownerId, so.id],
    );
  }
  if (so && (await countOwner(scratch, 'delivery_challans', ownerId)) === 0) {
    await scratch.query(
      `insert into delivery_challans
        (user_id, challan_number, sale_order_id, from_address, to_address, status)
       values ($1,'DC-FIX-0001',$2,'A','B','DRAFT')`,
      [ownerId, so.id],
    );
  }

  if ((await countOwner(scratch, 'documents', ownerId)) === 0) {
    await scratch.query(
      `insert into documents
        (user_id, entity_type, entity_id, file_name, file_key, mime_type, uploaded_by)
       values ($1,'ITEM',$2,'fixture.txt','fixture/fixture.txt','text/plain',$1)`,
      [ownerId, item.id],
    );
  }
  if ((await countOwner(scratch, 'audit_logs', ownerId)) === 0) {
    await scratch.query(
      `insert into audit_logs (user_id, action, entity_type, entity_id, new_values)
       values ($1,'CREATE','SYSTEM',null,'{"fixture":true}'::jsonb)`,
      [ownerId],
    );
  }

  let machineId = (
    await scratch.query(`select id from machines where user_id = $1 limit 1`, [ownerId])
  ).rows[0]?.id;
  if (!machineId) {
    const ins = await scratch.query(
      `insert into machines (user_id, name, code, location_id, status)
       values ($1,'Fixture Machine','M-FIX-1',$2,'IDLE')
       returning id`,
      [ownerId, loc.id],
    );
    machineId = ins.rows[0].id;
  }

  if (prd && (await countOwner(scratch, 'labour_entries', ownerId)) === 0) {
    await scratch.query(
      `insert into labour_entries (user_id, production_order_id, worker_name, hours, rate)
       values ($1,$2,'Fixture Worker',1,100)`,
      [ownerId, prd.id],
    );
  }

  // Ensure outsider also has at least profiles/locations from auth trigger leftovers
  // already handled by copied data. Rehearsal compares exact outsider sets.
  void raw;
  void fg;
  void po;
  void bom;
  void machineId;

  const empty = [];
  for (const table of TABLES) {
    if ((await countOwner(scratch, table, ownerId)) === 0) empty.push(table);
  }
  console.log('OWNER_EMPTY_TABLES', empty);
  if (empty.length) {
    throw new Error(`Owner fixtures still missing: ${empty.join(',')}`);
  }
}

async function main() {
  const scratchEnv = loadScratchEnv();
  if (scratchEnv.SUPABASE_SCRATCH_PROJECT_REF === 'msfnajafbdmjixbqqhvn') {
    throw new Error('Refusing to write to live project');
  }

  const live = pg(LIVE_URL);
  const scratch = pg(scratchEnv.SUPABASE_SCRATCH_DB_URL);
  const scratchAdmin = createClient(
    scratchEnv.SUPABASE_SCRATCH_URL,
    scratchEnv.SUPABASE_SCRATCH_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  await live.connect();
  await scratch.connect();

  try {
    const liveCount = await live.query(
      `select count(*)::int as n from information_schema.tables
       where table_schema='public' and table_name = any($1::text[])`,
      [TABLES],
    );
    console.log('LIVE_TABLES', liveCount.rows[0].n);

    console.log('Resetting scratch public schema...');
    await scratch.query(`
      drop schema if exists public cascade;
      create schema public;
      grant usage on schema public to postgres, anon, authenticated, service_role;
      grant all on schema public to postgres, anon, authenticated, service_role;
      grant all on all tables in schema public to postgres, anon, authenticated, service_role;
      alter default privileges in schema public
        grant all on tables to postgres, anon, authenticated, service_role;
    `);

    console.log('Applying Week 1–3 migrations to scratch...');
    await applyWeek1to3(scratch);

    const users = await recreateAuthUsers(live, scratchAdmin);
    await copyPublicTables(live, scratch);
    await installSentinel(scratch, scratchEnv.SUPABASE_SCRATCH_PROJECT_REF);

    const owner = users.find((u) => (u.email || '').toLowerCase() === OWNER_EMAIL);
    const outsider = users.find((u) => (u.email || '').toLowerCase() === OUTSIDER_EMAIL);
    if (!owner || !outsider) throw new Error('Owner or outsider missing after auth recreate');

    await seedOwnerFixtures(scratch, owner.id);

    // Outsider needs >=0 exact set; ensure at least profiles row exists (copied).
    const outsiderProfile = await countOwner(scratch, 'profiles', outsider.id);
    if (!outsiderProfile) {
      await scratch.query(
        `insert into profiles (id, full_name) values ($1,'Outsider') on conflict do nothing`,
        [outsider.id],
      );
    }

    const verify = await scratch.query(`
      select
        (select count(*)::int from auth.users) as auth_users,
        (select count(*)::int from public.items) as items,
        (select count(*)::int from public.locations) as locations,
        (select project_ref from public.migration_test_sentinel where environment='scratch') as sentinel_ref
    `);
    console.log('SCRATCH_VERIFY', verify.rows[0]);

    let body = fs.readFileSync(path.join(ROOT, '.env.scratch'), 'utf8');
    const upsert = (key, value) => {
      const line = `${key}=${value}`;
      if (new RegExp(`^${key}=`, 'm').test(body)) {
        body = body.replace(new RegExp(`^${key}=.*$`, 'm'), line);
      } else {
        body += (body.endsWith('\n') ? '' : '\n') + line + '\n';
      }
    };
    upsert('W4_TEST_OWNER_EMAIL', OWNER_EMAIL);
    upsert('W4_TEST_OWNER_PASSWORD', OWNER_PASSWORD);
    upsert('W4_TEST_OUTSIDER_EMAIL', OUTSIDER_EMAIL);
    upsert('W4_TEST_OUTSIDER_PASSWORD', OUTSIDER_PASSWORD);
    fs.writeFileSync(path.join(ROOT, '.env.scratch'), body);

    // Sign-in smoke
    const anon = createClient(
      scratchEnv.SUPABASE_SCRATCH_URL,
      scratchEnv.SUPABASE_SCRATCH_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    for (const [email, password] of [
      [OWNER_EMAIL, OWNER_PASSWORD],
      [OUTSIDER_EMAIL, OUTSIDER_PASSWORD],
    ]) {
      const { error } = await anon.auth.signInWithPassword({ email, password });
      if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
      console.log('SIGNIN_OK', email);
      await anon.auth.signOut();
    }

    console.log('PHASE0_CLONE_READY', {
      owner: OWNER_EMAIL,
      outsider: OUTSIDER_EMAIL,
      passwords_in: '.env.scratch',
    });
  } finally {
    await live.end();
    await scratch.end();
  }
}

main().catch((e) => {
  console.error('CLONE_FAIL', e.message);
  process.exit(1);
});
