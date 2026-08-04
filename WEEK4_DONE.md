# Week 4 — Status (in progress)

**Status: Phase 0–5 (Nest) complete on live; prod readiness remaining**

Recorded: 2026-08-03 (Nest keep/delete + `_nest_*` drop PASS)

## Verification checklist (original Week 4)

| # | Check | Status | Evidence |
|---|--------|--------|----------|
| 1 | Rollback tested on scratch before real migration | **PASS** | Scratch rehearsal |
| 2 | All business tables `org_id` zero NULLs on real DB | **PASS** | Phase 2 |
| 3 | Three-actor isolation via invite UI on real DB | **PASS** | Phase 3 |
| 4 | STAFF UI gating + RLS blocks destructive actions | **PASS** | Phase 3 |
| 5 | `audit_logs` rows for every mutation type + UI | **PASS** | Phase 4 |
| 6 | Nest keep/retarget/delete documented + kept routes work | **PASS** | `WEEK4_NEST_DECISIONS.md` — keep auth/users/health; delete inventory/CRM/sales/mfg/reports/storage |
| 7 | `_nest_*` dropped after grep-proven zero refs | **PASS** | 26 → 0 tables; migration `00011` |
| 8 | Real backup restore timed | **PENDING** | `WEEK4_BACKUP_RUNBOOK.md` |
| 9 | Sentry captures deliberate test error | **PENDING** | Needs DSN |
| 10 | CI blocks deliberately broken PR | **PARTIAL** | Workflow scaffolded |
| 11 | No secrets in repo / client bundle | **PARTIAL** | Rotate keys after Week 4 |
| 12 | `npm run type-check` zero errors monorepo | **PARTIAL** | Pre-existing web `org_id` Insert TS noise |

## Nest kept surface

- `GET /health`
- `GET /api/v1/auth/me`, `POST /api/v1/auth/sync`, webhook
- `/api/v1/users/*` (admin approve/reject)
- Prisma models: `User`, `UserSession` only

## Next action

Production readiness: backup restore RTO, Sentry, uptime, CI harden, secret rotation.
