/**
 * On-demand logical backup of LIVE StockOS (read-only).
 * Writes a timestamped JSON dump under stockos-web/.backups/ (gitignored).
 * This is complementary to Supabase Dashboard backups — not a replacement for PITR.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..');
const LIVE_URL =
  process.env.SUPABASE_DB_URL ||
  'postgresql://postgres.msfnajafbdmjixbqqhvn:aksharaintern123@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

const TABLES = [
  'profiles','locations','items','inventory','stock_ledger','stock_adjustments',
  'move_orders','move_order_lines','vendors','vendor_contacts','vendor_items',
  'purchase_orders','purchase_order_lines','customers','customer_contacts',
  'customer_activities','sale_orders','sale_order_lines','payments',
  'delivery_challans','boms','bom_lines','production_orders',
  'production_material_lines','documents','audit_logs',
  'machines','batches','labour_entries','notifications',
];

async function main() {
  const outDir = path.join(ROOT, '.backups');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(outDir, `live-msfnajafbdmjixbqqhvn-${stamp}.json`);

  const pg = new Client({
    connectionString: LIVE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pg.connect();
  const started = Date.now();
  const dump = {
    project_ref: 'msfnajafbdmjixbqqhvn',
    taken_at: new Date().toISOString(),
    note: 'Logical row dump for Week 4 pre-migration safety net',
    auth_users: [],
    tables: {},
  };

  const users = await pg.query(
    `select id, email, created_at, raw_user_meta_data from auth.users order by created_at`,
  );
  dump.auth_users = users.rows;

  for (const table of TABLES) {
    const { rows } = await pg.query(`select * from public.${table}`);
    dump.tables[table] = rows;
    console.log('DUMPED', table, rows.length);
  }

  dump.elapsed_ms = Date.now() - started;
  fs.writeFileSync(outFile, JSON.stringify(dump));
  const bytes = fs.statSync(outFile).size;
  console.log('BACKUP_FILE', outFile);
  console.log('BACKUP_BYTES', bytes);
  console.log('BACKUP_ELAPSED_MS', dump.elapsed_ms);

  // Integrity: re-open and confirm table keys
  const check = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  if (Object.keys(check.tables).length !== TABLES.length) {
    throw new Error('backup missing tables');
  }
  console.log('BACKUP_OK');
  await pg.end();
}

main().catch((e) => {
  console.error('BACKUP_FAIL', e.message);
  process.exit(1);
});
