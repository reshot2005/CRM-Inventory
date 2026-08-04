# Week 4 — Backup / Restore Runbook

**Status: BLOCKED — no restore has been performed**

Recorded: 2026-08-03

## Requirement

Perform one **actual** restore of the latest Supabase backup into a scratch
project, time it, and record measured RTO here. A written-only procedure does
**not** satisfy Week 4.

## Measured restore

| Field | Value |
|-------|-------|
| Source project | Not run |
| Destination scratch project | Not run |
| Backup timestamp used | Not run |
| Restore start | Not run |
| Restore end | Not run |
| Measured RTO | **BLOCKED** |
| Verification queries | Not run |

## Blocker

Same Phase 0 gap as the org migration: no scratch Supabase project credentials
are available in this workspace (`stockos-web/.env.scratch` missing). A restore
destination cannot be invented.

## Intended steps (not yet executed)

1. Confirm automated backup schedule for the StockOS Supabase tier in the
   dashboard (Settings → Database → Backups).
2. Create or select a disposable scratch project as restore target.
3. Restore the latest backup into that project (or PITR if available on the plan).
4. Time wall-clock from “start restore” to “first successful authenticated
   query against restored data.”
5. Record RTO and verification queries in this file.
6. Tear down or quarantine the restored scratch project after evidence is saved.
