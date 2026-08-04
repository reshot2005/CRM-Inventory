# Week 1 Verification — StockOS Database Foundation

Generated: 2026-08-03T07:55:00.000Z (re-verified after append-only triggers)

| Check | Result | Output |
|---|---|---|
| Schema complete (26 week1 tables) | PASS | `count=26` |
| RLS policies >= 30 | PASS | `policies=34` |
| Stock ledger immutable | PASS | `stock_ledger is append-only — UPDATE/DELETE are forbidden` |
| 6 functions deployed | PASS | `generate_order_number, get_dashboard_kpis, get_low_stock_items, handle_new_user, process_stock_movement, update_updated_at_column` |
| Realtime 8 tables | PASS | `count=8` |
| Storage 4 buckets | PASS | `product-images, challans, vendor-docs, company-logos` |
| Performance indexes (>=17) | PASS | `idx_count=17` |
| Tenant isolation | PASS | `userB sees ISO-A-001 count=0 (expect 0)` |
| get_dashboard_kpis works | PASS | JSON with all 6 KPI fields |
| process_stock_movement works | PASS | `success:true` with ledger_id |
| Seed data loaded | PASS | items/inventory/vendors > 0 for admin user |
| New user trigger exists | PASS | `on_auth_user_created` |
| TypeScript types generated | PASS | `stockos-web/lib/supabase/database.types.ts` |

**Summary:** 13/13 checks passed.

## Deliverables

- Migrations: `stockos-web/supabase/migrations/20240101000000_*.sql` … `000007_*.sql`
- Apply: `npm run db:migrate` (from `stockos-web`)
- Types: `npm run db:types`
- Seed: `npm run db:seed -- <auth_user_uuid>` or UI `/dashboard/seed-data`
- Verify: `npm run db:verify`

## Important architecture notes

1. **Prisma/Nest tables archived** as `_nest_*` because the live DB used cuid + camelCase shapes incompatible with this multi-tenant UUID + `user_id` schema. Nest API inventory routes need a follow-up to retarget or migrate off `_nest_*`.
2. **Week 1 scope** is infrastructure only — dashboard pages that reference V2-only tables (`batches`, `machines`, `labour_*`, etc.) are intentionally out of schema until Week 2+.
3. **Supabase CLI** binary is unavailable on this Windows host; migrations were applied via Postgres pooler (`scripts/apply-week1-migrations.js`).
4. **stock_ledger** is append-only via restrictive RLS **and** BEFORE UPDATE/DELETE triggers (triggers guarantee ERROR even for roles that would no-op under RLS).

## Seeded users

- `admin@stockos.com` → `2ca9039a-2b4f-45fd-85d9-81d2aa03ae60` (seeded)
- `aksharaenterprisesintern@gmail.com` → `febee79f-2d3e-431e-8fa2-8c37c2b53870` (seeded; isolation verified)
