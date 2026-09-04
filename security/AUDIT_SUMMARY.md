# Security Audit Summary

Date: 2026-09-05 · Auditor: automated pass against `vibe-check/AI-CHECKLIST.MD`
Scope: `backend/` (Express API + BullMQ worker), `mobile/` (Expo app), `docker-compose.yml`.

> Findings pass + **action items implemented 2026-09-05** (see "Fixes applied" below).

## Fixes applied (2026-09-05)
- **Deployment hardening** (`docker-compose.yml`): Postgres `5432`, MinIO `9000`/`9001`, and API
  `4000` are now bound to **`127.0.0.1`** (verified closed on the LAN IP; nginx `:80` + Metro `:8081`
  stay LAN-exposed for the phone). DB/MinIO creds + `NODE_ENV` are now `${VAR:-default}` so prod
  overrides via `.env`; the DB healthcheck reads container env.
- **Dependencies** → **0 vulnerabilities**: `sharp` 0.33.5 → **0.35.4** (fixes the libvips CVEs);
  `qs` pinned to `^6.16.0` via `overrides` (clears the transitive `qs`/`body-parser` moderates
  without an express-5 breaking bump). Also **added `backend/.dockerignore`** — the image build was
  copying a stale host `node_modules` over the fresh install (that's why the sharp bump wasn't
  taking); now excluded.
- **File uploads**: nginx `client_max_body_size` 50M → **16M** (server-side cap on presigned PUTs).
- Verified after changes: API 200 via nginx, object-storage proxy alive, `npm audit` clean,
  75/75 backend tests pass, sharp 0.35.4 in the running container.

Remaining (config-only, for prod deploy): set a real `CORS_ORIGIN`, `NODE_ENV=production`, strong
`POSTGRES_PASSWORD`/`MINIO_*` in `.env`, and don't publish data ports at all.

## Results

| # | Category | Status | Notes |
|---|----------|--------|-------|
| 1 | SECRETS_EXPOSURE | **PASS** (LOW) | `.env` gitignored & untracked; `.env.example` is placeholders only; no secret keys in source. Dev DB/MinIO creds are hardcoded in `docker-compose.yml`. |
| 2 | DATABASE_ACCESS | **MEDIUM** | Postgres (not Supabase/Firebase) — backend-only, parameterized, so RLS is N/A. **But** `docker-compose.yml` publishes `5432`/`9000`/`9001` to the host with weak default creds. |
| 3 | AUTH_MIDDLEWARE | **PASS** | Every protected router uses `requireAuth` (`router.use` or per-route); Clerk middleware global; guard returns 401 JSON. Public reads are intentional. |
| 4 | ACCESS_CONTROL | **PASS** | Ownership enforced via `clerk_user_id` in `WHERE` on all write/owned reads; visits check owner/requester; messages peer-scoped. |
| 5 | FRONTEND_SECRETS | **PASS** | Client holds only `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (publishable) + `EXPO_PUBLIC_API_URL`. No secret keys in `mobile/`. |
| 6 | SSRF | **PASS** | No user-supplied URL fetching server-side. Backend fetches only fixed hosts (Expo Push, `api.clerk.com/v1/users/{id}` where id is server-controlled). |
| 7 | CSRF | **PASS (N/A)** | Token/`Authorization: Bearer` auth, no session cookies → CSRF not applicable. |
| 8 | SECURITY_HEADERS | **PASS** (LOW) | `helmet()` global (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS). CSP disabled — fine for a JSON-only API. |
| 9 | CORS | **PASS** (LOW) | Configurable via `CORS_ORIGIN`; default `*` for dev. Not paired with credentials. Set an explicit allowlist in prod. |
| 10 | RATE_LIMITING | **PASS** | Global 600/min per IP, `trust proxy 1`. Auth endpoints live in **Clerk** (its own bot/rate protection — we saw the CAPTCHA gate). |
| 11 | SQL_INJECTION | **PASS** | All queries parameterized (`$N`); dynamic filters use `params.push` + placeholders. No concatenation/interpolation. |
| 12 | XSS | **PASS** | React Native; no `dangerouslySetInnerHTML`/`innerHTML`/`v-html`. |
| 13 | PAYMENT_WEBHOOKS | **N/A** | No payments/Stripe in the app. |
| 14 | FILE_UPLOADS | **LOW** | Presigned direct-to-storage + `sharp` re-encode (rejects non-images → implicit magic-byte check); files renamed to unguessable keys; stored in MinIO/S3. Gaps below. |
| 15 | ERROR_HANDLING | **PASS** | Global error handler hides message/stack when `NODE_ENV=production`; generic 404. |
| 16 | PASSWORD_HASHING | **N/A** | Auth/passwords handled by **Clerk**. |
| 17 | DEPENDENCIES | **LOW–MEDIUM** | Lock files committed. `npm audit`: 4 vulns (3 moderate, 1 high) — transitive (`sharp`/libvips CVEs, `qs`/`body-parser`). Ranges use `^`/`~`. |

**Overall: strong.** The app's security fundamentals are in good shape — Clerk-managed auth, fully
parameterized SQL, per-owner access control, helmet, rate limiting, prod-safe errors, and the
server-enforced location privacy from the maps work. The real action items are **deployment
hardening** and **dependency updates**, not app-logic holes.

## Action items (priority order)

### MEDIUM — deployment hardening (docker-compose)
- `docker-compose.yml` publishes **Postgres `5432`** and **MinIO `9000`/`9001`** to the host, and
  bakes weak/default creds (`postgres://zamin:zamin_pass@db`, `POSTGRES_PASSWORD: zamin_pass`,
  MinIO `zamin_minio*`). Fine for local dev; **dangerous if this compose runs on a public host** —
  the DB/object store would be directly reachable with known creds.
  - Fix: don't publish `5432`/`9000` in prod (internal Docker network only); move all creds to
    `.env` (no hardcoded fallbacks in the committed file); use strong generated secrets in prod.

