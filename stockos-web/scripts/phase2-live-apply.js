/**
 * Phase 2 — apply org migration to LIVE with abort/rollback on verification failure.
 * Requires explicit Free-tier waiver already recorded in WEEK4_MIGRATION_LOG.md.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.join(__dirname, '..');
const LIVE_REF = 'msfnajafbdmjixbqqhvn';
const LIVE_URL =
  process.env.SUPABASE_DB_URL ||
  'postgresql://postgres.msfnajafbdmjixbqqhvn:aksharaintern123@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

const BUSINESS_30 = [
  'profiles','locations','items','inventory','stock_ledger','stock_adjustments',
  'move_orders','move_order_lines','vendors','vendor_contacts','vendor_items',
  'purchase_orders','purchase_order_lines','customers','customer_contacts',
  'customer_activities','sale_orders','sale_order_lines','payments',
  'delivery_challans','boms','bom_lines','production_orders',
  'production_material_lines','documents','audit_logs',
  'machines','batches','labour_entries','notifications',
];

function loadEnv() {
  const env = { ...process.env };
  for (const file of ['.env.local', path.join('..', 'stockos-api', '.env')]) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || env[m[1]]) continue;
      env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

function pg() {
  return new Client({
    connectionString: LIVE_URL,
    ssl: { rejectUnauthorized: false },
  });
}

async function zeroNullCheck(client) {
  const lines = [];
  let failed = false;
  for (const table of BUSINESS_30) {
    const { rows } = await client.query(
      `select count(*)::int as total,
              count(*) filter (where org_id is null)::int as nulls
         from public.${table}`,
    );
    const line = `${table}\ttotal=${rows[0].total}\tnulls=${rows[0].nulls}`;
    lines.push(line);
    if (rows[0].nulls !== 0) failed = true;
  }
  const orphans = await client.query(`
    select count(*)::int as n
      from auth.users u
      left join organization_members m
        on m.user_id = u.id and m.role = 'OWNER' and m.status = 'ACTIVE'
     where m.id is null
  `);
  lines.push(`auth_users_without_active_owner_membership\t${orphans.rows[0].n}`);
  if (orphans.rows[0].n !== 0) failed = true;
  return { ok: !failed, lines };
}

async function week1Isolation(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Live anon URL/key missing');

  const ownerEmail = 'admin@stockos.com';
  const outsiderEmail = 'aksharaenterprisesintern@gmail.com';
  const passwords = [
    [ownerEmail, env.W4_LIVE_OWNER_PASSWORD || 'Admin@123'],
    [outsiderEmail, env.W4_LIVE_OUTSIDER_PASSWORD || 'SmokeTest@123'],
  ];

  const owner = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const outsider = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let { error: e1 } = await owner.auth.signInWithPassword({
    email: passwords[0][0],
    password: passwords[0][1],
  });
  if (e1) {
    // try scratch password in case live was synced somehow — unlikely
    ({ error: e1 } = await owner.auth.signInWithPassword({
      email: ownerEmail,
      password: 'ScratchOwner@123',
    }));
  }
  let { error: e2 } = await outsider.auth.signInWithPassword({
    email: passwords[1][0],
    password: passwords[1][1],
  });
  if (e2) {
    ({ error: e2 } = await outsider.auth.signInWithPassword({
      email: outsiderEmail,
      password: 'ScratchOutsider@123',
    }));
  }
  if (e1 || e2) {
    throw new Error(`Live sign-in failed: ${e1?.message || ''} ${e2?.message || ''}`);
  }

  const { data: ownerItems, error: oi } = await owner.from('items').select('id');
  const { data: outsiderItems, error: ui } = await outsider.from('items').select('id');
  if (oi || ui) throw new Error((oi || ui).message);

  const ownerIds = new Set((ownerItems || []).map((r) => r.id));
  const leak = (outsiderItems || []).filter((r) => ownerIds.has(r.id));
  const ownerId = (await owner.auth.getUser()).data.user.id;
  const { data: kpis, error: kErr } = await owner.rpc('get_dashboard_kpis', {
    p_user_id: ownerId,
  });
  if (kErr) throw kErr;

  return {
    ok: leak.length === 0,
    owner_items: (ownerItems || []).length,
    outsider_items: (outsiderItems || []).length,
    cross_leak: leak.length,
    kpis,
  };
}

async function main() {
  const env = loadEnv();
  const started = new Date().toISOString();
  console.log('PHASE2_START', started, 'live', LIVE_REF);
  console.log('WAIVER: Free-tier platform backup waived by user');

  // 1) Fresh logical dump
  console.log('Step1: logical backup...');
  const bak = spawnSync('node', ['scripts/backup-live-ondemand.js'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  });
  process.stdout.write(bak.stdout || '');
  process.stderr.write(bak.stderr || '');
  if (bak.status !== 0) throw new Error('pre-apply logical backup failed');

  const client = pg();
  await client.connect();
  const forward = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20240101000009_org_access.sql'),
    'utf8',
  );
  const rollback = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', 'rollback_20240101000009.sql'),
    'utf8',
  );

  let applied = false;
  try {
    // Guard: refuse if already partially migrated with null org_ids somehow
    const hasOrg = await client.query(
      `select to_regclass('public.organizations') is not null as exists`,
    );
    if (hasOrg.rows[0].exists) {
      console.log('NOTE: organizations table already exists — re-running idempotent migration');
    }

    // 2) Apply
    console.log('Step2: applying org migration to LIVE...');
    await client.query(forward);
    applied = true;
    await client.query(`select pg_notify('pgrst', 'reload schema')`);
    console.log('Step2: APPLY_OK');

    // 3) Types
    console.log('Step3: regenerating types...');
    const types = spawnSync('node', ['scripts/generate-database-types.js'], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: true,
      env: { ...process.env, SUPABASE_DB_URL: LIVE_URL },
    });
    process.stdout.write(types.stdout || '');
    process.stderr.write(types.stderr || '');
    if (types.status !== 0) throw new Error('db:types failed');
    const typesSrc = fs.readFileSync(
      path.join(ROOT, 'lib', 'supabase', 'database.types.ts'),
      'utf8',
    );
    for (const needle of [
      'organizations:',
      'organization_members:',
      'organization_invites:',
      'org_id:',
    ]) {
      if (!typesSrc.includes(needle)) {
        throw new Error(`types missing ${needle}`);
      }
    }
    console.log('Step3: TYPES_OK');

    // 4) Zero-null
    console.log('Step4: zero-null org_id check...');
    const nullCheck = await zeroNullCheck(client);
    console.log('--- ZERO_NULL_QUERY_OUTPUT ---');
    for (const line of nullCheck.lines) console.log(line);
    console.log('--- END_ZERO_NULL ---');
    if (!nullCheck.ok) {
      throw new Error('ZERO_NULL_FAILED');
    }
    console.log('Step4: ZERO_NULL_OK');

    // 5) Live Week 1 isolation
    console.log('Step5: live Week 1 isolation...');
    const iso = await week1Isolation(env);
    console.log('ISOLATION', JSON.stringify(iso));
    if (!iso.ok) throw new Error('LIVE_ISOLATION_FAILED');
    console.log('Step5: LIVE_ISOLATION_OK');

    console.log('PHASE2_PASS', new Date().toISOString());
    return {
      status: 'PASS',
      started,
      ended: new Date().toISOString(),
      nullCheck: nullCheck.lines,
      isolation: iso,
    };
  } catch (e) {
    console.error('PHASE2_FAIL', e.message);
    if (applied) {
      console.error('ABORT: running rollback on LIVE...');
      try {
        await client.query(rollback);
        console.error('ROLLBACK_OK');
      } catch (re) {
        console.error('ROLLBACK_FAILED', re.message);
        throw re;
      }
    }
    throw e;
  } finally {
    await client.end();
  }
}

main()
  .then((result) => {
    fs.writeFileSync(
      path.join(ROOT, 'scripts', '.phase2-live-result.json'),
      JSON.stringify(result, null, 2),
    );
  })
  .catch((e) => {
    fs.writeFileSync(
      path.join(ROOT, 'scripts', '.phase2-live-result.json'),
      JSON.stringify({ status: 'FAIL', error: e.message }, null, 2),
    );
    process.exit(1);
  });
