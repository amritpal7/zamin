# Zamin — Production Deployment (Railway)

Phase 1 of `LAUNCH.md` is live. The backend runs on **Railway** (project `zamin-prod`).
This file is the map of what's deployed and how to operate it. **No secrets live here** —
values are in the Railway dashboard (Variables tab per service).

## Live URLs
- **API:** https://api-production-43dd.up.railway.app  (e.g. `GET /properties` → 200)
- **Object storage (MinIO S3 API):** https://minio-production-26a6.up.railway.app
  (health: `/minio/health/live` → 200; console on internal :9001)

## Railway project
- Project: **zamin-prod** · id `ea39970a-d518-438d-9eab-b412e94f4e79`
- Environment: **production** · id `c9bbed3d-7fcb-4127-803a-f81d97c78089`
- Workspace: Amritpal Singh's Projects

## Services (all deploying from `master`, region sfo)
| Service | Source | Notes |
|---|---|---|
| **api** | GitHub `amritpal7/zamin`, root `backend/`, Dockerfile | Public domain on :4000. Healthcheck `/properties`. Boots → runs migrations + ensures bucket. |
| **worker** | GitHub `amritpal7/zamin`, root `backend/`, start `node src/worker.js` | Image resize + 6h owner-liveness reconcile. |
| **Postgres** | `postgres:16-alpine` + volume `pg-data` → `/var/lib/postgresql/data` | Schema self-provisions from `db/init.sql` on first boot (see below). |
| **Redis** | `redis:7-alpine` + volume `redis-data` → `/data` | BullMQ queue + Socket.io adapter (multi-instance ready). |
| **minio** | GitHub `amritpal7/zamin`, root `deploy/minio/`, Dockerfile + volume `minio-data` → `/data` | S3-compatible store. Public domain on :9000. Bucket `zamin` auto-created public-read by the API's `ensureBucket()`. |

> **Why MinIO is built from a repo Dockerfile:** the official `minio/minio` image has a
> shell-less base and a bare `minio` CMD, so Railway's shell-wrapped start command can't
> exec it (`bitnami/minio` no longer pulls since Bitnami's 2025 Docker Hub changes).
> `deploy/minio/Dockerfile` bakes `minio server /data --console-address :9001` in exec-form.

## How schema provisioning works in prod
Managed Postgres doesn't run `db/init.sql` the way the docker-compose Postgres does (that
relies on `docker-entrypoint-initdb.d`). So `src/runMigrations.js` applies the idempotent
`db/init.sql` (CREATE … IF NOT EXISTS) **before** the node-pg-migrate baseline. A fresh
managed DB self-provisions; an existing one is a no-op.

## Environment variables (names only — values in Railway)
**api & worker** share: `DATABASE_URL` (→ `${{Postgres.RAILWAY_PRIVATE_DOMAIN}}`),
`REDIS_HOST`/`REDIS_PORT` (→ `${{Redis.…}}`), `S3_ENDPOINT` (→ `http://${{minio.RAILWAY_PRIVATE_DOMAIN}}:9000`),
`S3_PUBLIC_ENDPOINT`/`S3_PUBLIC_BASE` (→ the public MinIO domain + `/zamin`), `S3_BUCKET=zamin`,
`S3_ACCESS_KEY`/`S3_SECRET_KEY`, `CLERK_SECRET_KEY`, `NODE_ENV=production`.
**api** also: `PORT=4000`, `RATE_LIMIT_MAX=600`, `CLERK_PUBLISHABLE_KEY`.
**Postgres**: `POSTGRES_USER/PASSWORD/DB`, `PGDATA`. **minio**: `MINIO_ROOT_USER/PASSWORD`.

Image URLs work unchanged because `S3_PUBLIC_BASE` is absolute — the client uses stored
URLs as-is (`useApi.js`: `u.startsWith("http") ? u : BASE+u`).

## Operating it
- **Deploy:** push to `master` → auto-build. Each service has **`watchPatterns`** so a push only
  rebuilds what changed: `api` + `worker` on `backend/**`, `minio` on `deploy/minio/**` (mobile-only
  pushes rebuild nothing). Or re-attach source / `redeploy` via the Railway MCP/CLI.
  - ⚠️ `redeploy` reuses the previous config snapshot — to pick up a changed start command / root
    dir, **re-attach the GitHub source** instead (forces a fresh build with current config).
- **Seed prod demo data:** must run *inside* Railway's network (the DB uses private DNS, and
  `railway run` executes locally so it can't reach `postgres.railway.internal`). Done once already
  (124 properties total: 112 demo + base seed; 12 loginable owners — credentials in `TEST_DATA.md`).
  To re-seed: temporarily point the **worker** at the script — `update-service` worker
  `startCommand=node scripts/seed-demo.js` + `restartPolicyType=NEVER`, re-attach source to deploy,
  read logs, then restore `startCommand=node src/worker.js` + `ON_FAILURE` and re-attach source.
  (A dedicated `seed` service is cleaner but the free plan caps the project at 5 services.)
  Note: `redeploy` reuses the previous config snapshot — re-attaching the GitHub source is what
  forces a fresh deploy that picks up a changed start command.
- **Logs / status:** Railway dashboard, or the Railway MCP (`get-status`, `get-logs`).

## Point the mobile app at prod (Phase 3)
**Wired:** `mobile/eas.json` sets these on the **preview** + **production** build profiles, so
those builds hit prod. Local dev is untouched (it still reads `EXPO_PUBLIC_API_URL` from
docker-compose). Both `useApi.js` and `SocketContext.js` resolve `extra.apiUrl → EXPO_PUBLIC_API_URL
→ localhost`; the socket strips a trailing `/api`, so the bare-root prod URL (no `/api`, no nginx in
prod) works for REST *and* realtime.
```
EXPO_PUBLIC_API_URL=https://api-production-43dd.up.railway.app
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…   # swap to pk_live_… with prod Clerk (Phase 2)
```
- **Build against prod:** `cd mobile && eas build --profile preview --platform ios` (or `android`).
- **Test locally against prod** (no build): `EXPO_PUBLIC_API_URL=https://api-production-43dd.up.railway.app EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_cG9saXRlLWdpcmFmZmUtMzkuY2xlcmsuYWNjb3VudHMuZGV2JA npx expo start -c`
- When prod Clerk lands, update the key in **both** `eas.json` profiles.

## Remaining follow-ups before public launch
- [ ] **Production Clerk instance** — currently using `pk_test_/sk_test_` (test mode). Turnkey guide in **`docs/CLERK_PROD.md`** (username/password only, no Google). **Blocked on acquiring a domain** — Clerk prod needs a custom domain + DNS. Once you have live keys I wire Railway + `eas.json` + re-seed owners.
- [ ] **Lock CORS** — set `CORS_ORIGIN` on the api service once web origins are known (currently `*`).
- [ ] **Custom domains** — e.g. `api.zamin.app` / `cdn.zamin.app` via `generate-domain` + DNS.
- [ ] **Node 22** — AWS SDK v3 warns node ≥22 will be required after Jan 2027; bump the backend base image.
- [ ] **Managed Postgres/Redis at scale** — the single-container DBs are fine for launch; move to Railway's managed plugins / raise pool size as traffic grows (see `LAUNCH.md` load notes).
