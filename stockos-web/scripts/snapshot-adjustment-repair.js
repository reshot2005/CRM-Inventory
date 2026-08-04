/** Final verification snapshot after BUG-1 repair. */
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
  loadEnvFile(path.join(__dirname, '..', '..', 'stockos-api', '.env'));
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const delhi = await client.query(`
    select it.product_code, loc.name as location, i.quantity
    from inventory i
    join items it on it.id = i.item_id
    join locations loc on loc.id = i.location_id
    where it.product_code = 'RAW-001' and loc.name = 'Delhi Hub'
  `);

  const orphans = await client.query(`
    select count(*)::int as cnt
    from stock_adjustments a
    where a.status = 'APPROVED'
      and not exists (
        select 1 from stock_ledger l
        where l.reference_type = 'ADJUSTMENT' and l.reference_id = a.id
      )
  `);

  const repaired = await client.query(`
    select a.id, it.product_code, loc.name as location, a.quantity,
           a.adjustment_type, a.status, a.rejection_reason
    from stock_adjustments a
    left join items it on it.id = a.item_id
    left join locations loc on loc.id = a.location_id
    where a.rejection_reason like 'DATA_REPAIR:%'
  `);

  const ledgerAdj = await client.query(`
    select count(*)::int as cnt from stock_ledger where reference_type = 'ADJUSTMENT'
  `);

  console.log(JSON.stringify({
    delhi_raw001: delhi.rows,
    remaining_orphan_approved: orphans.rows[0],
    repaired_orphans: repaired.rows,
    adjustment_ledger_rows: ledgerAdj.rows[0],
  }, null, 2));

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
