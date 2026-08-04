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
  for (const t of ['users', 'user_sessions', 'documents', 'items']) {
    const cols = await c.query(
      `select column_name, data_type from information_schema.columns
       where table_schema='public' and table_name=$1 order by ordinal_position`,
      [t],
    );
    console.log(t, cols.rows.map((r) => `${r.column_name}:${r.data_type}`).join(', '));
  }
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
