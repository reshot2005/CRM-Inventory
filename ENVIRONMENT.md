# StockOS — environment variables

Copy the example files, then fill values from each provider. Never commit real secrets.

| File | Purpose |
|------|---------|
| `stockos-api/.env` | Copy from `stockos-api/.env.example` |
| `stockos-web/.env.local` | Copy from `stockos-web/.env.local.example` |
| Root `.env.supabase.example` | Extra Supabase + DB notes |

## 1. Supabase (Auth + Postgres)

1. Create a project at [supabase.com](https://supabase.com) (prefer **Mumbai** or **Singapore**).
2. **Settings → API**: `Project URL`, `anon` key, `service_role` key, **JWT Secret** (under JWT Settings).
3. **Settings → Database**: connection strings — use **pooler** (port **6543**) for `DATABASE_URL`, **direct** (port **5432**) for `DIRECT_DATABASE_URL`.
4. **Authentication → URL configuration**
   - **Site URL**: `http://localhost:3000` (prod: your Vercel URL).
   - **Redirect URLs** (add all that apply):
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/**` (optional wildcard for dev)
     - `https://YOUR_APP.vercel.app/auth/callback`
5. **Confirmation emails**: **Authentication → Providers → Email** — enable **Confirm email** so users receive a message after registration. Customize templates under **Authentication → Email templates** if you like.
6. Optional: **Authentication → SMTP** for your own mail provider.

**Backend (`stockos-api/.env`)**

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
- `DATABASE_URL` (pooler), `DIRECT_DATABASE_URL` (direct)
- `SUPABASE_AUTO_APPROVE_SIGNUPS=true` so users can use the app after confirming email (set `false` if you want admin approval).
- `FRONTEND_URL` = same origin as the Next app (e.g. `http://localhost:3000`) for CORS/cookies.

**Frontend (`stockos-web/.env.local`)**

- `NEXT_PUBLIC_SUPABASE_URL` = same as `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = same as `SUPABASE_ANON_KEY` (not the service role key)

## 2. JWT secrets (backend)

Generate two random strings (≥32 chars) for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (used for legacy login, refresh cookies, and 2FA temp tokens).

## 3. Redis

Local: `REDIS_URL=redis://localhost:6379`  
Hosted: e.g. Upstash URL.

## 4. Cloudflare R2 (file uploads)

1. R2 → create bucket → optional public access or signed URLs.
2. **Manage R2 API tokens** → create token with read/write on that bucket.
3. **Account ID** from the dashboard URL.

Set in **backend** only: `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` (public bucket base URL, no trailing slash).

Optional on **frontend**: `NEXT_PUBLIC_R2_PUBLIC_HOSTNAME` for `next/image`.

## 5. Run locally

1. `cd stockos-api && npx prisma migrate deploy` (or `migrate dev`) with valid `DATABASE_URL` / `DIRECT_DATABASE_URL`.
2. `npm run start:dev` (port **3001**).
3. `cd stockos-web && npm run dev` (port **3000**).
4. Open **Register**, sign up, confirm email from inbox, then **Sign in** → **Dashboard**.

## 6. Deploy

- **Render**: set env vars from this doc; `FRONTEND_URL` = Vercel URL; `DATABASE_URL` = Supabase pooler.
- **Vercel** (`stockos-web`): set all `NEXT_PUBLIC_*` vars; `NEXT_PUBLIC_API_URL` = your Render API URL.
