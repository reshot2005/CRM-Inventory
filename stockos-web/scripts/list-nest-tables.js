const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..');
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

(async () => {
  const env = loadEnv();
  const c = new Client({
    connectionString: env.SUPABASE_DB_URL || env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const nest = await c.query(
    `select tablename from pg_tables where schemaname='public' and tablename like '_nest_%' order by 1`,
  );
  const users = await c.query(
    `select to_regclass('public.users') as users, to_regclass('public."User"') as user_quoted,
            to_regclass('public._nest_items') as nest_items, to_regclass('public.items') as items`,
  );
  console.log(JSON.stringify({ nest_tables: nest.rows.map((r) => r.tablename), regs: users.rows[0] }, null, 2));
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
