const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DIR = path.join(__dirname, '..', 'supabase', 'migrations');

function loadLocalEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

async function main() {
  loadLocalEnv();
  if (!process.env.SUPABASE_DB_URL) {
    throw new Error('SUPABASE_DB_URL is required; database credentials must not be stored in scripts');
  }
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('rollback_'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
    process.stdout.write(`Applying ${file}... `);
    try {
      await client.query(sql);
      console.log('OK');
    } catch (e) {
      console.log('FAIL');
      console.error(e.message);
      await client.end();
      process.exit(1);
    }
  }

  const counts = await client.query(`
    select
      (select count(*) from information_schema.tables
        where table_schema='public' and table_type='BASE TABLE'
        and table_name in (
          'profiles','locations','items','inventory','stock_ledger','stock_adjustments',
          'move_orders','move_order_lines','vendors','vendor_contacts','vendor_items',
          'purchase_orders','purchase_order_lines','customers','customer_contacts',
          'customer_activities','sale_orders','sale_order_lines','payments',
          'delivery_challans','boms','bom_lines','production_orders',
          'production_material_lines','documents','audit_logs',
          'machines','batches','labour_entries','notifications'
        )) as week1_tables,
      (select count(*) from pg_policies where schemaname='public') as policies
  `);
  console.log(counts.rows[0]);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
