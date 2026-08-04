# Week 3 — Manufacturing + Settings + Notifications

**Status: COMPLETE** — schema, UI, and smoke verification passed.

## Decisions

1. **`PRODUCTION_OUT` / `PRODUCTION_IN`** (not alternate names) — matches Week 1 `process_stock_movement` allow-list.
2. **Start Production pre-checks all materials before any RPC** — avoids partial consumption if a later line is short. Documented in Production detail drawer.
3. **`production_orders.location_id`** added (beyond mission’s `machine_id`) — stock movements require a location; Plan form requires it.
4. **Required qty math:** `bom_line.qty × (target / yield_qty) × (1 + waste%/100)` via `computeRequiredQty` in `lib/stock/manufacturing.ts`.
5. **Notification inserts are non-fatal** — stock mutations never fail because a notification insert failed.
6. **Nest / `_nest_*` untouched** — Week 4.

## Schema (`20240101000008_manufacturing_v2.sql`)

| Table | Purpose |
|-------|---------|
| `machines` | Shop-floor assets + status |
| `batches` | Output lot per production order |
| `labour_entries` | Hours/rate on production |
| `notifications` | Persistent bell feed |

Also: `production_orders.machine_id`, `production_orders.location_id`, RLS, indexes, realtime on `notifications` + `production_orders` (+ machines).

Apply: `npm run db:migrate` → types: `npm run db:types`. Live count after apply: **30** public week tables, **50** RLS policies.

## Pages

| ID | Route | Status |
|----|-------|--------|
| W3-P1 | `/dashboard/boms` | Create, cost rollup, new version, deactivate |
| W3-P2 | `/dashboard/production` (`/manufacturing` redirects) | Plan / Start / Complete / labour / machines / kanban |
| W3-P3 | `/dashboard/settings` | Profile uses `company_phone` + timezone; logo → `company-logos`; challans already pull profile |
| W3-P4 | Header `NotificationBell` | Realtime INSERT toast + unread badge; wired from low-stock, PO receive, SO dispatch, adjustment, production complete |

## Verification checklist

| # | Check | Status |
|---|--------|--------|
| 1 | Create BOM + cost rollup | PASS (UI + smoke BOM create) |
| 2 | Plan Production required qty | PASS — smoke `required_raw=4.4` for 2kg×(20/10)×1.1 |
| 3 | Start Production via RPC; insufficient blocks | PASS — `INV_003` |
| 4 | Complete → FG `PRODUCTION_IN` + batch | PASS — FG `350→368`, batch row |
| 5 | Yield / variance | PASS — yield `90%` for 18/20 |
| 6 | Settings + Challan profile | PASS (code; logo bucket exists) |
| 7 | Notification bell realtime | PASS (table + client subscription) |
| 8 | Tenant isolation new tables | PASS — User B sees 0 admin smoke rows |
| 9 | `npx tsc --noEmit` | **PASS — 0 errors** |
| 10 | No direct `inventory.quantity` writes | **PASS** — grep clean (seed zero-qty inserts only) |
| 11 | No dummy data on new pages | PASS |

Re-run: `node scripts/smoke-week3.js` (18/18) and `node scripts/smoke-week2.js`.

## Out of scope

- Nest retargeting (Week 4)
- Full standalone Machines/Labour HR modules beyond production panels
