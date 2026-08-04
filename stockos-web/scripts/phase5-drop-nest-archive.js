/**
 * Phase 5 — apply drop of archived _nest_* tables on LIVE.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..');
const SQL_FILE = path.join(
  ROOT,
  'supabase',
  'migrations',
  '20240101000011_drop_nest_archive.sql',
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
  if (!url) throw new Error('SUPABASE_DB_URL required');

  const before = await countNest(url);
  console.log('before_nest_tables', before.length);

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(fs.readFileSync(SQL_FILE, 'utf8'));
  await client.end();

  const after = await countNest(url);
  console.log(
    JSON.stringify(
      { ok: after.length === 0, before: before.length, after: after.length, remaining: after },
      null,
      2,
    ),
  );
  if (after.length !== 0) process.exit(1);
}

async function countNest(url) {
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const r = await client.query(
    `select tablename from pg_tables where schemaname='public' and tablename like '_nest_%' order by 1`,
  );
  await client.end();
  return r.rows.map((x) => x.tablename);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
