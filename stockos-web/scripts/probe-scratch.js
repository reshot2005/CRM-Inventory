const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const dns = require('dns').promises;

const env = {};
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.scratch'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

async function main() {
  for (const host of [
    'db.kasfulqjuotpzvhhuqkf.supabase.co',
    'aws-0-ap-southeast-1.pooler.supabase.com',
    'aws-1-ap-southeast-1.pooler.supabase.com',
    'aws-0-ap-south-1.pooler.supabase.com',
  ]) {
    try {
      const r = await dns.lookup(host);
      console.log('DNS_OK', host, r.address);
    } catch (e) {
      console.log('DNS_FAIL', host, e.code || e.message);
    }
  }

  const sb = createClient(env.SUPABASE_SCRATCH_URL, env.SUPABASE_SCRATCH_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  for (const table of ['items', 'locations', 'profiles', 'vendors', 'organizations']) {
    const res = await sb.from(table).select('id', { count: 'exact', head: true });
    console.log(
      `TABLE_${table}`,
      res.error
        ? `ERR ${res.error.code || ''} ${res.error.message}`
        : `count=${res.count}`,
    );
  }

  const passwords = ['Akshara@123#@', 'Akshara@123'];
  const hosts = [
    'aws-1-ap-southeast-1.pooler.supabase.com',
    'aws-0-ap-southeast-1.pooler.supabase.com',
    'aws-0-ap-south-1.pooler.supabase.com',
    'aws-1-ap-south-1.pooler.supabase.com',
  ];

  for (const host of hosts) {
    for (const pw of passwords) {
      const url =
        'postgresql://postgres.kasfulqjuotpzvhhuqkf:' +
        encodeURIComponent(pw) +
        '@' +
        host +
        ':5432/postgres';
      const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
      try {
        await c.connect();
        const r = await c.query(
          "select current_database() as db, inet_server_addr()::text as addr, (select count(*)::int from information_schema.tables where table_schema='public') as public_tables",
        );
        console.log('DB_OK', host, pw, r.rows[0]);
        const body = [
          'SUPABASE_SCRATCH_PROJECT_REF=kasfulqjuotpzvhhuqkf',
          'SUPABASE_SCRATCH_URL=' + env.SUPABASE_SCRATCH_URL,
          'SUPABASE_SCRATCH_ANON_KEY=' + env.SUPABASE_SCRATCH_ANON_KEY,
          'SUPABASE_SCRATCH_SERVICE_ROLE_KEY=' + env.SUPABASE_SCRATCH_SERVICE_ROLE_KEY,
          'SUPABASE_SCRATCH_DB_URL=' + url,
        ].join('\n') + '\n';
        fs.writeFileSync(path.join(__dirname, '..', '.env.scratch'), body);
        await c.end();
        return;
      } catch (e) {
        console.log('DB_FAIL', host, pw, String(e.message).slice(0, 180));
        try {
          await c.end();
        } catch {}
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
