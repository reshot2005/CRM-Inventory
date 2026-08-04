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
  const buckets = await c.query(
    `select id, public, file_size_limit from storage.buckets where id = 'product-images'`,
  );
  console.log(JSON.stringify(buckets.rows, null, 2));
  if (!buckets.rows.length) {
    const sql = fs.readFileSync(
      path.join(ROOT, 'supabase', 'migrations', '20240101000006_storage.sql'),
      'utf8',
    );
    await c.query(sql);
    console.log('applied storage migration');
  }
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
