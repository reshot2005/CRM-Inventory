# StockOS Infrastructure — Cost and Limits

## Services

| Service        | Plan          | Cost   | Notes                                      |
|----------------|---------------|--------|--------------------------------------------|
| Supabase       | Free          | $0/mo  | 50k MAU, 500MB DB; project may pause       |
| Supabase       | Pro           | $25/mo | No pause, larger DB                        |
| Render         | Starter       | $7/mo  | Always-on API (`stockos-api`)              |
| Vercel         | Hobby         | $0/mo  | Next.js frontend (`stockos-web`)           |
| Cloudflare R2  | Free          | $0/mo  | 10GB storage, no egress to internet        |
| Upstash Redis  | Free          | $0/mo  | Rate limits / sessions                     |

## Phase 1 (budget)

Supabase Free + Render Starter + Vercel + R2 + Upstash ≈ **$7/month**.

## Phase 2 (production)

Supabase Pro + same stack ≈ **$32/month** (typical).

## Keep Supabase Free tier awake

If you rely on the free tier pause policy, add a scheduled ping (for example GitHub Actions) every few days against your project REST URL with the anon key.

See `.github/workflows/keep-supabase-alive.yml` in this repo.

## Deploy

- **API:** Connect the repo to [Render](https://render.com), use `render.yaml` (root directory `stockos-api`), set `sync: false` secrets in the dashboard.
- **Web:** Import `stockos-web` in [Vercel](https://vercel.com) with root directory `stockos-web` and env vars from `stockos-web/.env.example`.

## Database

- App traffic: `DATABASE_URL` → Supabase **pooler** (port **6543**).
- Migrations: `DIRECT_DATABASE_URL` → **direct** Postgres (port **5432**). Required in `schema.prisma` as `directUrl`.

## Security

- `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` are **backend only**.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe in the browser.
- All uploads go to **Cloudflare R2**, not Supabase Storage.
