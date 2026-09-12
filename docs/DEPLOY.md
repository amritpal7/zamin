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

## Managed Postgres — Neon ✅ (live since 2026-09-13)

**Prod runs on Neon.** `DATABASE_URL` on `api` + `worker` points at the Neon **pooled** endpoint
`ep-solitary-dream-axhb2ba6-pooler.c-4.us-east-2.aws.neon.tech/neondb` (project `old-cherry-55565801`,
branch `production`, `sslmode=require`). Schema was provisioned by `runMigrations` on first boot and
the demo data re-seeded (118 properties). **The Railway `Postgres` service + `pg-data` volume are now
unused — delete them in the Railway dashboard** to stop paying for them.

> Re-seed / worker one-off gotcha: the worker has `watchPatterns: ["backend/**"]`, so re-attaching the
> source to the *same* commit is SKIPPED. To run a one-off (e.g. re-seed), temporarily
> `update-service watchPatterns []`, re-attach source, then restore `["backend/**"]` after.

<details><summary>Original migration runbook (kept for reference)</summary>

The prod DB was a single Railway `postgres:16` container on a 500 MB volume (no backups). Neon
adds branching, autoscale, and PITR backups. The code is **Neon-ready**: `db.js` enables TLS when
the connection string has `?sslmode=require` (Neon) or `PGSSL=true`, and `runMigrations` passes the
same SSL to node-pg-migrate. Schema self-provisions (init.sql + migrations), so migrating is a
`DATABASE_URL` swap + re-seed (real users live in Clerk, not Postgres — only the demo data moves):

1. Create a **Neon** project → copy the **pooled** connection string (ends with `...-pooler...?sslmode=require`).
2. Set `DATABASE_URL` to it on **both** the `api` and `worker` Railway services (dashboard, or ask me
   to set it via the Railway MCP). Remove the old `${{Postgres.RAILWAY_PRIVATE_DOMAIN}}` value.
3. Redeploy `api` → boot runs `runMigrations` (init.sql + migrations) against Neon → schema created.
4. Re-seed demo data (worker one-off, per the "Seed prod demo data" note above).
5. Verify `GET /properties` returns data; then the Railway `Postgres` service + `pg-data` volume can
   be deleted.

</details>

## Code review (CodeRabbit)

`.coderabbit.yaml` (repo root) configures automated PR review + secret scanning (gitleaks), with
security-focused path instructions mirroring `docs/BUGLOG.md` guardrails + `vibe-check/AGENTS.md`.
**To activate:** install the CodeRabbit GitHub app (https://github.com/apps/coderabbitai) on the
`amritpal7/zamin` repo — it then reviews every PR automatically.

## Remaining follow-ups before public launch
- [ ] **Production Clerk instance** — currently using `pk_test_/sk_test_` (test mode). Turnkey guide in **`docs/CLERK_PROD.md`** (username/password only, no Google). **Blocked on acquiring a domain** — Clerk prod needs a custom domain + DNS. Once you have live keys I wire Railway + `eas.json` + re-seed owners.
- [ ] **Lock CORS** — set `CORS_ORIGIN` on the api service once web origins are known (currently `*`).
- [ ] **Custom domains** — e.g. `api.zamin.app` / `cdn.zamin.app` via `generate-domain` + DNS.
- [ ] **Node 22** — AWS SDK v3 warns node ≥22 will be required after Jan 2027; bump the backend base image.
- [x] **Managed Postgres (Neon)** — DONE 2026-09-13 (see above); delete the old Railway `Postgres` service. Redis can move to a managed plugin similarly. Raise pool size as traffic grows (see `LAUNCH.md` load notes).
- [ ] **CodeRabbit** — config committed (`.coderabbit.yaml`); install the GitHub app to activate PR reviews.
