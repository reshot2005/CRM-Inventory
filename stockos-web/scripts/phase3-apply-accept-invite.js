/**
 * Phase 3 — apply accept_organization_invite + STAFF pending-adjustment policy to LIVE.
 * Uses SUPABASE_DB_URL from env / .env.local / stockos-api/.env (no credentials in source).
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..');
const SQL_FILE = path.join(
  ROOT,
  'supabase',
  'migrations',
  '20240101000010_accept_invite.sql',
);

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

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_DB_URL || env.DATABASE_URL;
  if (!url) {
    throw new Error('SUPABASE_DB_URL (or DATABASE_URL) is required');
  }

  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log('Applying 20240101000010_accept_invite.sql ...');
  await client.query(sql);

  const fn = await client.query(`
    select proname, prosecdef
    from pg_proc
    where proname = 'accept_organization_invite'
  `);
  const pol = await client.query(`
    select policyname, cmd, permissive
    from pg_policies
    where schemaname = 'public'
      and tablename = 'stock_adjustments'
      and policyname = 'stock_adjustments_staff_insert_pending'
  `);

  console.log(
    JSON.stringify(
      {
        ok: true,
        function: fn.rows[0] ?? null,
        staff_pending_policy: pol.rows[0] ?? null,
      },
      null,
      2,
    ),
  );

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
