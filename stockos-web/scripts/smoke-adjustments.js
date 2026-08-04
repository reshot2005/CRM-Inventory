/**
 * BUG-1 integration smoke: create PENDING adjustment → apply → assert ledger
 * reference_type=ADJUSTMENT + quantity delta → re-apply idempotent.
 *
 * Usage (from stockos-web):
 *   node scripts/smoke-adjustments.js
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * and migrations 000012+ applied.
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const p = path.join(__dirname, '..', '.env.local');
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const results = [];
function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`);
}
function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name} — ${detail}`);
}

async function main() {
  const env = { ...loadEnv(), ...process.env };
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const sb = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // Prefer seeded admin from smoke-week2; else first OWNER member.
  let adminId = env.SMOKE_ADMIN_USER_ID || '2ca9039a-2b4f-45fd-85d9-81d2aa03ae60';
  {
    const { data: member } = await sb
      .from('organization_members')
      .select('user_id')
      .eq('user_id', adminId)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    if (!member) {
      const { data: owner } = await sb
        .from('organization_members')
        .select('user_id')
        .eq('role', 'OWNER')
        .eq('status', 'ACTIVE')
        .limit(1)
        .maybeSingle();
      if (!owner) {
        fail('Prerequisites', 'No OWNER membership found');
        process.exit(1);
      }
      adminId = owner.user_id;
    }
  }

  const { data: membership } = await sb
    .from('organization_members')
    .select('org_id')
    .eq('user_id', adminId)
    .eq('status', 'ACTIVE')
    .limit(1)
    .maybeSingle();
  if (!membership?.org_id) {
    fail('Prerequisites', 'admin has no active org_id');
    process.exit(1);
  }

  const { data: item } = await sb
    .from('items')
    .select('id, product_code')
    .eq('is_active', true)
    .order('product_code')
    .limit(1)
    .maybeSingle();

  const { data: loc } = await sb
    .from('locations')
    .select('id, name')
    .eq('is_active', true)
    .order('name')
    .limit(1)
    .maybeSingle();

  if (!item || !loc) {
    fail('Prerequisites', `item=${!!item} loc=${!!loc}`);
    process.exit(1);
  }

  const { data: invBefore } = await sb
    .from('inventory')
    .select('quantity')
    .eq('item_id', item.id)
    .eq('location_id', loc.id)
    .maybeSingle();
  const qtyBefore = Number(invBefore?.quantity ?? 0);
  const delta = 3;

  // 1) Insert PENDING (never APPROVED from client)
  const { data: adj, error: insertErr } = await sb
    .from('stock_adjustments')
    .insert({
      user_id: adminId,
      org_id: membership.org_id,
      item_id: item.id,
      location_id: loc.id,
      quantity: delta,
      adjustment_type: 'ADD',
      reason: 'COUNT_CORRECTION',
      notes: 'smoke-adjustments',
      status: 'PENDING',
      created_by: adminId,
    })
    .select('id, status')
    .single();

  if (insertErr || !adj) {
    fail('Insert PENDING', insertErr?.message || 'no row');
    process.exit(1);
  }
  pass('Insert PENDING', adj.id);

  // 2) Apply atomically
  const { data: apply1, error: applyErr } = await sb.rpc('apply_stock_adjustment', {
    p_user_id: adminId,
    p_adjustment_id: adj.id,
  });
  if (applyErr) {
    fail('Apply adjustment', applyErr.message);
    process.exit(1);
  }
  pass('Apply adjustment', JSON.stringify(apply1));

  // 3) Ledger row with correct reference_type
  const { data: ledger } = await sb
    .from('stock_ledger')
    .select('id, reference_type, movement_type, quantity')
    .eq('reference_id', adj.id)
    .eq('reference_type', 'ADJUSTMENT')
    .maybeSingle();

  if (!ledger) {
    fail('Ledger row', 'missing ADJUSTMENT reference');
  } else if (ledger.reference_type !== 'ADJUSTMENT') {
    fail('Ledger reference_type', ledger.reference_type);
  } else {
    pass(
      'Ledger row',
      `${ledger.movement_type} qty=${ledger.quantity} type=${ledger.reference_type}`,
    );
  }

  // 4) Quantity changed by exact delta
  const { data: invAfter } = await sb
    .from('inventory')
    .select('quantity')
    .eq('item_id', item.id)
    .eq('location_id', loc.id)
    .maybeSingle();
  const qtyAfter = Number(invAfter?.quantity ?? 0);
  if (qtyAfter === qtyBefore + delta) {
    pass('Quantity delta', `${qtyBefore} → ${qtyAfter}`);
  } else {
    fail('Quantity delta', `expected ${qtyBefore + delta}, got ${qtyAfter}`);
  }

  // 5) Status APPROVED
  const { data: adjAfter } = await sb
    .from('stock_adjustments')
    .select('status')
    .eq('id', adj.id)
    .single();
  if (adjAfter?.status === 'APPROVED') pass('Status APPROVED');
  else fail('Status APPROVED', adjAfter?.status);

  // 6) Re-apply is idempotent (no second ledger / no second qty change)
  const { data: apply2, error: apply2Err } = await sb.rpc('apply_stock_adjustment', {
    p_user_id: adminId,
    p_adjustment_id: adj.id,
  });
  if (apply2Err) {
    fail('Re-apply', apply2Err.message);
  } else if (apply2?.idempotent === true) {
    pass('Re-apply idempotent', JSON.stringify(apply2));
  } else {
    fail('Re-apply idempotent', JSON.stringify(apply2));
  }

  const { data: invFinal } = await sb
    .from('inventory')
    .select('quantity')
    .eq('item_id', item.id)
    .eq('location_id', loc.id)
    .maybeSingle();
  if (Number(invFinal?.quantity ?? 0) === qtyAfter) {
    pass('Re-apply no double qty');
  } else {
    fail(
      'Re-apply no double qty',
      `expected ${qtyAfter}, got ${invFinal?.quantity}`,
    );
  }

  const { count: ledgerCount } = await sb
    .from('stock_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('reference_id', adj.id)
    .eq('reference_type', 'ADJUSTMENT');
  if (ledgerCount === 1) pass('Single ledger row');
  else fail('Single ledger row', `count=${ledgerCount}`);

  // 7) STOCK_ADJUSTMENT must fail CHECK (contract regression)
  const { error: badRefErr } = await sb.rpc('process_stock_movement', {
    p_user_id: adminId,
    p_location_id: loc.id,
    p_item_id: item.id,
    p_movement_type: 'ADJUSTMENT_IN',
    p_quantity: 1,
    p_reference_type: 'STOCK_ADJUSTMENT',
    p_reference_id: adj.id,
    p_notes: 'should-fail-check',
    p_created_by: adminId,
  });
  if (badRefErr) {
    pass('STOCK_ADJUSTMENT rejected by CHECK', badRefErr.message.slice(0, 80));
  } else {
    fail('STOCK_ADJUSTMENT rejected by CHECK', 'unexpectedly succeeded');
  }

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ summary: { pass: results.length - failed.length, fail: failed.length }, results }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
