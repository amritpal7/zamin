# Zamin — Launch Guide & Readiness

Step-by-step to ship Zamin to the **App Store** and **Google Play**, plus an honest read on
what's done vs. what's required first. Written 2026-09-06.

---

## TL;DR — is it ready to launch to real users?

**Not yet — the app is feature-complete and tested, but it still runs entirely on your laptop.**
The code is in good shape (auth, listings, maps + privacy, on-site verification, chat/visits/offers,
reviews, reporting/moderation, price insights, pagination; server-enforced security; 94 backend
tests; load-tested to ~1,200 req/s / ~300 concurrent on one instance). What's missing is **production
infrastructure and store assets** — none of it is code, it's setup. Work through Phase 1 → 4 below.

---

## Load-test snapshot (single instance, dev laptop, through nginx)
| Concurrency | Throughput | Errors | p95 latency |
|---|---|---|---|
| 100 | ~1,200 req/s | 0% | 122 ms |
| 300 | ~1,190 req/s | 0% | 376 ms |
| 500 | ~1,220 req/s | **14%** | 727 ms |

**Read:** one instance comfortably serves heavy browse traffic (hundreds of concurrent users). It
saturates around ~500 concurrent (Postgres pool + single Node process). To go beyond: the API is
**stateless** and realtime already uses the **Redis adapter**, so **scale horizontally** (more API
containers behind a load balancer) + raise the Postgres pool / use a managed Postgres. Re-run any
time: `node backend/scripts/loadtest.js http://localhost/api 100 20`.
*Not covered here:* authenticated writes + Socket.io chat at scale (each needs a per-user token) and
true cloud autoscaling — those require the Phase 1 cloud deploy.

---

## Phase 1 — Stand up production infrastructure (the real blocker)

Everything below is "move from laptop Docker Compose → managed cloud". Pick one host; Railway or
Render are the fastest for this stack.

1. **Backend API** (Express) — deploy the `backend/` container. Set env: `NODE_ENV=production`,
   strong `DATABASE_URL`, `REDIS_HOST/PORT`, `S3_*`, `CLERK_SECRET_KEY/PUBLISHABLE_KEY` (prod),
   `CORS_ORIGIN=https://<your-app-origins>`, `RATE_LIMIT_MAX`. Run 2+ instances behind the host's LB
   (stateless + Redis adapter → safe).
2. **Postgres** — managed instance (Railway/Render/Neon/RDS). Run migrations on deploy:
   `npm run migrate:up` (node-pg-migrate). Raise the pool size for scale.
3. **Redis** — managed instance (BullMQ jobs + Socket.io adapter).
4. **Object storage** — swap MinIO → **S3 or Cloudflare R2** via the `S3_*` env vars only (no code
   change). Make the bucket **private** + serve via your CDN/signed URLs (security backlog item).
5. **Worker** — deploy `node src/worker.js` (image resize + reconcile) as a second service.
6. **Domain + TLS** — put the API behind `https://api.zamin.app` (or similar); terminate TLS at the host.

## Phase 2 — Production Clerk + security hardening

1. **Create a PRODUCTION Clerk instance** (current one is a dev/test instance). Use its **live keys**.
   Re-decide the email/2FA config (see `docs/BUGLOG.md`: a verified email forces an email-code 2FA on
   this plan — keep or plan around it).
2. **Apply the security audit action items in prod** (`security/AUDIT_SUMMARY.md`): don't expose DB/
   object-store ports, strong generated secrets in the host's secret manager, `CORS_ORIGIN` set,
   `NODE_ENV=production`, secret scanning in CI.
3. **Legal (required by both stores):** publish a **Privacy Policy** + **Terms** (public URLs) and a
   way to **delete your account/data**. Clerk `delete_self` is already enabled.

## Phase 3 — Prepare the mobile app for the stores

1. **Point the app at prod:** set `EXPO_PUBLIC_API_URL=https://api.zamin.app/api` and the **prod**
   `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (build-time env / EAS secrets).
2. **App identity:** confirm `mobile/app.json` — `ios.bundleIdentifier` (`com.zamin.app`),
   `android.package`, `version`, `ios.buildNumber`/`android.versionCode`.
3. **Assets:** a 1024×1024 **app icon**, an **adaptive icon** (Android), and a **splash** (already a
   plugin). Replace the placeholders in `mobile/public/`.
4. **Permissions copy:** the camera/location/photos strings are set in `app.json` plugins — review the
   wording for the store reviewers.
5. **Push notifications:** requires a build (Expo Go can't receive). Set `extra.eas.projectId`
   (from `eas init`) and configure FCM (Android) + APNs (iOS, auto via EAS) credentials.

## Phase 4 — Build & submit with EAS

Prereqs: **Apple Developer Program** ($99/yr) + **Google Play Developer** ($25 one-time),
`npm i -g eas-cli`, `eas login`.

```bash
cd mobile
eas init                      # links the project, writes extra.eas.projectId
eas build:configure           # eas.json already has development/preview/production profiles

# iOS — build a store binary (EAS manages certs/provisioning via your Apple login)
eas build --platform ios --profile production
eas submit --platform ios     # uploads the .ipa to App Store Connect

# Android — build an .aab
eas build --platform android --profile production
eas submit --platform android # uploads the .aab to Play Console
```

### App Store (App Store Connect)
1. Create the app (bundle id `com.zamin.app`), fill **name, subtitle, description, keywords**.
2. Upload **screenshots** (6.7" + 5.5" iPhone at minimum) — capture from a device/simulator.
3. **Privacy nutrition labels** (declare: account/Clerk, location, photos, contact/chat).
4. Provide the **Privacy Policy URL**, support URL, and a **demo account** for the reviewer
   (use a `demo_*` login from `TEST_DATA.md`).
5. Submit for review (first review ~1–3 days). Address any rejections (common: privacy labels,
   login demo access, incomplete metadata).

### Google Play (Play Console)
1. Create the app, complete **Store listing** (title, short/full description, graphics: icon,
   feature graphic 1024×500, phone screenshots).
2. Complete **Data safety** form (mirror the iOS privacy labels), **content rating** questionnaire,
   and **target audience**.
3. Upload the `.aab` to **internal testing** first → then **production**. Provide the reviewer a
   demo login.
4. Submit (first review can take a few days).

## Phase 5 — After launch
- **Observability:** add error tracking (Sentry) + logs/metrics (roadmap item).
- **CI/CD:** add build + deploy stages; `eas build --auto-submit` on tagged releases.
- **Monitoring:** watch the load-test ceiling; scale API instances + Postgres as users grow.
- **Push:** verify end-to-end on a real device build (Expo Go can't).

---

## Checklist before you hit "Submit"
- [ ] Backend + Postgres + Redis + object storage deployed (Phase 1) and reachable over HTTPS
- [ ] Migrations applied in prod (`npm run migrate:up`)
- [ ] Production Clerk instance + live keys wired into API and app
- [ ] Security hardening applied (no exposed data ports, strong secrets, CORS, NODE_ENV=production)
- [ ] Privacy Policy + Terms published (public URLs) + account deletion path
- [ ] App icon / adaptive icon / splash / screenshots ready
- [ ] `EXPO_PUBLIC_API_URL` + prod Clerk key baked into the build
- [ ] Apple Developer + Google Play accounts active
- [ ] `eas build` succeeds for iOS + Android; demo login provided to reviewers
