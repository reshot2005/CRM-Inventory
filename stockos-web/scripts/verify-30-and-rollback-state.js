/**
 * Answers the 29-vs-30 question and proves rollback at pg_policies state level.
 *
 * Flow on scratch only:
 * 1) reset+clone to Week 1–3 baseline
 * 2) snapshot pg_policies for all 30 business tables
 * 3) apply org migration + 30-table isolation (incl. profiles)
 * 4) apply rollback
 * 5) snapshot pg_policies again and diff against baseline
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.join(__dirname, '..');

const BUSINESS_30 = [
  'profiles',
  'locations','items','inventory','stock_ledger','stock_adjustments',
  'move_orders','move_order_lines','vendors','vendor_contacts','vendor_items',
  'purchase_orders','purchase_order_lines','customers','customer_contacts',
  'customer_activities','sale_orders','sale_order_lines','payments',
  'delivery_challans','boms','bom_lines','production_orders',
  'production_material_lines','documents','audit_logs',
  'machines','batches','labour_entries','notifications',
];

const USER_SCOPED_29 = BUSINESS_30.filter((t) => t !== 'profiles');

function loadScratchEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(ROOT, '.env.scratch'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function policyFingerprint(rows) {
  return rows
    .map((r) =>
      [
        r.tablename,
        r.policyname,
        r.cmd,
        r.permissive,
        r.roles,
        r.qual || '',
        r.with_check || '',
      ].join('||'),
    )
    .sort()
    .join('\n');
}

async function snapshotPolicies(pg, tables) {
  const { rows } = await pg.query(
    `
    select tablename, policyname, cmd, permissive,
           array_to_string(roles, ',') as roles,
           coalesce(qual, '') as qual,
           coalesce(with_check, '') as with_check
      from pg_policies
     where schemaname = 'public'
       and tablename = any($1::text[])
     order by tablename, policyname, cmd
  `,
    [tables],
  );
  return rows;
}

async function main() {
  console.log('=== 30-table inventory ===');
  console.log('BUSINESS_30 count =', BUSINESS_30.length);
  console.log(
    'Previously rehearsed (user_id tables) count =',
    USER_SCOPED_29.length,
  );
  console.log(
    'Missing from prior rehearsal =',
    BUSINESS_30.filter((t) => !USER_SCOPED_29.includes(t)).join(', '),
  );
  console.log(
    'Reason: profiles uses id (not user_id) and select/insert/update policies,',
    'not *_all_policy / *_org_policy. It IS in the migration backfill + RLS rewrite.',
  );

  // Fresh Week 1–3 baseline on scratch.
  const clone = spawnSync('node', ['scripts/clone-live-to-scratch.js'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  });
  process.stdout.write(clone.stdout || '');
  process.stderr.write(clone.stderr || '');
  if (clone.status !== 0) throw new Error('clone failed');

  const env = loadScratchEnv();
  const pg = new Client({
    connectionString: env.SUPABASE_SCRATCH_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pg.connect();

  const forward = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20240101000009_org_access.sql'),
    'utf8',
  );
  const rollback = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', 'rollback_20240101000009.sql'),
    'utf8',
  );

  const before = await snapshotPolicies(pg, BUSINESS_30);
  const beforeFp = policyFingerprint(before);
  fs.writeFileSync(
    path.join(ROOT, 'scripts', '.scratch-policies-before.json'),
    JSON.stringify(before, null, 2),
  );
  console.log('BASELINE_POLICIES', before.length);

  console.log('Applying forward migration...');
  await pg.query(forward);
  await pg.query(`select pg_notify('pgrst', 'reload schema')`);
  await new Promise((r) => setTimeout(r, 1500));

  // Confirm org_id on all 30 with zero nulls.
  for (const table of BUSINESS_30) {
    const { rows } = await pg.query(
      `select count(*) filter (where org_id is null)::int as nulls,
              count(*)::int as total
         from public.${table}`,
    );
    if (rows[0].nulls !== 0) {
      throw new Error(`${table} still has null org_id`);
    }
    console.log(`ORG_ID_OK ${table} total=${rows[0].total} nulls=0`);
  }

  // Three-actor including profiles.
  const owner = createClient(env.SUPABASE_SCRATCH_URL, env.SUPABASE_SCRATCH_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const outsider = createClient(env.SUPABASE_SCRATCH_URL, env.SUPABASE_SCRATCH_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClient(
    env.SUPABASE_SCRATCH_URL,
    env.SUPABASE_SCRATCH_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error: oErr } = await owner.auth.signInWithPassword({
    email: env.W4_TEST_OWNER_EMAIL,
    password: env.W4_TEST_OWNER_PASSWORD,
  });
  const { error: cErr } = await outsider.auth.signInWithPassword({
    email: env.W4_TEST_OUTSIDER_EMAIL,
    password: env.W4_TEST_OUTSIDER_PASSWORD,
  });
  if (oErr || cErr) throw new Error((oErr || cErr).message);
  const ownerId = (await owner.auth.getUser()).data.user.id;
  const outsiderId = (await outsider.auth.getUser()).data.user.id;
  const ownerOrgId = (
    await pg.query(
      `select org_id from organization_members where user_id=$1 and status='ACTIVE'`,
      [ownerId],
    )
  ).rows[0].org_id;

  const adminEmail = `w4-admin-${Date.now()}@example.test`;
  const adminPassword = `W4!${crypto.randomBytes(12).toString('base64url')}`;
  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  });
  if (createErr) throw createErr;
  const adminUserId = created.user.id;
  const bootstrapOrg = (
    await pg.query(
      `select org_id from organization_members where user_id=$1 and status='ACTIVE'`,
      [adminUserId],
    )
  ).rows[0].org_id;

  await pg.query('begin');
  await pg.query('update profiles set org_id=$1 where id=$2', [ownerOrgId, adminUserId]);
  await pg.query('delete from locations where user_id=$1 and org_id=$2', [
    adminUserId,
    bootstrapOrg,
  ]);
  await pg.query('delete from organizations where id=$1 and owner_id=$2', [
    bootstrapOrg,
    adminUserId,
  ]);
  await pg.query(
    `insert into organization_members (org_id,user_id,role,status,invited_by,joined_at)
     values ($1,$2,'ADMIN','ACTIVE',$3,now())`,
    [ownerOrgId, adminUserId, ownerId],
  );
  await pg.query('commit');

  const admin = createClient(env.SUPABASE_SCRATCH_URL, env.SUPABASE_SCRATCH_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: aErr } = await admin.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (aErr) throw aErr;

  for (const table of BUSINESS_30) {
    const idCol = table === 'profiles' ? 'id' : 'id';
    const { data: expected, error: e1 } = await service
      .from(table)
      .select(idCol)
      .eq('org_id', ownerOrgId)
      .order(idCol);
    if (e1) throw e1;
    const expectedIds = (expected || []).map((r) => r[idCol]).sort();
    if (!expectedIds.length) throw new Error(`${table}: no owner-org fixture`);

    const read = async (client) => {
      const { data, error } = await client.from(table).select(idCol).order(idCol);
      if (error) throw error;
      return (data || []).map((r) => r[idCol]).sort();
    };
    const ownerIds = await read(owner);
    const adminIds = await read(admin);
    const outsiderIds = await read(outsider);

    const ownerVisibleOwnerOrg = ownerIds.filter((id) => expectedIds.includes(id));
    const adminVisibleOwnerOrg = adminIds.filter((id) => expectedIds.includes(id));
    const outsiderLeak = outsiderIds.filter((id) => expectedIds.includes(id));

    if (
      JSON.stringify(ownerVisibleOwnerOrg) !== JSON.stringify(expectedIds)
      || JSON.stringify(adminVisibleOwnerOrg) !== JSON.stringify(expectedIds)
    ) {
      throw new Error(`${table}: Owner/Admin did not see exact owner-org set`);
    }
    if (outsiderLeak.length) {
      throw new Error(`${table}: outsider leaked owner-org rows`);
    }
    console.log(`PASS_30 ${table}`);
  }

  console.log('Applying rollback...');
  await pg.query(rollback);
  await pg.query(`select pg_notify('pgrst', 'reload schema')`);
  await new Promise((r) => setTimeout(r, 1000));

  const after = await snapshotPolicies(pg, BUSINESS_30);
  const afterFp = policyFingerprint(after);
  fs.writeFileSync(
    path.join(ROOT, 'scripts', '.scratch-policies-after-rollback.json'),
    JSON.stringify(after, null, 2),
  );

  const beforeSet = new Set(before.map((r) =>
    [r.tablename, r.policyname, r.cmd, r.permissive, r.roles, r.qual, r.with_check].join('||'),
  ));
  const afterSet = new Set(after.map((r) =>
    [r.tablename, r.policyname, r.cmd, r.permissive, r.roles, r.qual, r.with_check].join('||'),
  ));
  const missing = [...beforeSet].filter((x) => !afterSet.has(x));
  const extra = [...afterSet].filter((x) => !beforeSet.has(x));

  console.log('POLICY_COUNT_BEFORE', before.length);
  console.log('POLICY_COUNT_AFTER', after.length);
  console.log('POLICY_MISSING_AFTER_ROLLBACK', missing.length);
  missing.slice(0, 50).forEach((m) => console.log('  MISSING', m));
  console.log('POLICY_EXTRA_AFTER_ROLLBACK', extra.length);
  extra.slice(0, 50).forEach((m) => console.log('  EXTRA', m));

  if (beforeFp !== afterFp) {
    // Write a structured report; fail until rollback restores exact business policies.
    fs.writeFileSync(
      path.join(ROOT, 'scripts', '.scratch-policy-diff.txt'),
      [
        'MISSING (present before, absent after rollback):',
        ...missing,
        '',
        'EXTRA (absent before, present after rollback):',
        ...extra,
      ].join('\n'),
    );
    throw new Error(
      'Rollback did not restore byte-identical pg_policies for the 30 business tables. See scripts/.scratch-policy-diff.txt',
    );
  }

  // Cleanup admin
  await pg.query('delete from locations where user_id=$1', [adminUserId]).catch(() => {});
  await service.auth.admin.deleteUser(adminUserId).catch(() => {});

  console.log('PASS: 30-table isolation + rollback pg_policies byte-identical to baseline');
  await pg.end();
}

main().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
