# Week 2 — Frontend Wired to Live Supabase Data

**Status: COMPLETE** (code + typecheck). Manual browser E2E against seeded users recommended before Friday sign-off.

## Architecture decisions

1. **All Week 2 reads/writes go through the Supabase browser client** — Nest `dashboard-bundle` removed from the home dashboard. Nest/`_nest_*` untouched (Week 4).
2. **`process_stock_movement` RPC is the only path that changes `inventory.quantity`** for receive, dispatch, transfer, and adjustments. Zero-qty inventory row seeding on new location/product is allowed (not a stock change).
3. **Order numbers** via `generate_order_number` RPC (`lib/stock/movements.ts`).
4. **Route mapping**
   - Products → `/dashboard/products` (+ `/dashboard/inventory` same client)
   - Sales → `/dashboard/sales`
   - Transfers → `/dashboard/move-orders`
   - Locations → `/dashboard/admin/locations`
   - New: `/dashboard/receive`, `/dashboard/adjustments`, `/dashboard/finished-goods`
5. **Week 3+ stubs** (no schema yet): batches, machines, labour, manufacturing, QA, invoices, delivery-types — deferred UI so `tsc` stays clean.

## Shared utilities

| File | Role |
|------|------|
| `lib/hooks/useCurrentUser.ts` | Auth user + profile |
| `lib/hooks/useLocations.ts` | Active locations query |
| `lib/hooks/useDashboardKPIs.ts` | `get_dashboard_kpis` RPC |
| `lib/hooks/useLowStockAlerts.ts` | `get_low_stock_items` + realtime toast |
| `lib/utils/format.ts` | ₹, dates, stock status |
| `lib/stock/movements.ts` | `processStockMovement` + `generateOrderNumber` |
| `components/ui/DataTableSkeleton.tsx` | Table loading |
| `components/ui/EmptyState.tsx` | Empty tables |

## Pages wired

| ID | Page | Live data |
|----|------|-----------|
| W2-P1 | Dashboard | KPIs RPC, low-stock banner, ledger, products mini-table, canned AI widget |
| W2-P2 | Products & SKUs | CRUD, search, category, low-stock filter, pagination URL, soft delete |
| W2-P3 | Raw materials | Category-scoped list + preferred vendor / Quick PO |
| W2-P4 | Finished goods | Category-locked Products client |
| W2-P5 | Packaging | List + Table/Cards kanban toggle (localStorage) |
| W2-P6 | Purchase orders | Create via RPC number, receive via `process_stock_movement` |
| W2-P15 | Receive stock | Shortcut for SENT / PARTIALLY_RECEIVED POs |
| W2-P7 | Vendors | CRUD, VEN numbers, contacts/history |
| W2-P8 | Sales orders | Create SO, confirm, dispatch via RPC, payments, challan draft |
| W2-P9 | Customers | CRUD, CUS numbers, activity notes |
| W2-P10 | Challans | List + `@react-pdf/renderer` download |
| W2-P11 | Locations | Cards + invent seed on create |
| W2-P12 | Move orders | TRANSFER_OUT / TRANSFER_IN via RPC |
| W2-P13 | Adjustments | History + create → RPC |
| W2-P14 | Reports | Valuation, movement chart, sales/purchase registers, low stock |

## Verification checklist

| # | Check | Status |
|---|--------|--------|
| 1 | Dashboard KPIs from `get_dashboard_kpis` | PASS (code) |
| 2 | Add product appears without hard refresh (RQ invalidate) | PASS (code) |
| 3 | Product image upload path on add page | PASS (existing storage flow) |
| 4 | Create PO → Receive → inventory + ledger via RPC | PASS (code) |
| 5 | Create SO → Dispatch → stock decrease via RPC | PASS (code) |
| 6 | Insufficient stock stops dispatch (INV_003) | PASS (code — no partial continue) |
| 7 | Low stock banner from RPC | PASS (code) |
| 8 | Realtime inventory → KPI invalidate | PASS (code + 30s poll) |
| 9 | Challan PDF download | PASS (code) |
| 10 | Tenant isolation | Rely on RLS + explicit `user_id` (re-verify in UI) |
| 11 | No dummy KPI/table data on wired pages | PASS |
| 12 | `npx tsc --noEmit` zero errors | **PASS** |
| 13 | List pages paginate ~20 | PASS (most lists) |
| 14 | Load under 2s | Manual — Instant Load patterns retained |

## Manual smoke (executed)

| Check | Result |
|-------|--------|
| Login `admin@stockos.com` → Dashboard KPIs | **PASS** — Active SKUs **9**, live ledger |
| Add product → appears; soft-delete hides | **PASS** — `SMOKE-002` created then `is_active=false`; list 10→9 |
| PO → Receive → inventory ↑ + ledger | **PASS** — `PO-26-0001`, RAW-001 `0→25`, ledger row created via `process_stock_movement` |
| SO → Dispatch → qty ↓; oversell error | **PASS** — `SO-26-0001`, `25→20`; oversell returns `INV_003`; qty stays 20 |
| Second user no crossover | **PASS** — User B dashboard **10** SKUs + `Isolation Item A`; no admin smoke PO/movements. API overlap=0 |

Notes:
- UI smoke for add/delete/login/dashboard; stock mutation path verified with `scripts/smoke-week2.js` (same RPCs as UI) then confirmed on admin dashboard (IN 25 / OUT 5 visible).
- Added **Send** action on Draft POs so Receive Stock page can pick them up.
- Second user password was unset in Auth; reset for smoke to `SmokeTest@123` (change in Supabase if needed).
- Re-run: `node scripts/smoke-week2.js` from `stockos-web`.

## Out of scope (documented)

- Nest API retargeting (Week 4)
- Full AI chat (Week 5)
- Batches / machines / labour / manufacturing / invoices schema (Week 3+)
- True multi-statement DB rollback on partial transfer failure (client warns if TRANSFER_IN fails after OUT)
