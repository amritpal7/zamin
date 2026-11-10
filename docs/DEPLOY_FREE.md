# Free-tier production stack (replaces Railway, 2026-11-08)

**Live since 2026-11-10:** API `https://zamin-api.onrender.com` · Render service `srv-dbpagcff3r2c73fjc5f0`
(workspace "My Workspace") · Key Value `zamin-redis` (`red-dbo55gff3r2c73a6vs4g`) · Neon `ap-southeast-1` ·
R2 buckets `zamin-media` (public r2.dev) + `zamin-uploads` (private). Demo data: 118 listings (seed-demo + SEED_DEMO).
Secrets (`DATABASE_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `CLERK_*`, `SUPPORT_EMAIL`) were entered in the Render
dashboard by the owner — names WITHOUT the `PROD_` prefix used in the local root `.env`.

| Piece | Service | Free limits (check current pricing) |
|---|---|---|
| API **+ workers** | **Render** free web service (Docker, `backend/Dockerfile`), region **Singapore** | Sleeps after ~15 min idle, ~1 min cold start; 512 MB; no free background workers → `RUN_WORKER_IN_API=true` |
| Redis (BullMQ, Socket.io adapter, revocation cache) | **Render Key Value** free, Singapore | ~25 MB, not persisted (fine: queues/caches only) |
| Postgres | **Neon** free, AWS Singapore (`ap-southeast-1`) | 1 GB/project, 100 CU-h/month, scales to zero, never expires |
| Photos | **Cloudflare R2** | 10 GB, zero egress |

Why not Upstash Redis: BullMQ polls Redis constantly — the 500K commands/month free tier would run out.
Why not Render Postgres free: deleted after 30 days.

## One-time setup (owner)

### 1. Neon
1. https://neon.tech → sign up → **New project**: name `zamin`, Postgres 16+, region **AWS Asia Pacific (Singapore)**.
2. **Connection details** → copy the **pooled** connection string (contains `-pooler` and `sslmode=require`).
3. Put it in the root `.env` as `PROD_DATABASE_URL=postgresql://…?sslmode=require` (never committed).

### 2. Cloudflare R2
1. https://dash.cloudflare.com → **R2 Object Storage** → enable (free plan; a card may be requested).
2. Create **two** buckets, location **Asia-Pacific**:
   - `zamin-media` — processed photos → **Settings → Public access → R2.dev subdomain: Allow** → copy the
     `https://pub-….r2.dev` URL.
   - `zamin-uploads` — raw uploads → leave **private** (raw photos can contain GPS metadata).
3. **R2 → Manage API tokens → Create API token**: permission **Object Read & Write**, scoped to those two
   buckets. Copy the **Access Key ID**, **Secret Access Key** and the **S3 endpoint**
   (`https://<account-id>.r2.cloudflarestorage.com`).
4. Root `.env` (never committed):
   ```
   PROD_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   PROD_S3_ACCESS_KEY=…
   PROD_S3_SECRET_KEY=…
   PROD_S3_PUBLIC_BASE=https://pub-….r2.dev
   ```
5. (Web client only) bucket `zamin-uploads` → Settings → CORS: allow `PUT` from your web origin. Native apps need no CORS.

### 3. Render (done by Claude via the Render connector, with your OK)
- Key Value `zamin-redis` (free, Singapore) → its **internal** URL becomes `REDIS_URL`.
- Web service `zamin-api` (free, Docker, Singapore): repo `amritpal7/zamin`, branch `master`,
  Dockerfile `./backend/Dockerfile`, context `./backend`, health check `/health`.
- Render must have access to the GitHub repo (Render dashboard → Account → GitHub → grant `zamin`).

## Service environment

| Var | Value |
|---|---|
| `NODE_ENV` | `production` |
| `RUN_WORKER_IN_API` | `true` |
| `DATABASE_URL` | Neon pooled URL (`sslmode=require` → SSL on) |
| `REDIS_URL` | Render Key Value internal URL |
| `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` | from `.env` (dev instance is fine for testing; prod instance needs a domain — `docs/CLERK_PROD.md`) |
| `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT` | R2 S3 endpoint (both) |
| `S3_REGION` | `auto` |
| `S3_BUCKET` / `S3_UPLOAD_BUCKET` | `zamin-media` / `zamin-uploads` |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | R2 token |
| `S3_PUBLIC_BASE` | `https://pub-….r2.dev` (photo URLs become `<base>/properties/<id>.jpg`) |
| `API_PUBLIC_URL` | `https://zamin-api.onrender.com` (or the assigned URL) |
| `SUPPORT_EMAIL` | your support address (shown on `/account-deletion`) |
| `SEED_DEMO` | `true` only if you want the 6 demo listings |
| `SENTRY_DSN` | optional |

## App
Point the build at the new API: `mobile/eas.json` profiles + `mobile/.env` `EXPO_PUBLIC_API_URL=https://<render-url>`.
Remember: after editing `mobile/.env`, recreate local Metro (see BUGLOG).

## Known trade-offs
- Cold start ~1 min after 15 min idle (first request is slow; realtime reconnects). Upgrade the web
  service to Starter (or Railway Hobby) when you have steady users.
- Free Key Value is not persisted: a restart drops queued thumbnail jobs (the hourly sweep cleans their
  raw uploads; the user can re-post the photo).
