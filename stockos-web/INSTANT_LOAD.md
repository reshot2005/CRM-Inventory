# Local Instant Load setup

StockOS web needs **two processes** for full speed (dashboard bundle + auth sync):

```bash
# Terminal A — Nest API (port 3001)
cd stockos-api
npm run start:dev

# Terminal B — Next.js (example port 1234)
cd stockos-web
npm run dev -- -p 1234
```

Without the API, sidebar pages still load from Supabase; home dashboard KPIs fall back to a client retry / error hint.

Dev navigation timings log as `[perf] nav → … ≈ Nms` in the browser console.
