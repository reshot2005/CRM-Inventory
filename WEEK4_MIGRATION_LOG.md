# Week 4 Organization Migration Log

## Current gate

**Status: PHASE 2 PASS on live `msfnajafbdmjixbqqhvn`**

Window opened: 2026-08-03 ~16:14 IST (10:45 UTC apply start)  
Window closed: 2026-08-03T10:45:28.487Z (`PHASE2_PASS`)

### Waiver (Free plan — no platform backups)

User confirmed verbatim:

> I waive platform PITR/Pro backup. Apply Phase 2 using the logical JSON dump only. I accept rollback risk

Dashboard evidence: Free Plan does not include project backups.

Pre-apply logical dump:  
`stockos-web/.backups/live-msfnajafbdmjixbqqhvn-2026-08-03T10-45-17-383Z.json` (93 rows / 30 tables, verified earlier pattern).

Abort policy: rollback on zero-null or live isolation failure — **not triggered**.

---

## Phase 2 live outcome

| Step | Result | Evidence |
|------|--------|----------|
| 1 Fresh logical backup | PASS | `...T10-45-17-383Z.json` |
| 2 Apply `20240101000009_org_access.sql` | PASS | `Step2: APPLY_OK` |
| 3 Regenerate `database.types.ts` | PASS | Contains `organizations`, `organization_members`, `organization_invites`, `org_id` |
| 4 Zero-null `org_id` on all 30 tables | PASS | Full output below |
| 5 Week 1 two-user isolation on **live** | PASS | `cross_leak: 0`, owner_items=10, outsider_items=10 |
| Rollback | Not needed | |

### Step 4 — exact zero-null query output (pasted)

```
profiles	total=2	nulls=0
locations	total=6	nulls=0
items	total=20	nulls=0
inventory	total=22	nulls=0
stock_ledger	total=25	nulls=0
stock_adjustments	total=0	nulls=0
move_orders	total=0	nulls=0
move_order_lines	total=0	nulls=0
vendors	total=4	nulls=0
vendor_contacts	total=0	nulls=0
vendor_items	total=0	nulls=0
purchase_orders	total=1	nulls=0
purchase_order_lines	total=1	nulls=0
customers	total=4	nulls=0
customer_contacts	total=0	nulls=0
customer_activities	total=0	nulls=0
sale_orders	total=1	nulls=0
sale_order_lines	total=1	nulls=0
payments	total=0	nulls=0
delivery_challans	total=0	nulls=0
boms	total=1	nulls=0
bom_lines	total=1	nulls=0
production_orders	total=1	nulls=0
production_material_lines	total=1	nulls=0
documents	total=0	nulls=0
audit_logs	total=0	nulls=0
machines	total=0	nulls=0
batches	total=1	nulls=0
labour_entries	total=0	nulls=0
notifications	total=1	nulls=0
auth_users_without_active_owner_membership	0
```

### Step 5 — live isolation

```json
{"ok":true,"owner_items":10,"outsider_items":10,"cross_leak":0,"kpis":{"total_skus":9,"revenue_mtd":500,"low_stock_items":1,"pending_deliveries":1,"pending_adjustments":0,"open_purchase_orders":0}}
```

Actors: `admin@stockos.com` (Owner) vs `aksharaenterprisesintern@gmail.com` (unrelated user). No shared item IDs.

---

## Next (after Phase 2)

Phase 2–5 complete. Remaining:

- Production readiness (backup restore RTO, Sentry, uptime, CI harden, secret rotation)

`_nest_*` archive tables dropped (see Phase 5 below).

---

## Phase 3 — Team & Roles + invite (2026-08-03)

**Status: PASS**

### Applied to live

- `20240101000010_accept_invite.sql`
  - `accept_organization_invite(p_token)` SECURITY DEFINER (bootstrap org release + profile FK-safe)
  - Restrictive STAFF policies:
    - `stock_adjustments_staff_insert_pending` (insert APPROVED blocked)
    - `vendors_staff_no_deactivate` / `customers_staff_no_deactivate` (soft-deactivate UPDATE blocked)

### App surfaces

| Surface | Path |
|---------|------|
| Team & Roles | `/dashboard/settings/team` (nav: Administration → Team & Roles) |
| Invite accept | `/invite/accept?token=…` (copyable link from Team UI; no email provider yet) |
| Role hook | `useOrgRole()` |
| Auth `?next=` | login + register + middleware matcher includes `/invite/:path*` |

### STAFF UI gating (hide/disable)

| Page | Gate |
|------|------|
| Vendors | Deactivate button hidden unless `canDeleteVendorsCustomers` |
| Customers | Deactivate button hidden unless `canDeleteVendorsCustomers` |
| Adjustments | STAFF inserts `PENDING` only (“Submit for approval”); no stock movement until manager+ |

Nav: Vendors/Customers visible to STAFF (ops); deactivate remains UI+RLS blocked.

### Three-actor invite-flow isolation (API path = Team UI)

Script: `scripts/phase3-invite-verify.js`

```json
{"ok":true,"owner_items":10,"staff_items":10,"outsider_items":10,"same_org_visibility":true,"cross_leak":0,"staff_deactivate_blocked":true,"staff_approved_insert_blocked":true}
```

Flow: OWNER inserts `organization_invites` → STAFF user accepts via `accept_organization_invite` (not direct membership insert) → same org items as OWNER; outsider `cross_leak: 0`.

Note: verify script temporarily resets OWNER/outsider passwords then restores Phase-2 defaults (`Admin@123` / `SmokeTest@123`). Rotate those if this environment is shared.

---

## Phase 4 — Audit log (2026-08-03)

**Status: PASS**

### App

| Surface | Path |
|---------|------|
| Helper | `lib/audit/write-audit-log.ts` (non-throwing append) |
| Viewer | `/dashboard/settings/audit-log` (OWNER/ADMIN via `useOrgRole`) |
| Nav | Administration → Audit log (`adminOnly` + page gate) |

### Mutations instrumented

`writeAuditLog` after successful CREATE/UPDATE/DELETE (and status APPROVE/REJECT) on: vendors, customers, POs + receive, sales (+ payments), adjustments, production plan/complete/batch/labour, BOMs, items (add/edit/deactivate), move orders, challans, locations, machines, raw-materials/packaging quick paths, settings profile, team invites/members.

### Verify

Script: `scripts/phase4-audit-verify.js`

```json
{"ok":true,"cross_leak":0,"owner_role":"OWNER"}
```

Live `audit_logs` now has rows; outsider cannot read owner org audit by `org_id`.

---

## Phase 5 — Nest keep/delete + `_nest_*` drop (2026-08-03)

**Status: PASS**

### Decisions

See `WEEK4_NEST_DECISIONS.md`.

| Keep | Delete |
|------|--------|
| Auth (`me`, `sync`, webhook), Users admin, Health | Inventory, CRM, Sales, Manufacturing, Reports, Storage |

Prisma slimmed to `User` + `UserSession`. Nest build OK.

### `_nest_*` drop

Migration `20240101000011_drop_nest_archive.sql` via `phase5-drop-nest-archive.js`:

```json
{"ok":true,"before":26,"after":0,"remaining":[]}
```

App-code grep for `_nest_`: none (docs/scripts only).

---

## Scratch / Phase 1 history (unchanged)

Scratch `kasfulqjuotpzvhhuqkf`: 30-table isolation + rollback `pg_policies` byte-identical — PASS before live apply.
Roles: OWNER / ADMIN / MANAGER / STAFF only.
