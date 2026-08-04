const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

function pgClient() {
  if (!process.env.SUPABASE_DB_URL) {
    throw new Error('SUPABASE_DB_URL is required; database credentials must not be stored in scripts');
  }
  return new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
}

const WEEK1_TABLES = [
  'profiles','locations','items','inventory','stock_ledger','stock_adjustments',
  'move_orders','move_order_lines','vendors','vendor_contacts','vendor_items',
  'purchase_orders','purchase_order_lines','customers','customer_contacts',
  'customer_activities','sale_orders','sale_order_lines','payments',
  'delivery_challans','boms','bom_lines','production_orders',
  'production_material_lines','documents','audit_logs',
];

async function main() {
  loadEnv();
  const results = [];
  const client = pgClient();
  await client.connect();

  const t = await client.query(
    `select count(*)::int as c from information_schema.tables
     where table_schema='public' and table_type='BASE TABLE' and table_name = any($1)`,
    [WEEK1_TABLES],
  );
  results.push({
    check: 'Schema complete (26 week1 tables)',
    ok: t.rows[0].c === 26,
    output: `count=${t.rows[0].c}`,
  });

  const p = await client.query(
    `select count(*)::int as c from pg_policies where schemaname='public'`,
  );
  results.push({
    check: 'RLS policies >= 30',
    ok: p.rows[0].c >= 30,
    output: `policies=${p.rows[0].c}`,
  });

  // Restrictive policies + append-only trigger must ERROR on UPDATE
  await client.query(`begin`);
  let ledgerOk = false;
  let ledgerMsg = '';
  try {
    // Bypass RLS as table owner — trigger must still block
    await client.query(`update stock_ledger set quantity = 999 where true`);
    ledgerMsg = 'UPDATE succeeded (unexpected)';
  } catch (e) {
    ledgerOk = /append-only|forbidden|policy/i.test(String(e.message));
    ledgerMsg = String(e.message).slice(0, 240);
  }
  await client.query(`rollback`);
  results.push({
    check: 'Stock ledger immutable',
    ok: ledgerOk,
    output: ledgerMsg,
  });

  const fn = await client.query(`
    select proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and proname = any(array[
      'handle_new_user','process_stock_movement','get_dashboard_kpis',
      'get_low_stock_items','generate_order_number','update_updated_at_column'
    ])
  `);
  results.push({
    check: '6 functions deployed',
    ok: fn.rows.length >= 6,
    output: fn.rows.map((r) => r.proname).sort().join(', '),
  });

  const rt = await client.query(`
    select tablename from pg_publication_tables
    where pubname='supabase_realtime'
      and tablename = any(array[
        'inventory','stock_ledger','sale_orders','purchase_orders',
        'move_orders','production_orders','items','stock_adjustments'
      ])
  `);
  results.push({
    check: 'Realtime 8 tables',
    ok: rt.rows.length >= 8,
    output: `count=${rt.rows.length}`,
  });

  const buckets = await client.query(`
    select id from storage.buckets
    where id = any(array['product-images','challans','vendor-docs','company-logos'])
  `);
  results.push({
    check: 'Storage 4 buckets',
    ok: buckets.rows.length === 4,
    output: buckets.rows.map((r) => r.id).join(', '),
  });

  const idx = await client.query(`
    select count(*)::int as c from pg_indexes
    where schemaname='public' and indexname like 'idx_%'
  `);
  results.push({
    check: 'Performance indexes (>=17)',
    ok: idx.rows[0].c >= 17,
    output: `idx_count=${idx.rows[0].c}`,
  });

  const authUsers = await client.query(
    `select id::text as id from auth.users order by created_at asc limit 2`,
  );

  let isolationOk = false;
  let isolationOut = '';
  if (authUsers.rows.length >= 2) {
    const a = authUsers.rows[0].id;
    const b = authUsers.rows[1].id;
    await client.query(
      `insert into profiles (id, full_name) values ($1,'UserA'), ($2,'UserB')
       on conflict (id) do nothing`,
      [a, b],
    );
    await client.query(
      `insert into items (user_id, standardized_name, product_code, category)
       values ($1, 'Isolation Item A', 'ISO-A-001', 'OTHER')
       on conflict (user_id, product_code) do update set standardized_name = excluded.standardized_name`,
      [a],
    );
    await client.query(`alter table items force row level security`);
    await client.query(`begin`);
    try {
      await client.query(`set local role authenticated`);
      await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [b]);
      await client.query(
        `select set_config('request.jwt.claim.role', 'authenticated', true)`,
      );
      const seen = await client.query(
        `select count(*)::int as c from items where product_code = 'ISO-A-001'`,
      );
      isolationOk = seen.rows[0].c === 0;
      isolationOut = `userB sees ISO-A-001 count=${seen.rows[0].c} (expect 0)`;
    } catch (e) {
      isolationOut = e.message;
    }
    await client.query(`rollback`);
  } else {
    isolationOut = `Need 2 auth.users; found ${authUsers.rows.length}`;
  }
  results.push({
    check: 'Tenant isolation',
    ok: isolationOk,
    output: isolationOut,
  });

  if (authUsers.rows[0]) {
    const kpi = await client.query(`select get_dashboard_kpis($1::uuid) as k`, [
      authUsers.rows[0].id,
    ]);
    const k = kpi.rows[0].k;
    results.push({
      check: 'get_dashboard_kpis works',
      ok: k && typeof k.total_skus === 'number',
      output: JSON.stringify(k),
    });

    // process_stock_movement smoke (on FAC if exists after seed)
    const loc = await client.query(
      `select id from locations where user_id=$1 and code='FAC-001' limit 1`,
      [authUsers.rows[0].id],
    );
    const item = await client.query(
      `select id from items where user_id=$1 and product_code='RAW-001' limit 1`,
      [authUsers.rows[0].id],
    );
    if (loc.rows[0] && item.rows[0]) {
      const mov = await client.query(
        `select process_stock_movement($1::uuid,$2::uuid,$3::uuid,'IN',1,10,'MANUAL',null,'verify', $1::uuid) as r`,
        [authUsers.rows[0].id, loc.rows[0].id, item.rows[0].id],
      );
      results.push({
        check: 'process_stock_movement works',
        ok: mov.rows[0].r?.success === true,
        output: JSON.stringify(mov.rows[0].r),
      });
    } else {
      results.push({
        check: 'process_stock_movement works',
        ok: false,
        output: 'Seed FAC-001/RAW-001 missing — run seed first',
      });
    }

    const counts = await client.query(
      `select
        (select count(*)::int from items where user_id=$1) as items,
        (select count(*)::int from inventory where user_id=$1) as inventory,
        (select count(*)::int from vendors where user_id=$1) as vendors`,
      [authUsers.rows[0].id],
    );
    results.push({
      check: 'Seed data loaded',
      ok:
        counts.rows[0].items > 0 &&
        counts.rows[0].inventory > 0 &&
        counts.rows[0].vendors > 0,
      output: JSON.stringify(counts.rows[0]),
    });
  }

  // Trigger existence
  const trig = await client.query(`
    select tgname from pg_trigger
    where tgname = 'on_auth_user_created' and not tgisinternal
  `);
  results.push({
    check: 'New user trigger exists',
    ok: trig.rows.length >= 1,
    output: trig.rows.map((r) => r.tgname).join(', ') || 'missing',
  });

  // Types file
  const typesPath = path.join(__dirname, '..', 'lib', 'supabase', 'database.types.ts');
  results.push({
    check: 'TypeScript types generated',
    ok: fs.existsSync(typesPath) && fs.statSync(typesPath).size > 1000,
    output: typesPath,
  });

  await client.end();

  const outPath = path.join(__dirname, '..', '..', 'WEEK1_DONE.md');
  let md = `# Week 1 Verification — StockOS Database Foundation\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `| Check | Result | Output |\n|---|---|---|\n`;
  for (const r of results) {
    md += `| ${r.check} | ${r.ok ? 'PASS' : 'FAIL'} | \`${String(r.output).replace(/\|/g, '\\|').replace(/\n/g, ' ')}\` |\n`;
  }
  const failed = results.filter((r) => !r.ok);
  md += `\n**Summary:** ${results.length - failed.length}/${results.length} passed.\n`;
  if (failed.length) {
    md += `\n## Failed\n`;
    for (const f of failed) md += `- ${f.check}: ${f.output}\n`;
  }
  md += `\n## Notes\n`;
  md += `- Nest/Prisma camelCase tables were archived as \`_nest_*\` before applying Week 1 UUID schema.\n`;
  md += `- Nest API that depended on old public table shapes needs a separate migration plan.\n`;
  md += `- Seed via \`npx tsx scripts/seed.ts <auth_user_uuid>\` or \`/dashboard/seed-data\`.\n`;
  fs.writeFileSync(outPath, md);

  console.log(JSON.stringify(results, null, 2));
  console.log('Wrote', outPath);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
