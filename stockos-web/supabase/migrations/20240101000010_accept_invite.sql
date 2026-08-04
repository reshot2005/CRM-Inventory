-- Week 4 — accept organization invite (SECURITY DEFINER)
-- Idempotent. Allows an authenticated user to join an org via invite token
-- while releasing their bootstrap OWNER org (one active membership per user).

create or replace function accept_organization_invite(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_invite organization_invites%rowtype;
  v_bootstrap_org uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_001: not authenticated' using errcode = '42501';
  end if;

  select email into v_email from auth.users where id = v_uid;
  if v_email is null then
    raise exception 'ORG_030: user email not found' using errcode = '42501';
  end if;

  select * into v_invite
  from organization_invites
  where token = p_token
  for update;

  if not found then
    raise exception 'ORG_031: invite not found' using errcode = 'P0002';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'ORG_032: invite already accepted' using errcode = '22000';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'ORG_033: invite expired' using errcode = '22000';
  end if;
  if lower(v_invite.email) <> lower(v_email) then
    raise exception 'ORG_034: invite email does not match signed-in user'
      using errcode = '42501';
  end if;

  -- Release bootstrap OWNER org if this user still owns one that is not the invite target.
  select id into v_bootstrap_org
  from organizations
  where owner_id = v_uid
    and id is distinct from v_invite.org_id
  limit 1;

  -- Point profile at invite org BEFORE deleting bootstrap (profiles.org_id FK).
  update profiles set org_id = v_invite.org_id where id = v_uid;

  -- Revoke non-OWNER active memberships on other orgs (OWNER rows fall with org delete).
  update organization_members
  set status = 'REVOKED'
  where user_id = v_uid
    and status = 'ACTIVE'
    and role is distinct from 'OWNER'
    and org_id is distinct from v_invite.org_id;

  if v_bootstrap_org is not null then
    delete from locations where org_id = v_bootstrap_org;
    -- CASCADE removes organization_members (OWNER delete allowed once org is gone).
    delete from organizations where id = v_bootstrap_org;
  end if;

  insert into organization_members (
    org_id, user_id, role, status, invited_by, invited_at, joined_at
  )
  values (
    v_invite.org_id, v_uid, v_invite.role, 'ACTIVE',
    v_invite.invited_by, v_invite.created_at, now()
  )
  on conflict (org_id, user_id) do update
  set role = excluded.role,
      status = 'ACTIVE',
      joined_at = coalesce(organization_members.joined_at, excluded.joined_at),
      invited_by = excluded.invited_by;

  update organization_invites
  set accepted_at = now()
  where id = v_invite.id;

  insert into audit_logs (user_id, org_id, action, entity_type, entity_id, new_values)
  values (
    v_uid, v_invite.org_id, 'CREATE', 'ORGANIZATION_MEMBER', v_uid,
    jsonb_build_object('role', v_invite.role, 'via', 'invite', 'token', p_token)
  );

  return jsonb_build_object(
    'success', true,
    'org_id', v_invite.org_id,
    'role', v_invite.role
  );
end;
$$;

revoke all on function accept_organization_invite(uuid) from public, anon;
grant execute on function accept_organization_invite(uuid) to authenticated;

-- STAFF may insert adjustments only as PENDING (cannot self-approve on insert).
drop policy if exists stock_adjustments_staff_insert_pending on stock_adjustments;
create policy stock_adjustments_staff_insert_pending on stock_adjustments
  as restrictive for insert
  with check (
    get_user_org_role() in ('OWNER','ADMIN','MANAGER')
    or coalesce(status, 'PENDING') = 'PENDING'
  );

-- Soft-deactivate is UPDATE is_active=false (not DELETE). Block STAFF.
drop policy if exists vendors_staff_no_deactivate on vendors;
create policy vendors_staff_no_deactivate on vendors
  as restrictive for update
  using (
    get_user_org_role() in ('OWNER','ADMIN','MANAGER')
    or is_active is not distinct from true
  )
  with check (
    get_user_org_role() in ('OWNER','ADMIN','MANAGER')
    or is_active is not distinct from true
  );

drop policy if exists customers_staff_no_deactivate on customers;
create policy customers_staff_no_deactivate on customers
  as restrictive for update
  using (
    get_user_org_role() in ('OWNER','ADMIN','MANAGER')
    or is_active is not distinct from true
  )
  with check (
    get_user_org_role() in ('OWNER','ADMIN','MANAGER')
    or is_active is not distinct from true
  );