### LOW–MEDIUM — dependencies
- `npm audit` (backend): 1 high + 3 moderate, all transitive (`sharp`→libvips CVEs; `qs`/`body-parser`).
  - Fix: `npm audit fix`, bump `sharp` to a patched release; re-run. Consider pinning exact versions
    for prod images. (CI already runs `npm audit` — keep it gating.)

### LOW — file uploads
- Presigned PUT size is enforced **client-side only** — a client could upload an oversized object
  directly to storage. `sharp` re-encoding mitigates malicious *content*, but not size/DoS.
  - Fix: set a max size / content-length condition on the presigned URL, or a bucket policy; the
    `/process` worker could also reject buffers over a cap before `sharp`.

### LOW — prod config checklist (not code bugs)
- Set `CORS_ORIGIN` to explicit domains, `NODE_ENV=production`, and rotate all default creds before
  any non-local deployment. (Object storage → private bucket + short-lived signed GETs is already a
  ROADMAP security item.)

## What's already secure (credit)
- Auth is fully delegated to Clerk (no password handling); the API guard returns **401 JSON** (not a
  302), matching the client's `redirect: "manual"`.
- **Every** state-changing/owned route is behind `requireAuth` **and** scopes queries by
  `clerk_user_id` — auth and ownership are separate, correct checks.
- **100% parameterized SQL**, including the dynamic geo/search filter builder.
- Location privacy is **server-enforced** (coords redacted for non-owners), and the on-site /
  verified badges are **server-authoritative** (clients can't self-assign).
- Secrets hygiene: `.env` ignored, `.env.example` placeholders, no keys in the client bundle.

## Remaining manual verification (for the human)
- Confirm the **production** deploy does NOT publish `5432`/`9000`/`9001` and uses strong creds.
- Confirm `NODE_ENV=production` and a real `CORS_ORIGIN` are set in the prod environment.
- Run `mobile/manual-checklist.md` + `vibe-check/manual-checklist.md` for the things code can't prove.

---
*Per-category `security/reports/*` + `security/plans/*` files (full checklist format) and the fixes
themselves were intentionally not generated in this pass — this was a "report findings" run. Say the
word to produce the detailed per-category reports and/or implement the action items above.*
