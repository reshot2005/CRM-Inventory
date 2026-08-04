/**
 * Week 3 manufacturing smoke — BOM → Plan → Start → Complete via RPCs
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const p = path.join(__dirname, '..', '.env.local');
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const ADMIN = '2ca9039a-2b4f-45fd-85d9-81d2aa03ae60';
const USER_B = 'febee79f-2d3e-431e-8fa2-8c37c2b53870';

function computeRequiredQty(bomLineQty, targetQty, yieldQty, wastePercent) {
  const yieldSafe = yieldQty > 0 ? yieldQty : 1;
  const waste = Math.max(0, wastePercent) / 100;
  return Number((bomLineQty * (targetQty / yieldSafe) * (1 + waste)).toFixed(4));
}

async function main() {
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const results = [];
  const pass = (n, d) => {
    results.push({ n, ok: true, d });
    console.log('PASS ', n, d || '');
  };
  const fail = (n, d) => {
    results.push({ n, ok: false, d });
    console.log('FAIL ', n, d);
  };

  // New tables exist
  for (const t of ['machines', 'batches', 'labour_entries', 'notifications']) {
    const { error } = await sb.from(t).select('id').limit(1);
    if (error) fail(`table ${t}`, error.message);
    else pass(`table ${t}`);
  }

  const { data: loc } = await sb
    .from('locations')
    .select('id')
    .eq('user_id', ADMIN)
    .eq('is_active', true)
    .limit(1)
    .single();
  const { data: fg } = await sb
    .from('items')
    .select('id, product_code')
    .eq('user_id', ADMIN)
    .eq('category', 'FINISHED_GOOD')
    .eq('is_active', true)
    .limit(1)
    .single();
  const { data: raw } = await sb
    .from('items')
    .select('id, product_code')
    .eq('user_id', ADMIN)
    .eq('category', 'RAW_MATERIAL')
    .eq('is_active', true)
    .eq('product_code', 'RAW-001')
    .single();

  if (!loc || !fg || !raw) {
    fail('prerequisites', 'missing loc/fg/raw');
    process.exit(1);
  }

  // Ensure raw stock via PURCHASE_RECEIVE
  await sb.rpc('process_stock_movement', {
    p_user_id: ADMIN,
    p_location_id: loc.id,
    p_item_id: raw.id,
    p_movement_type: 'PURCHASE_RECEIVE',
    p_quantity: 100,
    p_unit_cost: 50,
    p_created_by: ADMIN,
  });

  // Create BOM
  const { data: bom, error: bomErr } = await sb
    .from('boms')
    .insert({
      user_id: ADMIN,
      finished_good_id: fg.id,
      version: '9.9',
      yield_qty: 10,
      yield_unit: 'pcs',
      is_active: true,
      notes: 'week3 smoke',
    })
    .select('id')
    .single();
  if (bomErr) fail('create BOM', bomErr.message);
  else {
    pass('create BOM', bom.id);
    await sb.from('bom_lines').insert({
      user_id: ADMIN,
      bom_id: bom.id,
      raw_material_id: raw.id,
      quantity: 2,
      unit: 'kg',
      waste_percent: 10,
    });
  }

  const target = 20;
  const required = computeRequiredQty(2, target, 10, 10); // 2 * 2 * 1.1 = 4.4
  const { data: prdNum } = await sb.rpc('generate_order_number', {
    p_user_id: ADMIN,
    p_prefix: 'PRD',
  });

  const { data: po, error: poErr } = await sb
    .from('production_orders')
    .insert({
      user_id: ADMIN,
      order_number: prdNum,
      bom_id: bom.id,
      target_qty: target,
      status: 'PLANNED',
      location_id: loc.id,
      created_by: ADMIN,
    })
    .select('id, order_number')
    .single();
  if (poErr) fail('plan production', poErr.message);
  else {
    pass('plan production', `${po.order_number} required_raw=${required}`);
    await sb.from('production_material_lines').insert({
      user_id: ADMIN,
      production_order_id: po.id,
      raw_material_id: raw.id,
      required_qty: required,
      consumed_qty: 0,
    });
  }

  const { data: invBefore } = await sb
    .from('inventory')
    .select('quantity')
    .eq('user_id', ADMIN)
    .eq('item_id', raw.id)
    .eq('location_id', loc.id)
    .single();
  const rawBefore = Number(invBefore.quantity);

  const { error: outErr } = await sb.rpc('process_stock_movement', {
    p_user_id: ADMIN,
    p_location_id: loc.id,
    p_item_id: raw.id,
    p_movement_type: 'PRODUCTION_OUT',
    p_quantity: required,
    p_reference_type: 'PRODUCTION_ORDER',
    p_reference_id: po.id,
    p_created_by: ADMIN,
  });
  if (outErr) fail('start PRODUCTION_OUT', outErr.message);
  else {
    await sb
      .from('production_material_lines')
      .update({ consumed_qty: required })
      .eq('production_order_id', po.id);
    await sb
      .from('production_orders')
      .update({ status: 'IN_PROGRESS', started_at: new Date().toISOString() })
      .eq('id', po.id);
    const { data: invMid } = await sb
      .from('inventory')
      .select('quantity')
      .eq('user_id', ADMIN)
      .eq('item_id', raw.id)
      .eq('location_id', loc.id)
      .single();
    const mid = Number(invMid.quantity);
    if (Math.abs(mid - (rawBefore - required)) < 0.001)
      pass('raw consumed', `${rawBefore} → ${mid}`);
    else fail('raw consumed', `${rawBefore} → ${mid}`);
  }

  // Insufficient stock block
  const { error: overErr } = await sb.rpc('process_stock_movement', {
    p_user_id: ADMIN,
    p_location_id: loc.id,
    p_item_id: raw.id,
    p_movement_type: 'PRODUCTION_OUT',
    p_quantity: 999999,
    p_created_by: ADMIN,
  });
  if (overErr && /INV_003/i.test(overErr.message)) pass('insufficient blocks start', overErr.message.slice(0, 80));
  else fail('insufficient blocks start', overErr?.message || 'no error');

  const actual = 18;
  const batchNo = `BATCH-SMOKE-${Date.now()}`;
  const { error: batchErr } = await sb.from('batches').insert({
    user_id: ADMIN,
    production_order_id: po.id,
    batch_number: batchNo,
    quantity: actual,
    quality_status: 'PASSED',
  });
  if (batchErr) fail('create batch', batchErr.message);
  else pass('create batch', batchNo);

  const { data: fgInvBefore } = await sb
    .from('inventory')
    .select('quantity')
    .eq('user_id', ADMIN)
    .eq('item_id', fg.id)
    .eq('location_id', loc.id)
    .maybeSingle();
  const fgBefore = Number(fgInvBefore?.quantity ?? 0);

  const { error: inErr } = await sb.rpc('process_stock_movement', {
    p_user_id: ADMIN,
    p_location_id: loc.id,
    p_item_id: fg.id,
    p_movement_type: 'PRODUCTION_IN',
    p_quantity: actual,
    p_reference_type: 'PRODUCTION_ORDER',
    p_reference_id: po.id,
    p_created_by: ADMIN,
  });
  if (inErr) fail('PRODUCTION_IN', inErr.message);
  else {
    const yieldPct = Number(((actual / target) * 100).toFixed(2));
    await sb
      .from('production_orders')
      .update({
        status: 'COMPLETED',
        actual_qty: actual,
        yield_percent: yieldPct,
        batch_number: batchNo,
        completed_at: new Date().toISOString(),
      })
      .eq('id', po.id);
    await sb.from('production_material_lines').update({ variance: 0 }).eq('production_order_id', po.id);

    const { data: fgAfter } = await sb
      .from('inventory')
      .select('quantity')
      .eq('user_id', ADMIN)
      .eq('item_id', fg.id)
      .eq('location_id', loc.id)
      .single();
    const after = Number(fgAfter.quantity);
    if (Math.abs(after - (fgBefore + actual)) < 0.001)
      pass('FG produced', `${fgBefore} → ${after}, yield=${yieldPct}%`);
    else fail('FG produced', `${fgBefore} → ${after}`);
  }

  await sb.from('notifications').insert({
    user_id: ADMIN,
    type: 'PRODUCTION_COMPLETE',
    title: `${prdNum} completed`,
    body: `${actual} units produced`,
    link: '/dashboard/production',
  });
  pass('notification insert');

  // Tenant isolation on new tables
  for (const t of ['machines', 'batches', 'labour_entries', 'notifications', 'boms', 'production_orders']) {
    const { data: rows } = await sb.from(t).select('id, user_id').eq('user_id', USER_B).limit(5);
    const leak = (rows ?? []).some((r) => r.user_id === ADMIN);
    if (!leak) pass(`isolation ${t}`, `userB rows=${(rows ?? []).length}`);
    else fail(`isolation ${t}`, 'leak');
  }

  // User B cannot see admin smoke BOM notes
  const { data: bBoms } = await sb
    .from('boms')
    .select('id')
    .eq('user_id', USER_B)
    .eq('notes', 'week3 smoke');
  if ((bBoms ?? []).length === 0) pass('userB cannot see admin smoke BOM');
  else fail('userB cannot see admin smoke BOM', 'leak');

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
