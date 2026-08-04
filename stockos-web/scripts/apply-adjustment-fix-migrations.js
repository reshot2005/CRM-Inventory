/**
 * Apply BUG-1 migrations (000012 + 000013) using stockos-api DATABASE_URL.
 * Usage: node scripts/apply-adjustment-fix-migrations.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

async function main() {
  loadEnvFile(path.join(__dirname, '..', '.env.local'));
  loadEnvFile(path.join(__dirname, '..', '..', 'stockos-api', '.env'));

  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('SUPABASE_DB_URL or DATABASE_URL required');
  }

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const files = [
    '20240101000012_adjustment_apply_atomic.sql',
    '20240101000013_repair_orphan_adjustments.sql',
  ];
  const dir = path.join(__dirname, '..', 'supabase', 'migrations');

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
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

  const orphans = await client.query(`
    select a.id, a.status, a.rejection_reason, it.product_code, loc.name as location,
           a.quantity, a.adjustment_type
    from stock_adjustments a
    left join items it on it.id = a.item_id
    left join locations loc on loc.id = a.location_id
    where a.rejection_reason like 'DATA_REPAIR:%'
       or exists (
         select 1 from stock_adjustment_repair_log r where r.adjustment_id = a.id
       )
    order by a.created_at desc nulls last
    limit 20
  `);
  console.log('REPAIR_ROWS', JSON.stringify(orphans.rows, null, 2));

  const inv = await client.query(`
    select it.product_code, loc.name as location, i.quantity
    from inventory i
    join items it on it.id = i.item_id
    join locations loc on loc.id = i.location_id
    where it.product_code = 'RAW-001'
    order by loc.name
  `);
  console.log('RAW-001_QTY', JSON.stringify(inv.rows, null, 2));

  const ledger = await client.query(`
    select count(*)::int as cnt from stock_ledger where reference_type = 'ADJUSTMENT'
  `);
  console.log('ADJUSTMENT_LEDGER_COUNT', ledger.rows[0]);

  const stillOrphan = await client.query(`
    select count(*)::int as cnt
    from stock_adjustments a
    where a.status = 'APPROVED'
      and not exists (
        select 1 from stock_ledger l
        where l.reference_type = 'ADJUSTMENT' and l.reference_id = a.id
      )
  `);
  console.log('REMAINING_ORPHAN_APPROVED', stillOrphan.rows[0]);

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
