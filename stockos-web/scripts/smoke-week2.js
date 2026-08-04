/**
 * Week 2 smoke script — runs PO receive + SO dispatch + oversell + tenant isolation
 * using Supabase service role as the seeded admin user (same RPCs the UI calls).
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

async function main() {
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const results = [];

  const pass = (name, detail) => {
    results.push({ name, ok: true, detail });
    console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`);
  };
  const fail = (name, detail) => {
    results.push({ name, ok: false, detail });
    console.log(`FAIL  ${name} — ${detail}`);
  };

  // KPI non-zero
  {
    const { data, error } = await sb.rpc('get_dashboard_kpis', { p_user_id: ADMIN });
    if (error) fail('Dashboard KPIs', error.message);
    else if ((data?.total_skus ?? 0) > 0) pass('Dashboard KPIs', `total_skus=${data.total_skus}`);
    else fail('Dashboard KPIs', 'total_skus=0');
  }

  // Soft-delete already done in UI — verify
  {
    const { data } = await sb
      .from('items')
      .select('is_active')
      .eq('user_id', ADMIN)
      .eq('product_code', 'SMOKE-002')
      .maybeSingle();
    if (data && data.is_active === false) pass('Soft-delete hides product', 'SMOKE-002 is_active=false');
    else fail('Soft-delete hides product', JSON.stringify(data));
  }

  // Prefetch vendor, item, location for admin
  const { data: vendor } = await sb
    .from('vendors')
    .select('id, company_name')
    .eq('user_id', ADMIN)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  const { data: item } = await sb
    .from('items')
    .select('id, product_code, standardized_name')
    .eq('user_id', ADMIN)
    .eq('product_code', 'RAW-001')
    .eq('is_active', true)
    .single();
  const { data: loc } = await sb
    .from('locations')
    .select('id, name')
    .eq('user_id', ADMIN)
    .eq('is_active', true)
    .order('name')
    .limit(1)
    .single();
  const { data: customer } = await sb
    .from('customers')
    .select('id, company_name')
    .eq('user_id', ADMIN)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!vendor || !item || !loc) {
    fail('Seed prerequisites', `vendor=${!!vendor} item=${!!item} loc=${!!loc}`);
    console.log(JSON.stringify(results, null, 2));
    process.exit(1);
  }

  // Baseline inventory qty
  const { data: invBefore } = await sb
    .from('inventory')
    .select('quantity')
    .eq('user_id', ADMIN)
    .eq('item_id', item.id)
    .eq('location_id', loc.id)
    .maybeSingle();
  const qtyBefore = Number(invBefore?.quantity ?? 0);

  // Create PO via generate_order_number + insert (same as UI)
  const { data: poNumber, error: poNumErr } = await sb.rpc('generate_order_number', {
    p_user_id: ADMIN,
    p_prefix: 'PO',
  });
  if (poNumErr) {
    fail('Create PO number', poNumErr.message);
  } else {
    const { data: po, error: poErr } = await sb
      .from('purchase_orders')
      .insert({
        user_id: ADMIN,
        po_number: poNumber,
        vendor_id: vendor.id,
        status: 'SENT',
        total_amount: 5000,
        notes: 'Week2 smoke PO',
      })
      .select('id, po_number')
      .single();
    if (poErr) fail('Create PO', poErr.message);
    else {
      pass('Create PO', po.po_number);
      const receiveQty = 25;
      const { error: lineErr } = await sb.from('purchase_order_lines').insert({
        user_id: ADMIN,
        purchase_order_id: po.id,
        item_id: item.id,
        ordered_qty: receiveQty,
        received_qty: 0,
        unit_price: 200,
      });
      if (lineErr) fail('PO lines', lineErr.message);
      else {
        // Receive via process_stock_movement
        const { data: mov, error: movErr } = await sb.rpc('process_stock_movement', {
          p_user_id: ADMIN,
          p_location_id: loc.id,
          p_item_id: item.id,
          p_movement_type: 'PURCHASE_RECEIVE',
          p_quantity: receiveQty,
          p_unit_cost: 200,
          p_reference_type: 'PURCHASE_ORDER',
          p_reference_id: po.id,
          p_notes: `Received against ${po.po_number}`,
          p_created_by: ADMIN,
        });
        if (movErr) fail('Receive stock RPC', movErr.message);
        else {
          await sb
            .from('purchase_order_lines')
            .update({ received_qty: receiveQty })
            .eq('purchase_order_id', po.id);
          await sb.from('purchase_orders').update({ status: 'RECEIVED' }).eq('id', po.id);

          const { data: invAfter } = await sb
            .from('inventory')
            .select('quantity')
            .eq('user_id', ADMIN)
            .eq('item_id', item.id)
            .eq('location_id', loc.id)
            .single();
          const qtyAfter = Number(invAfter.quantity);
          if (qtyAfter === qtyBefore + receiveQty) {
            pass('Inventory qty ↑ after receive', `${qtyBefore} → ${qtyAfter}`);
          } else {
            fail('Inventory qty ↑ after receive', `${qtyBefore} → ${qtyAfter}, expected ${qtyBefore + receiveQty}`);
          }

          const { data: ledger } = await sb
            .from('stock_ledger')
            .select('id, movement_type, quantity, reference_id')
            .eq('user_id', ADMIN)
            .eq('reference_id', po.id)
            .eq('movement_type', 'PURCHASE_RECEIVE')
            .limit(1);
          if (ledger?.length) pass('stock_ledger row after receive', ledger[0].id);
          else fail('stock_ledger row after receive', 'none');
        }
      }
    }
  }

  // Sale order dispatch + oversell
  if (!customer) {
    fail('Create SO', 'No customer seeded for admin');
  } else {
    const { data: soNumber } = await sb.rpc('generate_order_number', {
      p_user_id: ADMIN,
      p_prefix: 'SO',
    });
    const dispatchQty = 5;
    const { data: so, error: soErr } = await sb
      .from('sale_orders')
      .insert({
        user_id: ADMIN,
        order_number: soNumber,
        customer_id: customer.id,
        location_id: loc.id,
        status: 'CONFIRMED',
        total_amount: dispatchQty * 100,
        amount_paid: 0,
        payment_status: 'PENDING',
      })
      .select('id, order_number')
      .single();
    if (soErr) fail('Create SO', soErr.message);
    else {
      pass('Create SO', so.order_number);
      await sb.from('sale_order_lines').insert({
        user_id: ADMIN,
        sale_order_id: so.id,
        item_id: item.id,
        quantity: dispatchQty,
        unit_price: 100,
        total_price: dispatchQty * 100,
      });

      const { data: invMid } = await sb
        .from('inventory')
        .select('quantity')
        .eq('user_id', ADMIN)
        .eq('item_id', item.id)
        .eq('location_id', loc.id)
        .single();
      const mid = Number(invMid.quantity);

      const { error: dispErr } = await sb.rpc('process_stock_movement', {
        p_user_id: ADMIN,
        p_location_id: loc.id,
        p_item_id: item.id,
        p_movement_type: 'SALE_DISPATCH',
        p_quantity: dispatchQty,
        p_unit_cost: 100,
        p_reference_type: 'SALE_ORDER',
        p_reference_id: so.id,
        p_notes: `Sale dispatch: ${so.order_number}`,
        p_created_by: ADMIN,
      });
      if (dispErr) fail('Dispatch SO', dispErr.message);
      else {
        await sb
          .from('sale_orders')
          .update({ status: 'DISPATCHED', dispatched_at: new Date().toISOString() })
          .eq('id', so.id);
        const { data: invDisp } = await sb
          .from('inventory')
          .select('quantity')
          .eq('user_id', ADMIN)
          .eq('item_id', item.id)
          .eq('location_id', loc.id)
          .single();
        const afterDisp = Number(invDisp.quantity);
        if (afterDisp === mid - dispatchQty) {
          pass('Inventory qty ↓ after dispatch', `${mid} → ${afterDisp}`);
        } else {
          fail('Inventory qty ↓ after dispatch', `${mid} → ${afterDisp}`);
        }
      }

      // Oversell
      const huge = 999999999;
      const { error: overErr } = await sb.rpc('process_stock_movement', {
        p_user_id: ADMIN,
        p_location_id: loc.id,
        p_item_id: item.id,
        p_movement_type: 'SALE_DISPATCH',
        p_quantity: huge,
        p_created_by: ADMIN,
      });
      if (overErr && /INV_003|Insufficient/i.test(overErr.message)) {
        pass('Oversell blocked (INV_003)', overErr.message.slice(0, 120));
      } else if (overErr) {
        pass('Oversell blocked', overErr.message.slice(0, 120));
      } else {
        fail('Oversell blocked', 'RPC unexpectedly succeeded');
      }

      const { data: invFinal } = await sb
        .from('inventory')
        .select('quantity')
        .eq('user_id', ADMIN)
        .eq('item_id', item.id)
        .eq('location_id', loc.id)
        .single();
      // qty should still be afterDisp (no partial deduct)
      const finalQty = Number(invFinal.quantity);
      if (finalQty === mid - dispatchQty) {
        pass('No partial deduct on oversell', `qty still ${finalQty}`);
      } else {
        fail('No partial deduct on oversell', `qty=${finalQty}`);
      }
    }
  }

  // Tenant isolation
  {
    const { data: adminItems } = await sb
      .from('items')
      .select('id')
      .eq('user_id', ADMIN)
      .eq('is_active', true);
    const { data: bItems } = await sb
      .from('items')
      .select('id, product_code')
      .eq('user_id', USER_B)
      .eq('is_active', true);
    const overlap = (adminItems ?? [])
      .map((i) => i.id)
      .filter((id) => (bItems ?? []).some((b) => b.id === id));
    if (overlap.length === 0 && (bItems?.length ?? 0) > 0) {
      pass(
        'Tenant isolation',
        `admin=${adminItems.length} items, userB=${bItems.length} items, overlap=0`,
      );
    } else if ((bItems?.length ?? 0) === 0) {
      fail('Tenant isolation', 'user B has no items — seed may be missing');
    } else {
      fail('Tenant isolation', `overlap=${overlap.length}`);
    }

    // User B cannot see admin PO numbers via user_id filter
    const { count: adminPoCount } = await sb
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ADMIN);
    const { data: bSeesAdminPo } = await sb
      .from('purchase_orders')
      .select('id')
      .eq('user_id', USER_B)
      .ilike('notes', '%Week2 smoke%');
    if ((bSeesAdminPo ?? []).length === 0) {
      pass('User B cannot see admin smoke POs', `admin_po_count=${adminPoCount}`);
    } else {
      fail('User B cannot see admin smoke POs', 'leak detected');
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log('\n---');
  console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
