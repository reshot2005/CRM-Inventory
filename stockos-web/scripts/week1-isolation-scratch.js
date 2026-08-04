/**
 * Week 1 two-user isolation check against scratch AFTER org migration.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.join(__dirname, '..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.scratch'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

async function main() {
  const pg = new Client({
    connectionString: env.SUPABASE_SCRATCH_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pg.connect();
  const forward = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20240101000009_org_access.sql'),
    'utf8',
  );
  console.log('Re-applying org migration for Week 1 isolation check...');
  await pg.query(forward);

  const owner = createClient(env.SUPABASE_SCRATCH_URL, env.SUPABASE_SCRATCH_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const outsider = createClient(env.SUPABASE_SCRATCH_URL, env.SUPABASE_SCRATCH_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: e1 } = await owner.auth.signInWithPassword({
    email: env.W4_TEST_OWNER_EMAIL,
    password: env.W4_TEST_OWNER_PASSWORD,
  });
  const { error: e2 } = await outsider.auth.signInWithPassword({
    email: env.W4_TEST_OUTSIDER_EMAIL,
    password: env.W4_TEST_OUTSIDER_PASSWORD,
  });
  if (e1 || e2) throw new Error((e1 || e2).message);

  const { data: ownerItems, error: oi } = await owner.from('items').select('id, product_code');
  const { data: outsiderItems, error: ui } = await outsider.from('items').select('id, product_code');
  if (oi || ui) throw new Error((oi || ui).message);

  const ownerIds = new Set((ownerItems || []).map((r) => r.id));
  const leak = (outsiderItems || []).filter((r) => ownerIds.has(r.id));
  console.log('OWNER_ITEMS', (ownerItems || []).length);
  console.log('OUTSIDER_ITEMS', (outsiderItems || []).length);
  console.log('CROSS_LEAK', leak.length);
  if (leak.length) throw new Error('Week 1 isolation failed: outsider saw owner items');

  const { data: kpis, error: kErr } = await owner.rpc('get_dashboard_kpis', {
    p_user_id: (await owner.auth.getUser()).data.user.id,
  });
  if (kErr) throw kErr;
  console.log('KPIS_OK', kpis);
  console.log('WEEK1_ISOLATION_PASS');
  await pg.end();
}

main().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
