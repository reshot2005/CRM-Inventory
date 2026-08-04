# Week 4 — Nest API Decisions

**Status: COMPLETE (2026-08-03)**

Live schema is org-scoped (`items`, `vendors`, … UUID + `org_id`).
Archived Nest/Prisma camelCase tables remain as `_nest_*` until this
document’s drop step.

Frontend callers of Nest (repo-wide grep of `/api/v1/`):

| Caller | Routes |
|--------|--------|
| `stockos-web` auth login / auth-context / pending | `POST /auth/sync`, `GET /auth/me` |
| `stockos-web` admin users | `/users`, `/users/pending`, approve/reject/patch |
| `stockos-web` `lib/storage/upload.ts` | storage presign/confirm — **zero page callers** |

No callers for inventory, CRM, sales, manufacturing, or reports.

| Controller area | Files | Decision | Reason |
|-----------------|-------|----------|--------|
| auth | `auth.controller.ts`, `auth.webhook.controller.ts` | **KEEP** | `sync` + `me` required by web app; webhook for signup profile sync. Login/register Nest paths unused by UI but retained as thin legacy (register already returns 410 when Supabase configured). |
| users | `users.controller.ts` | **KEEP** | Admin Users & access page. Operates on Prisma `users` / `user_sessions` (separate Nest auth profile table — not the Week 1 inventory schema). |
| storage | `storage.controller.ts` | **DELETE** | Zero live page callers; logo upload uses Supabase Storage. R2 helpers were tied to Nest `Item`/`Document` shapes incompatible with live UUID `documents`. |
| inventory | `inventory.controller.ts`, `items-alias.controller.ts` | **DELETE** | Zero callers; Prisma maps to live `items`/`locations` with wrong column shapes. Inventory is Supabase-direct. |
| sales | `sales.controller.ts` | **DELETE** | Zero callers; same schema mismatch. |
| CRM | `crm.controller.ts` | **DELETE** | Zero callers; same schema mismatch. |
| manufacturing | `manufacturing.controller.ts` | **DELETE** | Zero callers; same schema mismatch. |
| reports | `reports.controller.ts` | **DELETE** | Zero callers (`dashboard-bundle` removed from web in Week 2). KPIs via Supabase RPC. |
| health | `app.controller.ts` | **KEEP** | Uptime / ops probe. |

## Prisma models after slim

**Kept:** `User`, `UserSession` → tables `users`, `user_sessions`.

**Removed from schema (were targeting wrong live tables or unused):** Location, Item, Inventory, StockLedger, MoveOrder*, StockAdjustment, BOM*, Production*, Vendor*, Customer*, Purchase*, Sale*, DeliveryChallan, Payment, Document, AuditLog, SequenceCounter.

## `_nest_*` drop

- Pre-drop grep (application code): **zero** references outside docs/migrations/scripts.
- SQL: `stockos-web/supabase/migrations/20240101000011_drop_nest_archive.sql`
- Apply only after this decision file is recorded.

`_nest_*` drop: **DONE** — 26 tables dropped via `20240101000011_drop_nest_archive.sql` (`phase5-drop-nest-archive.js`, after=0).
