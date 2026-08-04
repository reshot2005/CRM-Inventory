/**
 * Phase 3 — three-actor invite-flow isolation (API path used by Team UI).
 * Actor A = OWNER, Actor B = invited STAFF (accept via RPC), Actor C = outsider.
 * Does NOT insert organization_members directly — uses invite + accept_organization_invite.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.join(__dirname, '..');

function loadEnv() {
  const env = { ...process.env };
  for (const file of [
    '.env.local',
    '.env.scratch',
    path.join('..', 'stockos-api', '.env'),
  ]) {
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

function anon(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase URL/anon key');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function admin(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function main() {
  const env = loadEnv();
  const ownerEmail = env.W4_LIVE_OWNER_EMAIL || env.OWNER_EMAIL || 'admin@stockos.com';
  const outsiderEmail =
    env.W4_LIVE_OUTSIDER_EMAIL ||
    env.OUTSIDER_EMAIL ||
    'aksharaenterprisesintern@gmail.com';
  const staffEmail = `phase3.staff.${Date.now()}@stockos.test`;
  const staffPass = `Phase3Staff!${Date.now().toString().slice(-4)}`;
  // Ephemeral passwords for scripted RLS checks (service-role reset; not printed).
  const verifyPass = `Phase3Verify!${Date.now().toString().slice(-6)}`;

  const owner = anon(env);
  const outsider = anon(env);
  const staff = anon(env);
  const svc = admin(env);

  console.log('Reset verify passwords via service role (ephemeral)...');
  const { data: listed, error: listErr } = await svc.auth.admin.listUsers({
    perPage: 50,
  });
  if (listErr) throw new Error(listErr.message);
  const ownerRow = (listed.users || []).find(
    (u) => (u.email || '').toLowerCase() === ownerEmail.toLowerCase(),
  );
  const outsiderRow = (listed.users || []).find(
    (u) => (u.email || '').toLowerCase() === outsiderEmail.toLowerCase(),
  );
  if (!ownerRow) throw new Error(`OWNER user not found: ${ownerEmail}`);
  if (!outsiderRow) throw new Error(`Outsider user not found: ${outsiderEmail}`);

  const { error: owReset } = await svc.auth.admin.updateUserById(ownerRow.id, {
    password: verifyPass,
  });
  if (owReset) throw new Error(`OWNER password reset failed: ${owReset.message}`);
  const { error: outReset } = await svc.auth.admin.updateUserById(
    outsiderRow.id,
    { password: verifyPass },
  );
  if (outReset) {
    throw new Error(`Outsider password reset failed: ${outReset.message}`);
  }

  console.log('Sign in OWNER...');
  const { error: e1 } = await owner.auth.signInWithPassword({
    email: ownerEmail,
    password: verifyPass,
  });
  if (e1) throw new Error(`OWNER sign-in failed: ${e1.message}`);

  const ownerUser = (await owner.auth.getUser()).data.user;
  const { data: orgId, error: orgErr } = await owner.rpc('get_user_org_id');
  if (orgErr || !orgId) throw new Error(orgErr?.message || 'OWNER has no org');
  const { data: ownerRole } = await owner.rpc('get_user_org_role');
  if (ownerRole !== 'OWNER') {
    throw new Error(`Expected OWNER role, got ${ownerRole}`);
  }

  console.log('Create invite (same path as Team UI)...');
  const { data: invite, error: invErr } = await owner
    .from('organization_invites')
    .insert({
      org_id: orgId,
      email: staffEmail,
      role: 'STAFF',
      invited_by: ownerUser.id,
    })
    .select('id, token, email, role')
    .single();
  if (invErr) throw new Error(`invite insert failed: ${invErr.message}`);

  console.log('Provision STAFF auth user (service role)...');
  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email: staffEmail,
    password: staffPass,
    email_confirm: true,
    user_metadata: { name: 'Phase3 Staff' },
  });
  if (createErr) throw new Error(`createUser failed: ${createErr.message}`);
  const staffId = created.user.id;

  console.log('STAFF accepts invite via accept_organization_invite...');
  const { error: staffSignErr } = await staff.auth.signInWithPassword({
    email: staffEmail,
    password: staffPass,
  });
  if (staffSignErr) throw new Error(`STAFF sign-in: ${staffSignErr.message}`);

  const { data: acceptRes, error: acceptErr } = await staff.rpc(
    'accept_organization_invite',
    { p_token: invite.token },
  );
  if (acceptErr) throw new Error(`accept failed: ${acceptErr.message}`);

  const { data: staffRole } = await staff.rpc('get_user_org_role');
  const { data: staffOrg } = await staff.rpc('get_user_org_id');
  if (staffRole !== 'STAFF' || staffOrg !== orgId) {
    throw new Error(
      `STAFF membership wrong: role=${staffRole} org=${staffOrg} expect STAFF/${orgId}`,
    );
  }

  console.log('Isolation checks...');
  const { data: ownerItems } = await owner.from('items').select('id');
  const { data: staffItems } = await staff.from('items').select('id');
  const { error: outSignErr } = await outsider.auth.signInWithPassword({
    email: outsiderEmail,
    password: verifyPass,
  });
  if (outSignErr) throw new Error(`outsider sign-in: ${outSignErr.message}`);
  const { data: outsiderItems } = await outsider.from('items').select('id');

  const ownerIds = new Set((ownerItems || []).map((r) => r.id));
  const staffIds = new Set((staffItems || []).map((r) => r.id));
  const sameOrg =
    ownerIds.size === staffIds.size &&
    [...ownerIds].every((id) => staffIds.has(id));
  const leak = (outsiderItems || []).filter((r) => ownerIds.has(r.id));

  // STAFF cannot deactivate vendor (RLS should block UPDATE is_active=false for STAFF).
  const { data: anyVendor } = await owner
    .from('vendors')
    .select('id, is_active')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  let staffDeactivateBlocked = true;
  if (anyVendor) {
    const { error: deactErr, data: deactData } = await staff
      .from('vendors')
      .update({ is_active: false })
      .eq('id', anyVendor.id)
      .select('id');
    // Expect either error or zero rows returned (RLS silently filters).
    staffDeactivateBlocked =
      Boolean(deactErr) || !deactData || deactData.length === 0;
    // Restore if somehow changed
    await owner
      .from('vendors')
      .update({ is_active: true })
      .eq('id', anyVendor.id);
  }

  // STAFF cannot insert APPROVED adjustment
  const { data: anyItem } = await staff.from('items').select('id').limit(1).maybeSingle();
  const { data: anyLoc } = await staff
    .from('locations')
    .select('id')
    .limit(1)
    .maybeSingle();
  let staffApprovedInsertBlocked = true;
  if (anyItem && anyLoc) {
    const { error: adjErr } = await staff.from('stock_adjustments').insert({
      user_id: staffId,
      item_id: anyItem.id,
      location_id: anyLoc.id,
      quantity: 1,
      adjustment_type: 'ADD',
      reason: 'COUNT_CORRECTION',
      status: 'APPROVED',
      approved_by: staffId,
      approved_at: new Date().toISOString(),
      created_by: staffId,
    });
    staffApprovedInsertBlocked = Boolean(adjErr);
  }

  // Cleanup test STAFF (revoke membership, then delete auth user).
  await svc
    .from('organization_members')
    .delete()
    .eq('user_id', staffId);
  await svc.from('profiles').delete().eq('id', staffId);
  await svc.auth.admin.deleteUser(staffId);

  // Restore known Phase-2 live passwords after ephemeral reset.
  await svc.auth.admin.updateUserById(ownerRow.id, { password: 'Admin@123' });
  await svc.auth.admin.updateUserById(outsiderRow.id, {
    password: 'SmokeTest@123',
  });
  console.log(
    'Restored OWNER/outsider passwords to Phase-2 known defaults (Admin@123 / SmokeTest@123). Rotate if needed.',
  );

  const result = {
    ok:
      sameOrg &&
      leak.length === 0 &&
      staffDeactivateBlocked &&
      staffApprovedInsertBlocked &&
      acceptRes?.success === true,
    owner_items: (ownerItems || []).length,
    staff_items: (staffItems || []).length,
    outsider_items: (outsiderItems || []).length,
    same_org_visibility: sameOrg,
    cross_leak: leak.length,
    staff_deactivate_blocked: staffDeactivateBlocked,
    staff_approved_insert_blocked: staffApprovedInsertBlocked,
    accept: acceptRes,
    invite_email: staffEmail,
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
