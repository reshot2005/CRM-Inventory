/**
 * Week 4 destructive migration rehearsal.
 *
 * This script intentionally refuses to run without a distinct scratch project.
 * It applies the forward migration, checks row preservation and three-actor
 * RLS on every business table, applies the rollback, and validates restoration.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.join(__dirname, '..');
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');
const TABLES = [
  'locations','items','inventory','stock_ledger','stock_adjustments',
  'move_orders','move_order_lines','vendors','vendor_contacts','vendor_items',
  'purchase_orders','purchase_order_lines','customers','customer_contacts',
  'customer_activities','sale_orders','sale_order_lines','payments',
  'delivery_challans','boms','bom_lines','production_orders',
  'production_material_lines','documents','audit_logs',
  'machines','batches','labour_entries','notifications',
];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function loadLocalEnv() {
  // Prefer untracked scratch file; fall back to .env.local for shared live refs.
  loadEnvFile(path.join(ROOT, '.env.scratch'));
  loadEnvFile(path.join(ROOT, '.env.local'));
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assertScratchOnly(dbUrl, apiUrl) {
  const expectedRef = requireEnv('SUPABASE_SCRATCH_PROJECT_REF');
  const apiRef = new URL(apiUrl).hostname.split('.')[0];
  const parsedDb = new URL(dbUrl);
  const dbUser = decodeURIComponent(parsedDb.username);
  const directHostMatch = parsedDb.hostname.match(/^db\.([^.]+)\.supabase\.co$/);
  const dbRef = dbUser.includes('.')
    ? dbUser.slice(dbUser.lastIndexOf('.') + 1)
    : directHostMatch?.[1];
  const normalApiRef = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
    : null;
  if (!dbRef || dbRef !== apiRef || apiRef !== expectedRef) {
    throw new Error('Scratch DB URL, API URL, and expected project ref do not match');
  }
  if (normalApiRef && normalApiRef === expectedRef) {
    throw new Error('Refusing to run against the configured application project');
  }
  if (process.env.SUPABASE_DB_URL) {
    const normalDb = new URL(process.env.SUPABASE_DB_URL);
    if (
      normalDb.hostname === parsedDb.hostname
      && decodeURIComponent(normalDb.username) === dbUser
      && normalDb.pathname === parsedDb.pathname
    ) {
      throw new Error('Refusing to run against the configured application database');
    }
  }
  return expectedRef;
}

async function signIn(url, anonKey, email, password) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return client;
}

async function idsVisible(client, table) {
  const { data, error } = await client
    .from(table)
    .select('id')
    .order('id');
  if (error) throw new Error(`${table} query failed: ${error.message}`);
  return (data || []).map((row) => row.id);
}

async function main() {
  loadLocalEnv();
  const dbUrl = requireEnv('SUPABASE_SCRATCH_DB_URL');
  const apiUrl = requireEnv('SUPABASE_SCRATCH_URL');
  const anonKey = requireEnv('SUPABASE_SCRATCH_ANON_KEY');
  const serviceKey = requireEnv('SUPABASE_SCRATCH_SERVICE_ROLE_KEY');
  const ownerEmail = requireEnv('W4_TEST_OWNER_EMAIL');
  const ownerPassword = requireEnv('W4_TEST_OWNER_PASSWORD');
  const outsiderEmail = requireEnv('W4_TEST_OUTSIDER_EMAIL');
  const outsiderPassword = requireEnv('W4_TEST_OUTSIDER_PASSWORD');
  const expectedProjectRef = assertScratchOnly(dbUrl, apiUrl);

  const pg = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  const service = createClient(apiUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const forward = fs.readFileSync(
    path.join(MIGRATIONS, '20240101000009_org_access.sql'),
    'utf8',
  );
  const rollback = fs.readFileSync(
    path.join(MIGRATIONS, 'rollback_20240101000009.sql'),
    'utf8',
  );

  let adminUserId;
  let adminBootstrapOrgId;
  let forwardApplied = false;
  let rollbackApplied = false;
  await pg.connect();
  try {
    const { rows: sentinel } = await pg.query(
      `select project_ref
         from public.migration_test_sentinel
        where environment = 'scratch'
          and allow_destructive_tests = true`,
    );
    if (
      sentinel.length !== 1
      || sentinel[0].project_ref !== expectedProjectRef
    ) {
      throw new Error('Scratch database sentinel is missing or does not match');
    }

    // Validate all pre-existing actors before any migration SQL executes.
    const owner = await signIn(apiUrl, anonKey, ownerEmail, ownerPassword);
    const outsider = await signIn(
      apiUrl, anonKey, outsiderEmail, outsiderPassword,
    );
    const { data: ownerAuth } = await owner.auth.getUser();
    const { data: outsiderAuth } = await outsider.auth.getUser();
    const ownerId = ownerAuth.user.id;
    const outsiderId = outsiderAuth.user.id;
    if (ownerId === outsiderId) throw new Error('Test actors are not distinct');
    const { rows: actorRows } = await pg.query(
      'select id from auth.users where id = any($1::uuid[])',
      [[ownerId, outsiderId]],
    );
    if (actorRows.length !== 2) {
      throw new Error('API actors do not both exist in the scratch database');
    }

    const before = new Map();
    for (const table of TABLES) {
      const { rows } = await pg.query(
        `select coalesce(
           jsonb_agg((to_jsonb(t) - 'org_id' - 'updated_at') order by id),
           '[]'::jsonb
         )::text as snapshot
         from public.${table} t`,
      );
      before.set(table, rows[0].snapshot);
    }

    console.log('Applying forward migration to scratch clone...');
    await pg.query(forward);
    forwardApplied = true;
    await pg.query(`select pg_notify('pgrst', 'reload schema')`);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    for (const table of TABLES) {
      const { rows } = await pg.query(
        `select coalesce(
                  jsonb_agg((to_jsonb(t) - 'org_id' - 'updated_at') order by id),
                  '[]'::jsonb
                )::text as snapshot,
                count(*) filter (where org_id is null)::int as null_orgs
           from public.${table} t`,
      );
      if (rows[0].snapshot !== before.get(table) || rows[0].null_orgs !== 0) {
        throw new Error(
          `${table}: row preservation/null check failed: ${JSON.stringify(rows[0])}`,
        );
      }
      const mapping = await pg.query(
        `select count(*)::int as mismatches
           from public.${table} t
           left join organization_members m
             on m.user_id = t.user_id
            and m.role = 'OWNER'
            and m.status = 'ACTIVE'
          where m.org_id is null or t.org_id <> m.org_id`,
      );
      if (mapping.rows[0].mismatches !== 0) {
        throw new Error(`${table}: user-to-owner organization mapping is wrong`);
      }
    }

    const { rows: policyRows } = await pg.query(
      `select tablename, count(*)::int as n
         from pg_policies
        where schemaname = 'public'
          and tablename = any($1::text[])
          and policyname = tablename || '_org_policy'
          and cmd = 'ALL'
          and qual like '%get_user_org_id()%'
          and with_check like '%get_user_org_id()%'
        group by tablename`,
      [TABLES],
    );
    if (
      policyRows.length !== TABLES.length
      || policyRows.some((row) => row.n !== 1)
    ) {
      throw new Error('Every table must have exactly one complete org policy');
    }

    const { rows: ownerMembership } = await pg.query(
      `select org_id from organization_members
        where user_id = $1 and status = 'ACTIVE'`,
      [ownerId],
    );
    if (ownerMembership.length !== 1) {
      throw new Error('Owner does not have exactly one active organization');
    }
    const ownerOrgId = ownerMembership[0].org_id;

    const adminEmail =
      `w4-admin-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@example.test`;
    const adminPassword = `W4!${crypto.randomBytes(18).toString('base64url')}`;
    const { data: created, error: createError } =
      await service.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: { full_name: 'Week 4 Scratch Admin' },
      });
    if (createError) throw createError;
    adminUserId = created.user.id;

    const { rows: bootstrap } = await pg.query(
      `select org_id from organization_members
        where user_id = $1 and status = 'ACTIVE'`,
      [adminUserId],
    );
    adminBootstrapOrgId = bootstrap[0].org_id;
    await pg.query('begin');
    try {
      await pg.query(
        'update profiles set org_id = $1 where id = $2',
        [ownerOrgId, adminUserId],
      );
      await pg.query(
        'delete from locations where user_id = $1 and org_id = $2',
        [adminUserId, adminBootstrapOrgId],
      );
      await pg.query(
        'delete from organizations where id = $1 and owner_id = $2',
        [adminBootstrapOrgId, adminUserId],
      );
      await pg.query(
        `insert into organization_members
          (org_id,user_id,role,status,invited_by,joined_at)
         values ($1,$2,'ADMIN','ACTIVE',$3,now())`,
        [ownerOrgId, adminUserId, ownerId],
      );
      await pg.query('commit');
    } catch (error) {
      await pg.query('rollback');
      throw error;
    }

    const admin = await signIn(apiUrl, anonKey, adminEmail, adminPassword);
    const outsiderMembership = await pg.query(
      `select org_id from organization_members
        where user_id = $1 and status = 'ACTIVE'`,
      [outsiderId],
    );
    const outsiderOrgId = outsiderMembership.rows[0].org_id;
    for (const table of TABLES) {
      const expectedOwner = await service
        .from(table).select('id').eq('org_id', ownerOrgId).order('id');
      if (expectedOwner.error) throw expectedOwner.error;
      const expectedOwnerIds = expectedOwner.data.map((row) => row.id);
      if (expectedOwnerIds.length === 0) {
        throw new Error(`${table}: scratch clone needs an Owner fixture`);
      }
      const ownerIds = await idsVisible(owner, table);
      const adminIds = await idsVisible(admin, table);
      const outsiderIds = await idsVisible(outsider, table);
      if (
        JSON.stringify(ownerIds) !== JSON.stringify(expectedOwnerIds)
        || JSON.stringify(adminIds) !== JSON.stringify(expectedOwnerIds)
      ) {
        throw new Error(`${table}: Owner/Admin visibility is not the exact expected set`);
      }
      if (outsiderIds.some((id) => expectedOwnerIds.includes(id))) {
        throw new Error(`${table}: unrelated user can see Owner organization rows`);
      }
      const expectedOutsider = await service
        .from(table).select('id').eq('org_id', outsiderOrgId).order('id');
      if (
        expectedOutsider.error
        || JSON.stringify(outsiderIds)
          !== JSON.stringify((expectedOutsider.data || []).map((row) => row.id))
      ) {
        throw new Error(`${table}: outsider visibility is not its exact expected set`);
      }
      console.log(`PASS ${table}: exact Owner/Admin set; outsider isolated`);
    }

    const ownerLocation = await service
      .from('locations').select('id').eq('org_id', ownerOrgId).limit(1).single();
    const ownerItem = await service
      .from('items').select('id').eq('org_id', ownerOrgId).limit(1).single();
    if (ownerLocation.error || ownerItem.error) {
      throw new Error('Owner location/item fixtures are required for RPC tests');
    }
    const ledgerBefore = await pg.query(
      'select count(*)::int as n from stock_ledger',
    );
    const forgedCalls = [
      ['get_dashboard_kpis', { p_user_id: ownerId }],
      ['get_low_stock_items', { p_user_id: ownerId }],
      ['generate_order_number', { p_user_id: ownerId, p_prefix: 'SO' }],
      ['process_stock_movement', {
        p_user_id: ownerId,
        p_location_id: ownerLocation.data.id,
        p_item_id: ownerItem.data.id,
        p_movement_type: 'IN',
        p_quantity: 1,
      }],
    ];
    for (const [rpc, args] of forgedCalls) {
      const { error } = await outsider.rpc(rpc, args);
      if (
        !error
        || error.code !== '42501'
        || !error.message.includes('AUTH_001')
      ) {
        throw new Error(`${rpc}: forged caller was not rejected as AUTH_001/42501`);
      }
    }
    const ledgerAfter = await pg.query(
      'select count(*)::int as n from stock_ledger',
    );
    if (ledgerAfter.rows[0].n !== ledgerBefore.rows[0].n) {
      throw new Error('Forged movement RPC produced a side effect');
    }

    await admin.from('organization_members')
      .update({ role: 'OWNER' }).eq('user_id', adminUserId);
    await admin.from('organizations')
      .update({ owner_id: adminUserId }).eq('id', ownerOrgId);
    const ownership = await pg.query(
      `select o.owner_id, m.role
         from organizations o
         join organization_members m
           on m.org_id = o.id and m.user_id = $2
        where o.id = $1`,
      [ownerOrgId, adminUserId],
    );
    if (
      ownership.rows[0].owner_id !== ownerId
      || ownership.rows[0].role !== 'ADMIN'
    ) {
      throw new Error('ADMIN escalated to OWNER');
    }

    const ownerVendor = await service
      .from('vendors').select('id').eq('org_id', ownerOrgId).limit(1).single();
    if (ownerVendor.error) throw new Error('Owner vendor fixture is required');
    const forgedContact = await outsider.from('vendor_contacts').insert({
      user_id: outsiderId,
      vendor_id: ownerVendor.data.id,
      name: 'Cross-org probe',
    });
    if (!forgedContact.error || forgedContact.error.code !== '23503') {
      throw new Error('Cross-org child reference was not rejected as 23503');
    }

    console.log('Applying rollback to scratch clone...');
    await pg.query(rollback);
    rollbackApplied = true;
    await pg.query(`select pg_notify('pgrst', 'reload schema')`);
    const { rows: restored } = await pg.query(
      `select tablename, count(*)::int as n
         from pg_policies
        where schemaname = 'public'
          and tablename = any($1::text[])
          and policyname = tablename || '_all_policy'
          and cmd = 'ALL'
          and coalesce(qual, '') like '%user_id%auth.uid()%'
          and coalesce(with_check, '') like '%user_id%auth.uid()%'
        group by tablename`,
      [TABLES],
    );
    if (
      restored.length !== TABLES.length
      || restored.some((row) => row.n !== 1)
    ) {
      throw new Error('Rollback did not restore one exact user policy per table');
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    for (const table of TABLES) {
      const ownerExpected = await service
        .from(table).select('id').eq('user_id', ownerId).order('id');
      const outsiderExpected = await service
        .from(table).select('id').eq('user_id', outsiderId).order('id');
      if (ownerExpected.error || outsiderExpected.error) {
        throw ownerExpected.error || outsiderExpected.error;
      }
      const ownerIds = await idsVisible(owner, table);
      const adminIds = await idsVisible(admin, table);
      const outsiderIds = await idsVisible(outsider, table);
      if (
        JSON.stringify(ownerIds)
          !== JSON.stringify(ownerExpected.data.map((row) => row.id))
        || adminIds.length !== 0
        || JSON.stringify(outsiderIds)
          !== JSON.stringify(outsiderExpected.data.map((row) => row.id))
      ) {
        throw new Error(`${table}: rollback runtime user isolation failed`);
      }
    }

    console.log('PASS: forward migration, 30-table three-actor RLS (incl. profiles), and rollback');
  } finally {
    if (forwardApplied && !rollbackApplied) {
      console.error('Forward migration was applied; attempting mandatory rollback...');
      await pg.query(rollback);
      rollbackApplied = true;
    }
    if (adminUserId) {
      await pg.query(
        'delete from locations where user_id = $1',
        [adminUserId],
      ).catch(() => {});
      await pg.query(
        'delete from organizations where id = $1 and owner_id = $2',
        [adminBootstrapOrgId, adminUserId],
      );
      const { error: cleanupError } =
        await service.auth.admin.deleteUser(adminUserId);
      if (cleanupError) throw cleanupError;
    }
    await pg.end();
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
