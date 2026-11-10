# Changelog

All notable changes to Zamin are recorded here. **Newest first.**

Format: each entry is dated and tagged `Added` / `Changed` / `Fixed` / `Removed` /
`Security` / `Docs` / `Ops`. Keep entries short but specific — name the file(s) and the
*why*, not just the *what*. Update this file **in the same change** that makes the edit.

> Convention: an entry is not "done" until it's (a) built/validated and (b) logged here.

---

## [Unreleased]

### 2026-11-10 (Added: admin moderation — reported listings & users)
Reports were collected (listing reports auto-hide at 3) but nobody could act on them, and **user reports
(from chat) were never surfaced anywhere**.
- `backend/src/routes/admin.js` (`/admin`, admins = `ADMIN_USER_IDS`, read per request): `status`, `reports`
  (listing + user queues, Clerk display names, banned state), listing `hide|restore|dismiss`, user
  `dismiss|ban|unban` (Clerk Backend API ban + flag all their listings; admins can't be banned).
- User reports deduped per reporter/target/listing; 500s no longer leak `err.message`; `getUser` returns `banned`.
- App: `mobile/app/moderation.js` (cards with thumbnail, reporters/reasons/time, status pill, actions, ban
  confirm, pull-to-refresh, "All clear" empty state); Me menu shows **Moderation** only for admins
  (`GET /admin/status`); route protected by AuthGuard; new `flag` icon.
- `docker-compose.yml` passes `ADMIN_USER_IDS` + `SUPPORT_EMAIL` to the api.
- **Security review fixes (zamin-security, no blockers):**
  - M1: user-report targets must be Clerk-shaped (`user_…`/`seed_user_N`) — junk/path-like ids rejected (they
    reached server-side Clerk lookups); per-user limit 20/h on both report routes; `getUser` encodes the id;
    admin queue lookups capped at 10 concurrent.
  - M2: ban uses a new `owner_banned` column (migration `1731300000000_…`), not per-listing `flagged` — unban
    no longer un-hides listings hidden for their own reasons (live-verified with real Clerk ban/unban).
  - M3: `GET /properties/:id` → 404 for hidden / banned-owner listings except owner + admins; saved lists,
    public feed and insights comparables exclude them.
  - L1: ban marks the id revoked (Redis, 5 min) + disconnects sockets; unban clears it. L2: unique index on
    reports + `ON CONFLICT DO NOTHING` (dupes removed first). L3: `[moderation]` audit log lines; Clerk 404 →
    404. L4: legacy `/properties/moderation` + `/:id/moderate` removed; one `isAdmin`. L5: id validation.
  - Backend **136/136**.
- Verified on emulator (local, @zamintest01 as admin): queue shows seeded listing + user reports; Hide →
  "Hidden" and gone from public feed; Restore; **Ban** → Clerk banned + 11/11 listings hidden; **Unban** →
  restored; Dismiss ×2 → "All clear". Fixed a stretched status pill (alignSelf). Backend **130/130** (+5).

### 2026-11-10 (Added: cold-start handling for the free host · Fixed: internal "demo-seed" tag shown on listings)
**Problem:** the free Render API sleeps after ~15 min idle; the next request takes up to ~1 min — testers
would see an endless spinner or an error and assume the app is broken.
- `mobile/src/utils/serverStatus.js`: `trackedFetch` (used by the API client + presign) flags "slow" after
  4 s pending and retries a **GET** once on network error / 502–504 (never POST/PUT/DELETE — no double
  submit); `warmUpServer()` pings `/health` at app start (server wakes during splash/sign-in).
- `mobile/src/components/ServerWakeBanner.js`: "Waking up the server… first load can take up to a minute",
  mounted via the root Stack `screenLayout` (as a sibling of `<Stack>` it rendered *under* the native screens
  on Android — see BUGLOG). Uses `elevate()`, ignores touches.
- `.github/workflows/keep-warm.yml`: pings `/health` every 10 min (public repo → free minutes; one always-on
  free service ≈ 730 h < 750 h/month). `/health` doesn't touch Neon, so the DB still scales to zero.
- Verified on emulator by pausing the API container: banner appears at ~4 s, clears on resume; app recovers.
  Tests: 4 new (`serverStatus.test.js`).
**Fixed:** demo listings showed the seeder's internal `demo-seed` tag — `displayTags()` (`utils/property.js`)
filters internal markers in property detail + My Listings. Verified on device. Mobile tests **44/44**.

### 2026-11-10 (Ops: production live on the free stack — Render + Neon + Render Key Value + Cloudflare R2)
- Render web service `zamin-api` (free, Docker, Singapore, `RUN_WORKER_IN_API=true`) + Key Value `zamin-redis`
  (free, `noeviction`) created via the Render connector; secrets entered by the owner in the dashboard.
  Neon (PG 18, `ap-southeast-1`, pooled) + R2 (`zamin-media` public, `zamin-uploads` private).
- First boot: migrations + `SEED_DEMO` base rows; `scripts/seed-demo.js` run against Neon → **118 listings**.
- **Verified live:** `/health` 200, `/saved` 401→200 with a token, `/properties` 118 with photos, presigned PUT
  to R2 (private bucket, no checksum param) 200 → `/process` → in-process worker → public photo + thumb 200 on
  r2.dev → listing create 201; raw `_orig` not public (404); Socket.io polling handshake OK; `/account-deletion` 200.
- Fixes found while deploying: empty error logs on connection failures now print the error code; in-process
  workers start only **after** migrations (boot-time maintenance job hit a not-yet-created schema on fresh Neon).
- Server secrets moved out of `mobile/.env` into the root `.env` (they had been added there).
- App: `mobile/eas.json` (preview + production) and `mobile/.env` → `https://zamin-api.onrender.com`; local Metro
  recreated (local bundle still targets `10.0.2.2`). `docs/DEPLOY.md` marked superseded by `docs/DEPLOY_FREE.md`.

### 2026-11-08 (Ops: free-tier hosting readiness — Render + Neon + Render Key Value + Cloudflare R2)
Railway trial expired (prod "Application not found"). Code changes so the backend runs on free tiers:
- `src/redisConfig.js`: one Redis config for BullMQ, Socket.io adapter and revocation; supports `REDIS_URL`
  (redis/rediss, user/password/TLS) else `REDIS_HOST/PORT`.
- `RUN_WORKER_IN_API=true` starts the thumbnail + maintenance workers inside the API (Render free has no
  background workers) — `src/index.js`.
- Storage (`src/storage.js`): `S3_REGION` (R2 `auto`); `S3_UPLOAD_BUCKET` — raw uploads in a separate private
  bucket (R2 public access is per bucket, no policy to hide `_orig`), used by presign, worker, photo route,
  sweep and account deletion; checksum calculation `WHEN_REQUIRED` → presigned PUTs no longer carry
  `x-amz-checksum-crc32` (R2/S3 could reject); `ensureBucket` tolerates no create rights / no bucket policy.
- Media path check accepts R2 public URLs (`/properties/<id>.jpg` at the bucket root) on configured hosts.
- `realtime.js` uses the guarded Sentry from `instrument.js` (unguarded require crashed a fresh container).
- `backend/Dockerfile` → **Node 22** (AWS SDK requires ≥22 from Jan 2027).
- Verified locally: 125/125 tests on Node 22; photo pipeline 200; presign has no checksum param; free-host
  mode (`RUN_WORKER_IN_API` + `REDIS_URL`, bogus `REDIS_HOST`) boots API, adapter and in-process workers.
- New runbook `docs/DEPLOY_FREE.md`.

### 2026-11-08 (Security backlog cleared: listing-photo validation, session revocation, public deletion page)
- **Listing photos validated on save** (`checkListingImages` in `routes/properties.js`, `mediaBaseOf` in
  `messaging.js`): new `images`/`thumbnails` must be our processed media on a configured host and owned by
  the caller (`media_objects`). URLs already on the edited row stay allowed (legacy uploads, demo photos,
  on-site badge keys unchanged). Live: app-format own photo 201; someone else's photo 400; edit legacy 200.
- **Session revocation on delete** (`src/revocation.js`): deleted ids marked in Redis (5 min, + in-memory);
  `requireAuth` and socket auth reject them. Live: deleted user's still-valid JWT → 401 on GET and POST.
- **Public `GET /account-deletion` page** (`src/publicPages.js`) for Play's data-deletion URL; contact from
  `SUPPORT_EMAIL` (new in `.env.example`).
- Tests: +7 (photo validation ×4, revocation, public page); on-site tests now use owned media. Backend **125/125**.

### 2026-11-08 (Security: account-deletion review fixes — media ownership, Clerk-timeout safety, Host header)
zamin-security review of Delete account found **HIGH-1 (blocking)**: deletion derived storage keys from the
user's listing `images` URLs, which clients can forge → a throwaway account could delete anyone's photos.
- **Fixed:** new `media_objects(base, clerk_user_id)` (migration `1731200000000_…`), written by `/process`
  and legacy `/upload`. Deletion removes only owned bases (`src/accountDeletion.js`). Live-verified: forged
  listing referencing a victim photo → after deletion own photo 404, **victim photo + thumb still 200**.
- **MED-1:** Clerk timeout after a successful delete no longer orphans data — durable `account_deletions`
  marker; on Clerk error we re-check the user (gone → commit); hourly sweep (`finishPendingDeletions`)
  finishes leftovers or clears markers for users who still exist.
- **MED-2:** chat-image host allowlist no longer uses `req.hostname` (client-controlled Host header); config
  only (`S3_PUBLIC_ENDPOINT`, `S3_PUBLIC_BASE`, `API_PUBLIC_URL`). App's real URL format still 201. Test added.
- LOW: purge also removes other users' notifications naming the deleted user; reports *about* the user are
  kept (moderation evidence; privacy draft updated); live sockets disconnected; `lock_timeout`/`statement_timeout`
  + per-IP limiter on deletion; indexes on `messages(sender_id)`/`(receiver_id)`; demo seed now only with
  `SEED_DEMO=true` on API boot; bucket name escaped in the media regex.
- Backend **119/119** (+ purge-scope, sweep and Host-spoof tests). Backlog: validate listing image URLs on
  save, session revocation on delete (ROADMAP).

### 2026-11-08 (Added: Delete account · Fixed: Home feed photos — seed duplicated on every boot, stale image hosts, bare prices)
**Added — Delete account** (Play Store requirement). Settings → Delete account (under Sign out) → confirm
modal → `DELETE /users/me` (`backend/src/routes/users.js`, `deleteClerkUser` in `clerkUsers.js`,
`api.deleteAccount`). One transaction wipes every user-keyed row in 11 tables and deletes the Clerk user
inside it (rollback if Clerk fails); listing photos removed from storage after commit. Per-user limit 5/h,
explicit `{confirm:"DELETE"}`. Verified: live API E2E with a throwaway Clerk user (listing+photo, save,
message → all gone; photo 404; Clerk 404) and on the emulator (throwaway account deleted → lands on
sign-in → Clerk user gone). Tests: 401/400 guards + **rollback leaves data intact**. Privacy/Terms drafts updated.

**Fixed — Home feed showed almost no photos.** Root cause: `runMigrations.js` runs `db/init.sql` on every
api boot, and its seed `INSERT … ON CONFLICT DO NOTHING` never conflicted (no unique key) → 6 photo-less
seed rows added per boot (216 dupes) burying the 118 photo listings. Seed now guarded by a `DO` block
(`NOT EXISTS seed rows`); migration `1731000000000_dedupe_seed_listings` keeps the oldest copy per
(owner,title) and never deletes a copy with messages/saves. Verified: 222 → 6 seed rows, stable across
restarts; first 20 feed items all have photos. (Prod would have duplicated on every deploy too.)
**Fixed — photos stored with a stale dev host never loaded** (e.g. `http://192.168.29.228/api/media/…`).
`mobile/src/utils/media.js` `resolveMediaUrl` rebuilds any `/media/…` URL on the current API base, applied
in `SmartImage` (all listing + chat photos). Prod MinIO URLs pass through. Verified on emulator.
**Fixed — chat image guard rejected prod URLs** (introduced 2026-11-07): `MEDIA_PATH` now also accepts
`/<bucket>/properties/…` and the `S3_PUBLIC_BASE` host. +1 test.
**Fixed — old listings showed prices without ₹** ("85 L"): migration `1731100000000_normalize_bare_prices`
rewrites digit-leading prices to the app convention (5 rows locally).
Backend **116/116**. Ripple: SmartImage is the only listing/chat image renderer (cards, detail slider,
My Listings, chat); avatars use Clerk URLs (unaffected).
**Backend status:** local healthy; **prod Railway still "Application not found"** (needs owner).

### 2026-11-08 (Android Google Maps key wired ✅ + legal drafts + prod API found down)
**Added — `mobile/app.config.js`.** Injects `GOOGLE_MAPS_ANDROID_KEY` into `android.config.googleMaps.apiKey`
(env → `mobile/.env` → root `.env`; placeholder + build-time warning if unset, since react-native-maps
crashes on Android with no key). Key lives only in git-ignored `.env`; documented in `.env.example` and
ARCHITECTURE. Applied via `npx expo prebuild -p android` + dev-build rebuild. **Verified on emulator:**
Map tab renders Google tiles, clusters and all 100 local listings (was a blank beige square).
- Build gotchas: Gradle needs **JDK 17** (`JAVA_HOME=/opt/homebrew/opt/openjdk@17/...`; Android Studio's
  bundled JDK is 25 and Gradle's auto-download timed out); `expo run:android --device` takes the **AVD
  name** (`Pixel_7_Pro`), not the adb serial.
- Ops: after `mobile/.env` was edited, the running Metro re-read it and inlined its prod
  `EXPO_PUBLIC_API_URL` over the container's `10.0.2.2` → app hit prod. Fixed by recreating Metro
  (`HOST_IP=10.0.2.2 docker compose up -d mobile`). See BUGLOG.
**Docs — legal drafts:** `docs/legal/PRIVACY.md` + `docs/legal/TERMS.md`, written from the app's real data
practices, with `[PLACEHOLDERS]` for owner details; need owner fill-in + legal review before publishing.
Flags that Play Store requires in-app account deletion (not built yet).
**Found — production API is gone:** `https://api-production-43dd.up.railway.app` returns Railway
"Application not found" (`x-railway-fallback: true`) on every path. Needs the owner's Railway account.

### 2026-11-07 (Security: messaging authorization audit + stale-upload sweeper)
**Audit (ROADMAP item):** saved, messages, saved-searches, visits, notifications, push — every read/update
is scoped to `getAuth(req).userId`. Gaps found + fixed in **sending**:
- **Anyone could message/propose to any account** under any listing (`receiver_id` unchecked). New
  `canMessage` (`backend/src/messaging.js`): receiver must be the listing owner, or the owner replying to
  someone who already messaged them about it; else 403 (404 for unknown listing). Applied to
  `POST /messages/:propertyId` and `/:propertyId/proposal` (counter already bound to the original).
- **Impersonation:** `sender_name/avatar/image` were taken from the request body. Now from Clerk
  (`senderIdentity`, 2-min cache, cleared on photo change); never falls back to client values in prod.
  Live-verified: forged "Zamin Support" stored as "@zamintest01".
- **Image messages accepted any URL** (tracking pixels / phishing). `safeImageMeta`: only our processed
  `(/api)/media/properties/<id>(_thumb).jpg` on the API or storage host; app's real format verified 201.
- `messages.js` 500s no longer echo `err.message`.
- Tests no longer call the live Clerk API (`api.test.js` unsets the secret). +6 authz/image tests.
**Added — stale-upload sweeper:** hourly maintenance job (`backend/src/uploadSweep.js`, scheduled in
`worker.js`) removes `pending_uploads` older than 1 h (`STALE_UPLOAD_MS`) and their `_orig` objects. +1 test.
Backend **113/113**. Ripple: client chat sends to owner (from listing) or to the enquirer (from inbox) —
both allowed; visits use `/visits` (owner derived server-side, unaffected).

### 2026-11-07 (Security: upload pipeline hardening — zamin-security review)
Review of the photo route found nothing blocking in it, but one **pre-existing HIGH** next to it:
- **HIGH fixed — `/properties/process` trusted a client `origKey`.** The worker GETs *and deletes* that key,
  so any signed-in user could copy + delete another listing's photo (`{ base: own, origKey: victim.jpg }`).
  Now `base` is regex-validated and `origKey` is derived server-side (`properties.js`). Verified: forged
  request processes the attacker's own upload only; victim image still 200. Test added.
- **Bucket policy:** public-read narrowed from `*` to `*.jpg` (`storage.js`) — raw `_orig` uploads (may carry
  EXIF/GPS) now 403 by URL; processed images/thumbs unaffected (all DB media URLs are .jpg — checked).
- `/users/me/photo`: per-user rate limit (10 / 10 min), format allow-list (jpeg/png/webp/heif; SVG → 400),
  pixel cap 25 MP + `sequentialRead`, size check fails closed, server-side error logging; Clerk call has a
  10 s timeout + encoded id (`users.js`, `clerkUsers.js`). Worker sharp calls capped at 25 MP (`worker.js`).
- 500 responses in `properties.js` no longer echo `err.message` (13 sites) — generic message + console.error.
- Migration seed filter tightened to `LIKE 'seed\_user\_%'`.
- Backend **106/106**; photo + listing uploads re-verified end to end.
- Backlog (ROADMAP): sweep stale `pending_uploads` + their `_orig` objects.

### 2026-11-07 (Fixed: native profile-photo upload ✅ + A–Z QA sweep fixes)
**Fixed — profile photo upload on native (was blocked on @clerk/clerk-expo@2).** New server-side path
instead of the Clerk SDK upload: app uploads via the proven presign flow, then `POST /users/me/photo`
consumes the caller's `pending_uploads` binding, sharp re-encodes to 512² JPEG (strips EXIF/GPS,
rejects non-images, ≤10 MB), forwards to Clerk Backend API `/v1/users/:id/profile_image`, and runs
`reconcileOwner` so `owner_image` updates on their listings. No new deps, no dev-build rebuild.
- `backend/src/routes/users.js` (route), `backend/src/clerkUsers.js` (`setProfileImage`),
  `mobile/src/hooks/useApi.js` (`setProfilePhoto`), `mobile/app/settings.js` (`changePhoto`, all platforms).
- Verified: CLI (200; replay 403; bad base 400; unauth 401; non-image 400; `_orig` deleted; public
  `owner_image` updated) and **on the Android emulator** (picker → crop → presign/PUT/photo all 200 →
  avatar updates; Clerk stores 512×512 JPEG). Tests +3 (backend **105/105**).
- Ripple: every avatar reads Clerk `user.imageUrl` (refreshed by `user.reload()`) or denormalized
  `owner_image` (refreshed by reconcile). Note: `messages.sender_image` on *old* messages is not
  re-synced (pre-existing; new messages carry the current photo).

**Fixed — A–Z QA sweep (zamin-tester, Android, both themes).**
- Status bar icons invisible in light theme → `ThemedStatusBar` follows scheme (`app/_layout.js`).
- Android tab bar: active icon invisible on default periwinkle pill in dark → amber `indicatorColor`
  + ink icon (`src/navigation/NativeTabsLayout.js`).
- Posted prices stored bare ("25 K") → `formatPrice` now emits the app convention "₹25K/mo" /
  "₹85 L" / "₹1.8 Cr" (+ "/mo" for rent); `parsePrice` fixed (`\bK\b` never matched "25K", so editing
  would have reset the unit to L). Review step uses the same formatter (`app/(tabs)/post.js`).
- Post wizard reached "Ready to publish" with empty fields → per-step required check (Title, Price;
  Address) with an alert, mirroring backend `validateProperty`.
- Dead taps: Profile → Help & Support and Settings → About now open a new FAQ screen (`app/help.js`);
  Terms / Privacy / Rate rows removed until real docs + a store listing exist.
- My Listings rows always showed 🏠 → show the uploaded thumbnail (`app/my-listings.js`).
- Light-theme contrast: card price pill text → ink (`PropertyCard.js`); detail price pill → ink on amber;
  amber chips/tags → `C.amberText` (`property/[id].js` Chip, `ui.js` Tag); detail action bar was
  hard-coded navy → theme surface, icons/buttons tokenized inline.
- Icons: Messages uses `chat` (profile + empty state); Change password uses new `lock` icon (`Icon.js`).
- Settings: Sign out moved to the bottom; section labels aligned with cards.
- Map: "Search this area" moved below the Satellite toggle (they collided on phones).
- Edit Listing: title no longer crowds Cancel; bottom padding includes the safe-area inset.
- Auth: "@" username rows render one box (new `bare` prop on `NeoInput`); sign-up label style matches.
- Verified on device: photo upload, help screen, light theme (status bar, detail bar, chips, sign-out
  placement), tab pill, Post validation alert. Bundles compile (android+ios); mobile jest 39/39.
- **Not fixed (needs you):** Android Google Maps key is the placeholder (`app.json`
  `YOUR_ANDROID_GOOGLE_MAPS_KEY`) → map tiles blank / pin picker unusable on Android; needs a real key
  + dev-build rebuild.
- Left as-is (by design): "Add & verify email" CTA (email is an optional verifiable identifier — powers
  trust badge + password reset); forgot-password copy; seed "Online" label.

### 2026-11-07 (Verified: listing image upload E2E on Android ✅ + Fixed: rental price insights "100% below median")
**Verified — listing photo pipeline, end to end on the Pixel_7_Pro emulator (dev build).** Posted a
real listing with a gallery photo through the 4-step Post flow: `POST /properties/presign` → native
`fetch(file://).blob()` PUT to `/zamin/<key>_orig` (nginx → MinIO, SigV4 valid) → `POST /properties/process`
→ BullMQ worker wrote `<base>.jpg` (1024×1024) + `<base>_thumb.jpg` (400×400) and deleted `_orig` →
`POST /properties` 201 → photo renders on the detail screen and appears in public `GET /properties`.
Also confirmed `/process` replay is a no-op (`processed:0`, pending_uploads binding consumed).
Closes ROADMAP on-device item (a). Note: the AWS SDK now adds `x-amz-checksum-crc32=AAAAAA==` (empty-body
CRC) to presigned PUTs — MinIO ignores it; **re-check if we move to real S3/R2** (they may enforce it).
**Ops:** api/worker were presigning for a stale host (`S3_PUBLIC_ENDPOINT=http://192.168.29.228`; Mac
is now `192.168.1.15`) — recreated with `HOST_IP=10.0.2.2` (runtime override, like Metro).

**Fixed — price insights told every Mumbai rental it was "Good deal · 100% below the area median".**
Root cause: base seed row "Luxury Apartment — Sea View" (`backend/db/init.sql`) was `For Rent` with a
sale price `₹1.8 Cr`, duplicated into 23 demo rows → rental median ₹12,414/sqft vs real rents ~₹30/sqft.
- `backend/src/insights.js` — `rentPlausible()`: For Rent rows priced above `MAX_MONTHLY_RENT` (₹25 L/mo)
  are dropped from comparables, and such a listing gets no verdict (users can type anything).
- `backend/db/init.sql` — seed row relabelled `For Sale`.
- `backend/migrations/1730900000000_fix_sale_priced_rentals.js` — relabels existing seed-owned
  (`clerk_user_id LIKE 'seed_%'`) Cr-priced rentals as For Sale; real users' rows untouched.
  Applied locally (23 rows). **Prod (Railway) gets it on next api deploy.**
- `backend/tests/insights.test.js` — 2 regression tests. Backend suite **102/102**.
- Ripple: `GET /properties/:id/insights` is the only server consumer; client `property/[id].js:669`
  already hides `insufficient`; client `pricePerSqft` (card/detail ₹/sqft label) is per-listing, unaffected.

### 2026-11-07 (Ops: emulator API host fix ✅ + native profile-photo upload BLOCKED on @clerk/clerk-expo@2)
**Fixed (Ops) — emulator↔backend connectivity.** The dev build (`com.zamin.app`) couldn't reach the
API from the emulator: `docker-compose.yml:162` sets `EXPO_PUBLIC_API_URL=http://${HOST_IP:-localhost}/api`
and `HOST_IP` resolved to a stale LAN IP (`192.168.29.228`), inlined into the bundle → `socket
connect_error: timeout`, "Couldn't load your listings". Recreated the Metro container with
`HOST_IP=10.0.2.2` (`docker compose up -d mobile`, the canonical Android-emulator→host address) so
`EXPO_PUBLIC_API_URL=http://10.0.2.2/api`. Also **restarted nginx** — it was 502ing because it had
cached a stale upstream IP for `api` (api was restarted earlier for the instrument.js change).
**Verified:** home feed now loads fresh API data (new listings, stats, no error). This is a runtime
override — non-destructive to the repo (reverts on a normal `docker compose up`).

**Investigated (NOT fixed) — native profile-photo upload.** Confirmed broken and characterized it
precisely: `mobile/app/settings.js` `changePhoto` → Clerk `setProfileImage({file})`, which does
`FormData.append("file", file)`. On this stack (`@clerk/clerk-expo@2`, this Expo/RN, Android) EVERY
no-dep path to produce a valid upload fails, each with a captured on-device error:
- `fetch(content://).blob()` (original) → empty **1×1-pixel** JPEG upload (Android picker/crop
  returns a `content://ImagePickerFileProvider/…` URI that `fetch` can't read).
- `{ uri, name, type }` → no crash, but Clerk did **not** persist it (`updated_at` unchanged).
- base64 → `fetch("data:…")` → **"unknown protocol: data"** (RN fetch rejects the data: scheme).
- base64 → `atob` → `new Blob([Uint8Array])` → **"Creating blobs from ArrayBuffer/ArrayBufferView
  are not supported"** (RN Blob can't be built from bytes).
**Conclusion:** this needs the `@clerk/clerk-expo@2 → @clerk/expo@4` migration (ROADMAP.md:59-62,
major, touches all auth hooks) OR bypassing the SDK via `expo-file-system` `uploadAsync` straight to
Clerk's image endpoint — beyond a safe inline change. Left `settings.js` on the non-crashing
`{uri,name,type}` path with a NOTE comment documenting the above. **ROADMAP.md:36-39 stays open.**
Flow (b) (listing image E2E) was not reached — deferred to a follow-up now that the env is reachable.

### 2026-11-03 (fix: double-rupee price + invisible OAuth button text in dark mode)
**Fixed** two display bugs surfaced during Android verification:
- **`₹₹` double rupee.** `property.price` is always a pre-formatted string that already contains
  `₹` (e.g. `"₹2.4 Cr"`), but several screens prepended another `₹`. Switched them to the
  codebase's number-vs-string guard (`typeof p.price === "number" ? \`₹${p.price}\` : p.price`,
  as already used in `map.js`/`property/[id].js`). **Ripple — all prepend sites updated:**
  `mobile/src/components/PropertyCard.js:103`, `mobile/app/(tabs)/discover.js:74`,
  `mobile/app/chat/[id].js:495`, `mobile/app/my-listings.js:63`. `map.js:257` already guarded.
- **Invisible "Google/Facebook" text on the OAuth buttons (dark mode).** `SocialAuth.js` defined
  its button style as a **module-level const** that captured `C.glassBg`/`C.glassBorder` at import
  time — i.e. the *light* defaults (white) before `applyTheme("dark")` runs — while the label used
  the live `C.fg` (near-white in dark mode) → white text on a frozen-white button. Moved the `btn`
  style **inside the component** so it reads live theme tokens; in dark mode the buttons are now
  dark navy with legible white labels. (Same stale-`C`-at-module-eval class the UI review flagged
  for `elevate()`.)
- **Validated:** iOS + Android bundles compile (13.0 / 13.4 MB). Verified on the Pixel_7_Pro
  emulator (dark mode): home-feed card now shows `₹2.4 Cr` (single `₹`); the sign-in OAuth buttons
  render dark with visible white "Google"/"Facebook" text + coloured `G`/`f` glyphs.

### 2026-11-03 (fix: Android grey-plate sweep + harden Sentry instrument.js)
**Fixed** four surfaces that combined `overflow:"hidden"` + shadow/`elevation` on the SAME node
— the Android grey-plate pattern (BUGLOG guardrail "iOS shadow props + `elevation` on the same
node"). Split each into an outer shadow/elevation wrapper (no clip) + an inner `overflow:"hidden"`
clip, matching the `LiquidGlass`/`PropertyCard` pattern:
- `mobile/app/property/[id].js` — `ImageSlider` hero and the emoji-card hero fallback (both kept
  their intentional *coloured* glow `shadowColor: color`, now on the non-clipping outer wrapper).
- `mobile/app/sign-in.js` + `mobile/app/sign-up.js` — the username `@`-prefix row (the clip that
  rounds the prefix panel now lives on an inner view; `elevate(1)` on the outer).
**Changed** `backend/src/instrument.js` — the `require("@sentry/node")` is now wrapped in
`try/catch` so a missing SDK (minimal build / stale node_modules volume) degrades to a no-op
instead of boot-crashing api/worker. Makes the file's "never a hard dependency" comment true.
- **Ripple checked:** grepped all `shadow*`+`elevation`/`overflow:"hidden"` combos across the diff
  — remaining raw shadows (`map.js` overlays, `post.js` filled input, `property/[id].js` CTA bar,
  amber "glow" pills) are either intentional coloured glows or have no `overflow:"hidden"`, so no
  plate risk (left as design-token cleanup). Instrument consumers (`worker.js:48/67`,
  `realtime.js:53`) already wrap `Sentry.*` in `try/catch`, so a null export is safe. NOTE:
  `realtime.js:9` still does an unguarded top-level `require("@sentry/node")` — out of scope here.
- **Validated:** iOS + Android bundles compile (13.0 / 13.4 MB, valid `__BUNDLE_START_TIME__`);
  api + worker restarted clean, `/properties` 200, worker healthy (no `MODULE_NOT_FOUND`).
  **Android on-device verified** on the Pixel_7_Pro emulator (dev build `com.zamin.app`, Android 17):
  sign-in + sign-up username `@`-prefix rows and the property-detail `ImageSlider` hero all render
  as clean rounded surfaces with NO grey plate (the hero keeps its soft coloured glow). The
  emoji-card hero fallback uses the identical split and was not separately screenshotted (needs a
  photo-less listing). Noted pre-existing bug: `PropertyCard` price shows `₹₹` (double rupee) on
  the home feed — the detail screen's badge is correct `₹`.

### 2026-11-03 (fix: zamin_worker crash-loop — @sentry/node MODULE_NOT_FOUND)
**Fixed** `zamin_worker` crash-looping with `Error: Cannot find module '@sentry/node'`.
- `@sentry/node` is in `backend/package.json` and the Dockerfile runs `npm install`, so both
  `api` and `worker` images install it. However the worker container's **anonymous `/app/node_modules`
  volume** was created from a stale image build that predated `@sentry/node` being added; Docker
  Compose reuses existing anonymous volumes across `docker compose up --build`, so the new image
  layers were shadowed by the old volume.
- The `api` container was unaffected because its anonymous volume happened to be current (rebuilt
  around the same time `@sentry/node` was added to `package.json`).
- **Fix:** rebuilt the worker image (`docker compose up -d --build --renew-anon-volumes worker`),
  which forces a fresh anonymous volume populated from the new image's npm install layer.
- No source changes required — `backend/package.json` already declared `"@sentry/node": "^10.74.0"`.
- **Ripple checked:** `backend/src/instrument.js`, `src/realtime.js`, `src/index.js`, `src/app.js`,
  `src/worker.js` all depend on `@sentry/node` — all are in the same `backend/` build context,
  so the fix applies to all. `mobile`, `nginx`, `db`, `redis`, `minio` have no Sentry dependency.

### 2026-10-01 (docs/tooling: engineering "team" of Claude Code sub-agents)
**Added** a role-based sub-agent team so the growing project can be split by discipline:
`.claude/agents/` — `zamin-planner` (architect, read-only), `zamin-coder` (implementer), `zamin-ui`
(design system), `zamin-tester` (QA), `zamin-security` (reviewer); `.claude/commands/feature.md` — a
`/feature` orchestration command (plan → implement → test → security); `docs/TEAM.md` — how the team
works (orchestrator + cold-start specialists; docs are the shared memory) + how to extend it; CLAUDE.md
gains a "The team" pointer. Security + testing are wired into every feature by design.

### 2026-10-01 (feat: native platform tab bar on dev builds, with Expo Go/web JS fallback)
**Added** Expo Router **native tabs** (`expo-router/unstable-native-tabs`, SDK 57) — a real `UITabBar`
on iOS (→ system **Liquid Glass** on iOS 26) and Material `BottomNavigation` on Android.
- `src/navigation/NativeTabsLayout.js` — 5 `NativeTabs.Trigger`s with per-platform icons (`sf` SF
  Symbols on iOS incl. filled "selected" variants; `md` Material Symbols on Android), labels, and an
  amber selected tint. No new deps (SF/Material symbols are built in; `react-native-screens` 4.26 present).
- `app/(tabs)/_layout.js` — native tabs **require a dev build** and don't exist in Expo Go/web, so we
  gate: `USE_NATIVE_TABS = Platform.OS!=="web" && executionEnvironment!=="storeClient"`. In a dev/prod
  build it renders `<NativeTabsLayout/>`; in **Expo Go + web** it falls back to the clean JS `<Tabs>`.
  The native module is **lazy-`require`d** so Expo Go never evaluates it (no crash). To go native-only
  once you ship dev builds, render `<NativeTabsLayout/>` unconditionally.
- Verified: iOS/Android/web bundles compile; Expo Go (both sims) renders the JS fallback with no crash.
  The native tab bar itself can only be seen in a dev build (`npx expo run:ios` / `run:android`).

### 2026-10-01 (change: retire liquid glass app-wide → opaque cards on both platforms + reset tab bar)
Design pivot (verified on iOS Simulator + Android emulator). Two parts:

**Changed — liquid glass retired; all surfaces opaque on iOS *and* Android.** Previously iOS used
frosted glass for cards/sheets (iOS 26 `GlassView` / BlurView faux-glass) while Android was opaque;
now both render clean opaque Material surfaces.
- `src/theme/index.js`: the opaque surface overrides (`glassBg`/`card`/`cardAlt`/`chipBg`/`glass.*`,
  with `highlight:"transparent"`) now apply on **all** platforms (were Android-only). Renamed
  `*_ANDROID` → `*_OPAQUE`.
- `src/components/LiquidGlass.js`: collapsed to a **single opaque implementation** (dropped the
  `GlassView` + BlurView + specular-sheen branches). Keeps the shadow-wrapper / `overflow:hidden`
  clip split + `elevate()`. Legacy glass props (glassStyle/intensity/tint/sheen/androidBlur/…) are
  accepted as no-ops; removed the `NATIVE_GLASS` export. `GlassSurface`/`BottomSheet`/`property/[id]`
  sheets inherit the opaque look unchanged.
- Removed the iOS-only top-edge "sheen" gradients in `PropertyCard.js` and `app/(tabs)/discover.js`
  (and their now-unused `Platform` imports). Left the Apple-sign-in gate in `SocialAuth.js` (not a sheen).

**Changed — custom tab bar stripped to a clean minimal base** (`app/(tabs)/_layout.js`). Removed the
bespoke "liquid water-bubble" `TabBar` (sliding glass droplet, trailing wake, squash/stretch, ripple,
LiquidGlass background, amber Post pill) and all its `Animated` code. Now a plain expo-router `<Tabs>`:
icon + label, opaque bar (`C.card` + hairline top border), amber active tint. This is the base for a
future **native liquid-glass tab bar** on iOS. Android design is otherwise unchanged.

> Note: `expo-glass-effect` / `expo-blur` are no longer used for surfaces (kept in deps for now).

### 2026-09-17 (fix: Android card "grey plate" artifact + Expo Go crash + dead navbar blur)
Tested on the iOS Simulator + Android emulator (both driven off one Metro). Three Android-only issues:

**Fixed — grey rectangular "plate" behind every card on Android.** Cards mixed iOS shadow props
(`shadowColor: C.shadow` = dark navy) **with** `elevation` on the same node; Android ignores the iOS
props for layout but **does tint the elevation shadow** with `shadowColor`, painting a hard navy-grey
rectangle around each white card (looked like a "double card"). Combined with `overflow:"hidden"` on
the same node it got worse (shadow outline can't round).
- **New `elevate(level)` helper** in `src/theme/index.js`: Android → `elevation` only (Material-style);
  iOS/web → the soft layered shadow, tuned per level. One place decides depth cross-platform.
- Rolled out to every neutral card surface: `PropertyCard.js` (also split the shadow wrapper from the
  `overflow:hidden` clip so Android rounds the shadow), `app/(tabs)/map.js` (`glassCard()` + the map
  container split), `app/property/[id].js` (`GlassCard`), `ui.js` (`NeoInput`), `sign-in.js` /
  `sign-up.js` (method selector), `app/(tabs)/post.js` (review card). Intentional **coloured** glows
  (amber buttons, avatars, hero image) were left as-is.
- iOS is pixel-unchanged (verified): `elevate()` returns the same soft shadow there.

**Fixed — app crashed on launch in Expo Go on Android** (redbox `PushManager.js:3`). Merely *importing*
`expo-notifications` throws at module-eval in Expo Go (SDK 53 removed remote push from Expo Go). Guarded
it in `src/components/PushManager.js`: `PUSH_ENABLED` (dev/prod build only, not `storeClient`) + a **lazy
`require`** so the module is never evaluated in Expo Go / web. Push still works in real builds. This also
unblocked reliable Fast Refresh (every reload had been hitting the redbox).

**Fixed — Android nav-bar blur silently did nothing + warned.** `expo-blur`'s `experimentalBlurMethod`
is deprecated in v57 and its `dimezisBlurView` needs a `blurTarget` (else it no-ops + warns). Removed the
prop and made the Android nav bar a crisp near-opaque Material bar in `LiquidGlass.js` (matches our
"Android = clean opaque surfaces" rule).

**Dev-env note:** `watchman` was not installed, so Metro wasn't detecting file edits (served stale
modules → fixes appeared not to work). Installed `watchman`; restart Metro with `expo start -c` after
installing it.

### 2026-09-14 (fix: platform-adaptive UI — Android looked washed out)
**Fixed** the app looked flat/washed-out on Android (screenshots: muddy translucent cards, hard
white boxes behind text, weak nav bar). **Root cause:** `expo-blur`'s `BlurView` **doesn't truly
blur on Android** (no `experimentalBlurMethod`) — it renders a flat translucent tint, so every
liquid-glass surface (cards, list rows, sheets, nav bar) + the white specular sheens came out
muddy. iOS blurs natively, so it only showed on Android.
**Approach (per design decision): iOS/web keep Liquid Glass; Android gets clean opaque
Material-style surfaces + a single genuinely-blurred nav bar.**
- `src/theme/index.js` — on Android, override the "glass" tokens (`glassBg`, `card`, `cardAlt`,
  `chipBg`, `glass.fill`) to **opaque** surfaces and `glass.highlight → transparent` (no sheen).
  One place → fixes PropertyCard, SmallCard, GlassCard, map rows, chips, sheets at once.
- `src/components/LiquidGlass.js` — Android branch: solid opaque surface by default; new
  `androidBlur` prop uses a real `experimentalBlurMethod="dimezisBlurView"` blur (nav bar only).
  iOS 26 `GlassView` / iOS<26·web `BlurView` paths unchanged.
- `app/(tabs)/_layout.js` — nav bar passes `androidBlur`; top sheen gated off on Android.
- `src/components/PropertyCard.js` + `app/(tabs)/discover.js` (SmallCard) — white top-edge sheen
  gated to non-Android (`Platform.OS !== "android"`).
**Validated** android/ios/web bundles compile (0 errors); `npx jest` 39/39 pass.
**Docs** ARCHITECTURE (LiquidGlass platform split) + BUGLOG guardrail.

### 2026-09-14 (fix: native map crash — DECIMAL lat/lng serialized as strings)
**Fixed** Sentry `ZAMIN-MOBILE-9` — a **fatal** Android crash on `/property/[id]`
(`UnexpectedNativeTypeException: Value for longitude cannot be cast from String to double`,
in `MapView.latLngBoundsFromRegion`). **Root cause:** `latitude/longitude` are Postgres
`DECIMAL`, and node-postgres returns `DECIMAL/NUMERIC` as **strings**, so the API emitted
`"18.559"`; `property/[id].js` passed those straight into react-native-maps' `region`/markers,
and the Android bridge can't cast String→double. Web never hit it (maps are web-stubbed) — a
native-only, consumer-perspective bug.
**Fix (backend, `backend/src/db.js`):** `pg.types.setTypeParser(1700, parseFloat)` so `NUMERIC`
(our only such columns are lat/lng) is emitted as a JS number API-wide. This resolves the
**already-installed APK** after the api redeploy — no new app build needed. Deployed to prod
(Railway api `abf7b67`); verified the prod API now returns `latitude` as a float.
**Fix (client, `mobile/app/property/[id].js`):** added a `num()` coercion on all map coords
(LocationDrawer region + markers, parcel map/polygon) as defense-in-depth for future builds.
**Validated:** backend 100/100 tests pass; mobile bundle compiles clean. Sentry issue resolved.

### 2026-09-14 (fix: LocationDrawer ✕ vanishing + hard-to-drag bottom sheets)
**Fixed** `mobile/src/components/BottomSheet.js` — (1) the sheet now exposes an **animated
`close()` via ref** (`forwardRef`/`useImperativeHandle`); the "Nearby & saved" drawer's ✕
(`app/property/[id].js`) calls it so the sheet **slides out** instead of vanishing (it was
calling the parent `onClose` directly, which unmounted before the exit animation). (2) The drag
target was a thin 34px strip with the pill inside it — widened to a **44px full-width strip**
(inset 64px on the right so corner ✕ stays tappable), the visible pill is now a non-interactive
overlay, lowered the drag threshold (dy>2 to engage, close at dy>110 or vy>0.5), and added
`onPanResponderTerminate` to spring back cleanly. Dragging the drawer down to close is smooth now.
**Validated** iOS/web bundles compile (0 errors); `npx jest` 39/39 pass.

### 2026-09-14 (feat: notifications "Read all", navbar water-bubble, drag-to-close sheets)
**Added** `mobile/app/notifications.js` — a **Read all** button in the header (shown only when
`unread > 0`) that marks every notification read at once via the existing
`markNotificationsRead()` (`POST /notifications/read`). Optimistic: clears the bold/amber
styling + the discover bell badge instantly, keeps items in the feed.
**Added** navbar **liquid "water bubble"** indicator (`mobile/app/(tabs)/_layout.js`): a single
glassy droplet that slides between tab centers when you switch tabs, with (a) a softer, larger
blob that **lags behind** it as a water wake, (b) a **squash/stretch** mid-travel like a real
droplet, and (c) a **ripple ring** pulsing out where it lands. Replaces the per-tab fade pills
(Post keeps its persistent amber CTA pill; the bubble is translucent so amber reads through on
Post). All transforms are native-driven (`useNativeDriver: true`); geometry comes from the row's
`onLayout`. Pure core `Animated` — no new deps.
**Added** `mobile/src/components/BottomSheet.js` — reusable Google/Material-style drag-to-close
sheet: slides up on mount, drag the grab-handle down and it **follows your finger** with the
backdrop dimming; release past a distance/velocity threshold dismisses, else springs back.
Core `PanResponder` + `Animated` so it works on web + native (no reanimated). Drag is scoped to
a top grabber so inner ScrollViews/maps still scroll.
**Changed** adopted `BottomSheet` for every bottom sheet: `app/property/[id].js` (VisitBooking,
Review, LocationDrawer — LocationDrawer's `height: "88%"` → `Dimensions * 0.88` since % can't
resolve in the auto-height sheet) and `app/chat/[id].js` (Offer, Visit, overflow menu, report
picker). Removed now-unused `Modal` imports from both files.
**Ripple checked:** swept `<Modal … flex-end>` sheet usages — all 7 bottom sheets migrated;
`post.js`'s centered `animationType="fade"` modal and `ConfirmModal` (centered dialog) are not
drawers, left as-is.
**Validated** iOS/Android/web bundles compile (0 errors); `npx jest` 39/39 pass.
**Docs** `docs/ARCHITECTURE.md` §9 — documented `BottomSheet` + the navbar indicator.

### 2026-09-14 (feat: real iOS-26 Liquid Glass navbar via expo-glass-effect)
**Added** `mobile/src/components/LiquidGlass.js` — one glass primitive that renders Apple's
real Liquid Glass (`expo-glass-effect` `GlassView`, `isLiquidGlassAvailable()`) on iOS 26 and
falls back to the existing BlurView faux-glass (blur + fill + specular sheen) on iOS<26 /
Android / web. Drives `GlassView.colorScheme` from our theme toggle; `isInteractive` on the
navbar so the bar responds to touch like a native iOS tab bar.
**Changed** `mobile/app/(tabs)/_layout.js` — navbar container swapped from raw `BlurView` to
`LiquidGlass` (real glass on device); our hand-drawn top-sheen now renders **only** on the
fallback (`!NATIVE_GLASS`) so we don't double the specular on real glass. Layout/anim/pills
unchanged. `mobile/src/components/GlassSurface.js` — now a thin wrapper over `LiquidGlass`, so
property-detail drawers/modals (the only `GlassSurface` call site, `app/property/[id].js`) get
real glass on iOS 26 with zero call-site changes.
**Ripple checked:** BlurView/GlassSurface/LiquidGlass usages swept — navbar + sheets covered;
`PropertyCard`/`discover` keep cheap `C.glass` rim tokens (no blur) on purpose for list perf.
Follows expo.dev/blog/liquid-glass-app-with-expo-ui (used its RN-native `expo-glass-effect`
path rather than a SwiftUI `Host` rewrite, which would be iOS-only and break Android/web).
**Ops** `expo install expo-glass-effect@57.0.3` (autolinked, no config plugin). Real glass
appears after the next `eas build`/dev-client rebuild; Expo Go can't load the native module.
**Validated** iOS/Android/web bundles compile (0 errors, ~10–13 MB each).
**Docs** `docs/ARCHITECTURE.md` §9 — documented the `LiquidGlass` primitive.

### 2026-09-14 (feat: @username next to owner name + demo listings for real owners)
- **Owner @username disambiguation.** New denormalized `owner_username` column (migration
  `1726300000000_owner_username.js` — new file, not editing the frozen baseline) set on create from the
  owner's Clerk user (server-authoritative) and kept in sync by the reconcile job (`clerkUsers.js`) +
  the demo seed. Shown as **"@username"** next to the owner name on **PropertyCard** + **property
  detail**, so accounts that share a display name (e.g. two "Meera Patil"s) are distinguishable.
- **`scripts/seed-owner-demo.js`:** publishes 3 demo listings each under the real accounts
  **@amrit5377** and **@meera_estates** (direct insert, idempotent via an `owner-demo-seed` tag).
- Geo test now requests `limit=100` so shared-dev-DB pollution can't push a controlled row to page 2.
  100 backend tests pass; bundle compiles.

### 2026-09-14 (diag: /mine proven correct; show signed-in account; quiet socket noise)
- **Verified the My-Listings backend is correct**: signing in as demo_meera via Clerk's real
  frontend sign-in flow and calling `GET /properties/mine` returns her **10 listings**. So an empty
  My-Listings is a **login-state** issue (the client isn't signed in as that owner), not a data/API bug.
- **My-Listings empty state now shows "Signed in as @username"** so the active account is obvious
  (`useUser`) — an empty list almost always means you're on a different account than expected.
- **`realtime.js`:** `io.engine` `connection_error` is now **log-only** (was also Sentry) — "Session ID
  unknown"/transport blips are benign and recur on every deploy; the actionable signal is the client
  `connect_error` + socket-auth failures.

### 2026-09-14 (ux: clear "Your listing" badge + surface My-Listings errors)
- **PropertyCard** now shows a prominent **"★ Your listing"** badge on the hero when the viewer owns
  the property (previously only a subtle "Me" label). **Saved** screen now also passes `isOwn`.
- **My-Listings** surfaces load errors (Alert) instead of silently swallowing them — so an auth/401
  failure is visible (aids diagnosing an empty list).
- Diagnostic note: an empty My-Listings **and** a missing "Your listing" tag together mean the app's
  signed-in user id ≠ the listing's `clerk_user_id` — i.e. the session isn't that owner. Verified the
  seed data is correct (Meera's 8 listings carry her exact Clerk id), so this is a login-state check,
  not a data bug — confirm via the Profile tab.

### 2026-09-14 (fix: web realtime socket — root cause found via Sentry)
- **The web client's realtime gap is fixed at the source.** Sentry captured `socket connect_error:
  websocket error` (web) + `JWT is expired` (api handshake). `SocketContext` now uses
  **`transports: ["polling", "websocket"]`** (the browser's raw WS to Railway's proxy was failing and
  not downgrading; polling connects reliably then upgrades) and passes **`auth` as a function** so a
  fresh Clerk token is sent on every (re)connect (fixes the expired-JWT handshake). Native was
  unaffected — this is why the device worked and web didn't. The 5s chat poll remains as a safety net.
  Bundle compiles. BUGLOG entry + guardrail added.

### 2026-09-14 (auth: Google + Apple + Facebook sign-in via Clerk SSO)
- New **`SocialAuth`** component (`mobile/src/components/SocialAuth.js`) — "Continue with Google /
  Facebook / Apple" buttons using Clerk's `useSSO` + `expo-web-browser`/`expo-auth-session` (deps already
  installed; wrapping 2-per-row layout). On success → `setActive` → discover. Apple is hidden on Android.
  Added to **sign-in** + **sign-up** (credentials/details stages). Bundle compiles.
- **Requires Clerk dashboard setup to work:** enable the Google + Apple SSO connections (Google uses
  Clerk's shared creds in dev; Apple needs Apple Developer credentials), and allowlist the app's redirect
  URL. Until enabled, tapping a provider shows a graceful "not enabled yet" error.

### 2026-09-14 (ops: Sentry error monitoring — mobile + web socket capture)
- Added `@sentry/react-native` + the Expo config plugin (`app.json`). `_layout.js` inits Sentry and
  wraps the root (no-op without `EXPO_PUBLIC_SENTRY_DSN`). **`SocketContext` captures the client socket
  `connect_error`** (message + origin/path/platform) — this, with the backend `connection_error`
  capture, should finally reveal *why* the web client's realtime socket doesn't deliver.
- Sentry project **`zamin-mobile`**; DSN wired into `eas.json` (preview + production) and an opt-in
  docker-compose var for local repro. Bundle compiles; 39 mobile tests pass.

### 2026-09-14 (ops: Sentry error monitoring — backend + socket diagnostics)
- Added `@sentry/node`. `src/instrument.js` inits Sentry (no-op without `SENTRY_DSN`), required before
  `./app` in `index.js` + `worker.js` so express/http/pg auto-instrument. Express 5xx captured via
  `setupExpressErrorHandler`; BullMQ thumbnail + maintenance failures captured.
- **Socket.io handshake failures now logged + sent to Sentry** — `io.engine` `connection_error` +
  socket-auth failures in `realtime.js`. This is aimed squarely at diagnosing the web client's realtime
  gap (whether the web socket fails to connect / authenticate).
- Sentry project **`zamin-api`** (org `aps-6c`); `SENTRY_DSN` set on the Railway api + worker services.
  100 backend tests still pass (Sentry is a no-op in tests). DSNs are client-side identifiers, not secrets.

### 2026-09-14 (design: liquid-glass rollout — nav + cards)
- **Tab bar** (`(tabs)/_layout.js`): added the specular top-edge sheen to the frosted blur bar — the
  signature liquid-glass highlight on the app's most-visible chrome.
- **Cards** (`PropertyCard`, discover `SmallCard`): brighter glass rim (`C.glass.border`) + a subtle
  top-edge specular sheen. Intentionally NOT a full backdrop-blur per card — that would frost the
  photos and cost perf in scroll lists; the sheen+rim give the glass look while keeping images crisp.
- iOS bundle compiles clean. Tune intensity on device; extend to other chrome as desired.

### 2026-09-14 (notifications: unread bell badge + per-notification dismiss)
- **Unread badge on the Home bell** (`discover.js`): shows the unread count, fetched on focus and
  refreshed live on socket `message`. Previously no indicator when new messages arrived.
- **Tap-to-dismiss:** tapping a notification now marks **that one** read and removes it from the feed
  (was: opening the screen bulk-marked everything read). New owner-scoped `POST /notifications/:id/read`
  (`routes/notifications.js`) + `markNotificationRead` client method; `notifications.js` updated.
- +1 backend test (per-item read: owner-scoped + invalid-id 400). **100 backend tests pass.**

### 2026-09-14 (chat: composer UX + realtime poll fallback)
- **Composer, WhatsApp-style** (`mobile/app/chat/[id].js`): input is now **multiline & grows** with the
  text (`maxHeight` 120) so you can see the whole message; **Enter no longer sends** (newline; send only
  via the button — removed `onSubmitEditing`, added `multiline` + `blurOnSubmit={false}`); buttons anchor
  to the bottom as it grows; rounded-rect input.
- **Keyboard dismisses on scroll** — `keyboardDismissMode="on-drag"` on the message list.
- **Realtime poll fallback:** while a thread is open, refetch every 5s so new messages appear even when
  the socket isn't delivering (observed on the **web** client — device receives live, web didn't). Server
  rows are source of truth; not-yet-persisted optimistic sends are preserved. (Root-cause of the web
  socket gap still worth investigating once Sentry is in — this makes delivery reliable meanwhile.)

### 2026-09-13 (design: liquid-glass theme — foundation + detail sheets)
- **Liquid-glass tokens** in `mobile/src/theme/index.js` (`C.glass`: blur intensity/tint, translucent
  fill, rim border, specular top-edge highlight, depth shadow — per light + dark).
- **`GlassSurface` component** (`mobile/src/components/GlassSurface.js`): frosted `expo-blur` layer +
  translucent fill + specular top-edge sheen + soft depth; `topOnly`/`fill`/`radius` props. Reusable
  building block for the iOS-26 "liquid glass" look.
- **Applied to the property-detail sheets/drawers** — LocationDrawer (map), VisitBookingModal,
  ReviewModal are now frosted glass. Deliberately **not** applied to scroll-list cards (many
  simultaneous blurs = perf cost) or the dark contrast-critical bottom action bar yet — those need
  on-device eyeballing. iOS bundle compiles clean. Next: tune intensity/tint on device, then roll out
  to nav/cards.

### 2026-09-13 (ops: prod DB migrated to Neon)
- **Prod Postgres is now Neon** (managed: branching, autoscale, PITR backups) — `DATABASE_URL` on
  `api` + `worker` points at the Neon pooled endpoint (`sslmode=require`). Boot `runMigrations`
  provisioned the schema; demo data re-seeded (118 properties, 12 owners). API verified 200; worker
  reconcile + thumbnail running against Neon. The old Railway `Postgres` service/volume is now unused
  (delete in dashboard). Docs updated (`docs/DEPLOY.md`), incl. the watchPatterns one-off gotcha.

### 2026-09-13 (ops: CodeRabbit config + Neon-ready Postgres)
- **CodeRabbit:** added `.coderabbit.yaml` — automated PR review + secret scanning (gitleaks) with
  security-focused path instructions mirroring `docs/BUGLOG.md` guardrails + `vibe-check/AGENTS.md`.
  Activate by installing the GitHub app (https://github.com/apps/coderabbitai) on the repo.
- **Neon-ready Postgres:** `db.js` now enables TLS when `DATABASE_URL` has `?sslmode=require` (Neon)
  or `PGSSL=true`, and `runMigrations` passes the same SSL to node-pg-migrate — so switching prod to
  managed **Neon** is a `DATABASE_URL` swap + re-seed (schema self-provisions). Local/Railway-internal
  (no SSL) unchanged; 99 backend tests still pass. Migration runbook in `docs/DEPLOY.md`.

### 2026-09-13 (fix: property photos never rendered — expo-image source shape)
- **Property photos showed only the blurhash on web AND mobile.** `SmartImage` (every property photo:
  cards + detail slider) passed a bare string to expo-image's `source`; expo-image needs the object
  form `{ uri }` to render reliably (the avatar images that worked all used `{ uri }`). Data was fine.
  Fixed `source={uri ? { uri } : undefined}` + `placeholder={local ? { uri: local } : BLUR_PLACEHOLDER}`
  (`mobile/src/components/SmartImage.js`). Reload the app/web to see photos. BUGLOG guardrail added.

### 2026-09-13 (polish: screen-transition motion + more test coverage)
- **Tactile card motion:** new `PressableScale` (`mobile/src/components/PressableScale.js`) — a subtle
  spring scale-down on press — now wraps `PropertyCard` and discover's `SmallCard`, so tapping a
  property gives immediate feedback right before the detail screen slides in.
- **Smoother navigation:** the root Stack adds `animationDuration: 280` + `gestureEnabled: true`
  (swipe from the left edge to go back) on top of the existing `slide_from_right` push.
- **More automated tests:** +9 mobile unit tests — `timeAgo` (`time.js`) and `imageCache`
  (`rememberLocal`/`getLocalForRemote`). Mobile suite now 39 tests / 5 files; backend 99.
- Validated: iOS bundle compiles clean (0 error markers).

### 2026-09-12 (fix: profile photo/name not propagated to listings — lower-traffic pass cont.)
- **Changing your profile photo or display name didn't update your listings for other viewers.**
  `owner_image`/`owner_name` are denormalized onto property rows; only the email-verify flow called
  `reconcileMe()`, so photo/name changes stayed stale until the 6h reconcile sweep. `changePhoto` +
  `saveProfile` (`mobile/app/settings.js`) now call `api.reconcileMe()` (best-effort) on success.
- Reviewed clean this pass: saved/favorites, blocks/reporting/reviews backend, map clustering util.

### 2026-09-12 (fix: discover search fired a request per keystroke — lower-traffic pass)
- **Search reloaded the list on every character.** `onChangeText={setSearch}` updated `search`, a dep
  of `load`, and `useFocusEffect(useCallback(() => load(), [load]))` re-fires when its callback changes
  while focused — so typing a query fired a network request + reset the list per keystroke (flicker,
  wasted calls), despite `onSubmitEditing` implying search applies on submit. Pinned `search` in a ref
  and dropped it from `load`/`loadMore` deps (`mobile/app/(tabs)/discover.js`); search now applies on
  submit, filter chips (type/status/geo) still reload. Bundle compiles. BUGLOG guardrail added.

### 2026-09-12 (fix: chat proposal counter race + silent accept/decline — visits/offers pass)
- **Counter race:** the proposal counter flow checked "pending" in a `SELECT` then flipped the status
  with an unguarded `UPDATE`, so a concurrent accept/decline (or double-counter) could clobber the
  outcome. Now a single guarded UPDATE (`receiver + still-pending`, aborts 409 on loss); value is
  validated before the flip. `backend/src/routes/messages.js`.
- **Silent accept/decline:** responding to a chat offer/visit proposal only emitted a socket event —
  no push / in-app notification — so a proposer with the app closed never learned the outcome
  (create/counter/first-class-visits already notify). Added a push + feed notification to the proposer.
- Added 4 proposal tests (were untested); reviewed first-class `/visits` + Visits screen (solid).
  **99 backend tests pass.** BUGLOG: new "atomic status transition" guardrail.

### 2026-09-12 (ops: scope Railway rebuilds; RN-web layout sweep clean)
- **Ops:** set `watchPatterns` on the Railway services (`api`/`worker` → `backend/**`, `minio` →
  `deploy/minio/**`) so a push only rebuilds what changed — mobile-only pushes no longer trigger
  backend rebuilds. Documented in `docs/DEPLOY.md` (incl. the `redeploy`-reuses-config gotcha).
- **RN-web layout sweep — clean (no changes).** Audited every horizontal `ScrollView`: card/photo
  rows have fixed-height children (150px cards, 92×92 tiles), chip rows get height from text+padding,
  and the one genuinely at-risk spot (`chat/[id]` quick-replies) is already wrapped in a fixed-height
  row. Chat composer keyboard handling (`KeyboardAvoidingView`) is fine. Guardrails already followed.

### 2026-09-12 (fix: AuthGuard only protected the tab group — auth pass)
- **Signed-out users could reach authenticated non-tab screens** (`chat`, `messages`, `my-listings`,
  `settings`, `visits`, `notifications`, `saved-searches`, `property/edit`) via push deep-links, web
  URLs, or an expired session — landing on a broken/empty screen instead of sign-in. `AuthGuard`
  (`mobile/app/_layout.js`) now guards a `PROTECTED_SEGMENTS` set (+ a `property/edit` special-case so
  the public `/property/[id]` view stays open). Reviewed sign-in / sign-up / forgot-password — solid,
  incl. the enforced email-code 2FA branch. Bundle compiles.

### 2026-09-12 (fix: realtime chat was dead in prod + no reconnect resync — chat pass)
- **Realtime was completely broken in prod.** `SocketContext` hardcoded the socket path to
  `/api/socket.io` (the dev nginx path); prod has no nginx and the API serves Socket.io at
  `/socket.io`, so the handshake 404'd and the socket never connected — live messages, typing, and
  read receipts silently didn't work (REST send/fetch still did). Extracted `socketConfig(base)`
  (`mobile/src/utils/net.js`) that derives the path from whether BASE has an `/api` prefix (dev →
  `/api/socket.io`, prod → `/socket.io`); `SocketContext` uses it. +3 unit tests.
- **Missed messages on reconnect.** Socket.io doesn't redeliver events emitted while a client is
  offline, so a network blip dropped messages until the thread was reopened. `chat/[id]` now refetches
  the thread + re-marks read on every socket `connect`/reconnect.
- 30 mobile tests pass; bundle compiles. BUGLOG updated (dev-vs-prod path guardrail now hit ×2).

### 2026-09-12 (fix: edited listings got full-res thumbnails in prod — upload-flow pass)
- **Editing a listing in prod replaced existing thumbnails with the full-res image URL.** The
  thumbnail for a hosted image was derived only when the URL contained `/media/` (dev); prod URLs are
  absolute MinIO URLs (`…/zamin/properties/<id>.jpg`) with no `/media/`, so it fell back to the full
  image — a silent bandwidth/perf regression on every edit. Extracted `thumbFor()`
  (`mobile/src/utils/property.js`) keyed on the stable `…/properties/<id>.jpg` pattern (dev + prod);
  used in `post.js`. +4 unit tests (27 mobile total). BUGLOG entry + guardrail.
- **Upload flow otherwise verified:** prod public-read policy applied (anon GET missing → 404, list →
  403); queue already retries (`attempts: 3` + backoff); `/process` binds each upload to its
  presigning user. Presigned-PUT SigV4 through Railway's proxy left to confirm on-device.

### 2026-09-12 (fix: dead back buttons on deep-link / push / web-reload targets)
- **Back buttons could be no-ops** on screens opened with no history — `property/[id]` (push
  notifications deep-link straight to it), `messages`, `my-listings`, `settings` all used bare
  `router.back()`. Now `router.canGoBack() ? router.back() : router.replace(<tab>)` (fallbacks:
  discover for property/messages, profile for my-listings/settings), matching the pattern already in
  `chat/[id].js`. Found via a guardrail sweep. Bundle compiles; BUGLOG count bumped.

### 2026-09-12 (fix: geo/near-me leaked proximity of `hidden` listings + green test suites)
- **Privacy fix:** `hidden` listings no longer appear in proximity/near-me results for non-owners.
  They kept real coords in the DB, so they passed the geo `WHERE` and only had `distance_km`
  *redacted* after the query — but their presence leaked "within `radius`" of the search point.
  Now excluded in SQL unless the viewer owns them (`backend/src/routes/properties.js`; `getAuth`
  resolved up-front). Non-geo browse still lists them (without a pin). Ripple: mobile near-me/map
  "search this area" simply stops returning hidden listings (which had no pin anyway) — no client
  change. BUGLOG entry + guardrail added.
- **Tests green again (95 backend, 23 mobile).** The geo ordering test was asserting strict
  monotonicity on *displayed* distances, which isn't guaranteed once `approximate` listings coarsen
  their distance to 0.5 km buckets — rewrote it to assert ordering on two exact rows it controls, and
  added a regression test for the hidden-exclusion. Mobile suite was a stale-container-volume miss of
  `@react-native/jest-preset` (already declared in `package.json`; a fresh `npm ci` has it).

### 2026-09-12 (docs: production Clerk plan — Phase 2)
- **`docs/CLERK_PROD.md` (new):** turnkey production-Clerk setup, tuned to the decisions made
  (username + password only, **no Google** — confirmed the app has no Google sign-in button, so
  dropping it is invisible) and mirroring the live dev config (username required/first-factor,
  password required @ zxcvbn 2 + HIBP on, email/phone off). **Blocked on acquiring a domain**
  (Clerk prod requires a custom domain + DNS). Includes the exact wiring steps to run once live
  keys exist (Railway keys, `eas.json`, re-seed owners — users don't migrate dev→prod).

### 2026-09-12 (ops: point mobile app at prod API)
- **`mobile/eas.json`:** added `env` (`EXPO_PUBLIC_API_URL` = the Railway API,
  `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`) to the **preview** + **production** build profiles, so those
  builds talk to prod. Local dev is unchanged (still reads the env from docker-compose). Works for
  both REST (`useApi.js`) and realtime (`SocketContext.js` — it strips a trailing `/api`, so the
  bare-root prod URL is fine). Prod DB already seeded (124 listings, 12 loginable owners). Publishable
  key is safe to commit (client-side, test-mode); swap both profiles when prod Clerk lands.

### 2026-09-12 (ops: Phase 1 cloud deploy — backend live on Railway)
- **The backend is deployed to Railway** (project `zamin-prod`): `api` + `worker` (from the
  GitHub repo, root `backend/`), managed `Postgres` + `Redis` (with volumes), and `minio`
  object storage. All five services healthy. Public API:
  `https://api-production-43dd.up.railway.app` (`GET /properties` 200, `/saved` 401). Full map +
  runbook in **`docs/DEPLOY.md`**.
- **`src/runMigrations.js`: apply `db/init.sql` before the migration baseline.** Managed Postgres
  doesn't run `init.sql` via `docker-entrypoint-initdb.d`, so base tables were missing and the
  ALTER-only baseline failed (`relation "properties" does not exist`). init.sql is idempotent →
  no-op on existing DBs, self-provisions fresh managed ones. Also fixes the fresh-test-DB path.
- **`deploy/minio/Dockerfile` (new):** builds MinIO with its server command baked in exec-form.
  The official image's shell-less base can't run Railway's shell-wrapped start command, and
  `bitnami/minio` no longer pulls (Bitnami 2025 Docker Hub changes). MinIO is deployed from this.
- Ripple: image URLs need no change — `S3_PUBLIC_BASE` is set absolute, and the client already
  passes through `http…` URLs (`useApi.js`). Dev docker-compose path is unaffected (init.sql still
  runs via the DB init mount; re-applying it in runMigrations is a no-op).
- Follow-ups tracked in `docs/DEPLOY.md`: prod Clerk keys, lock CORS, custom domains, Node 22.

### 2026-09-12 (UX: property navigation + in-listing location drawer)
- **Tapping a property now slides in from the right** (stack push with the existing top-left back
  button) instead of popping up as a bottom-sheet modal. Changed `app/_layout.js` — the
  `property/[id]` screen dropped `presentation: "modal" / slide_from_bottom` for `slide_from_right`.
  Affects every entry point that opens a listing (discover featured + list, saved, my-listings, and
  the map), so the behaviour is now consistent app-wide.
- **Map tab: removed the tap→action-sheet drawer.** In `app/(tabs)/map.js`, tapping a pin *or* a list
  card now goes straight to the sliding detail screen (`openDetails`). Removed the action-sheet Modal
  and its now-dead helpers (`sheet`/`selected` state, `locateOnMap`, `getDirections`, `onPinTap`,
  `scrollToCard` + the `cardY`/`listTop`/`scrollRef` list↔map-sync refs) and the unused
  `Modal`/`Linking` imports. "Get directions" still lives on the detail screen's Location card.
- **Detail screen: tapping the location opens an in-app map drawer** (`LocationDrawer` in
  `app/property/[id].js`) instead of jumping to the Map tab. The drawer shows THIS property (amber
  anchor pin) + **nearby listings** (`getProperties` lat/lng, radius 15km) + the viewer's **saved/
  favourite** properties (`getSaved`), merged/deduped. Tapping any pin or row **pans the map to it
  live** (`animateToRegion`); on web (map stubbed) it opens external Maps. Replaced `openInMaps`
  (map-tab deep-link) with `openLocation` (opens the drawer); kept the hidden-location + sign-in guards.
- Validated: iOS bundle compiles clean (9.3 MB, 0 error markers).

### 2026-09-06 (infra: migration tooling — node-pg-migrate)
- **Replaced the hand-rolled boot-time `migrate()` runner with node-pg-migrate** (versioned, ordered,
  each migration runs once, tracked in `pgmigrations`). Boot + tests now call `runMigrations()`
  (`src/runMigrations.js`); `npm run migrate[:up|:down]` scripts added.
  - **Baseline migration** (`migrations/1725600000000_baseline.js`) *reuses* `src/migrate.js`'s exact
    idempotent SQL via `pgm.db` — zero transcription risk; applying it on an already-migrated DB is a
    safe no-op. Future schema changes go in NEW migration files, not by editing `migrate.js`.
  - Validated: boot applies + records the baseline; **fresh-DB path** (init.sql → migrations) builds
    the full schema (all columns + tables verified); 94/94 backend tests; re-run is a no-op.

### 2026-09-06 (infra: Socket.io Redis adapter — multi-instance realtime)
- **Added `@socket.io/redis-adapter`** (+ `ioredis`) in `realtime.js`: Socket.io events now fan out
  through Redis pub/sub, so `io.to(userId)` reaches a user connected to **any** API instance (chat,
  typing, read receipts, live proposal/visit updates work behind a load balancer). Best-effort —
  falls back to the in-memory adapter if Redis is down. Uses the existing Redis (BullMQ) via
  `REDIS_HOST`/`REDIS_PORT`.
- Validated: API boots with "Socket.io Redis adapter attached", 94/94 backend tests, `npm audit` clean.

### 2026-09-06 (feature: pagination on GET /properties; fix review-modal crash)
- **Fixed:** review modal crashed with *"Can't find variable: TextInput"* — `TextInput` was used in
  `property/[id].js` but not imported. Audited all mobile screens for the same class (missing
  JSX/RN-object/hook imports, invalid theme keys, conditional hooks) — no other instances.
- **Added — pagination** on `GET /properties` (server-side **search** already existed). Query now
  takes `limit` (1–100, default 24) + `offset`; response is a **wrapper**
  `{ items, total, limit, offset, hasMore }` (was a bare array). COUNT + LIMIT/OFFSET applied to both
  the plain and geo (distance) queries.
  - **Ripple (response shape changed):** `useApi.getProperties` now returns the wrapper; updated all
    consumers — `discover.js` (accumulating **"Load more"** using `offset`/`hasMore`), `map.js`
    (initial load + "search this area" now request `limit: 100` and read `.items`).
  - Validated: 94/94 backend tests (new: paging through a filtered set with `total`/`hasMore`,
    server-side search filter, `limit` clamp to 100); iOS + web bundles compile (0 errors).

### 2026-09-06 (feature: Land parcel boundary — finishes Maps Phase 3)
- **Added:** owners can draw a **plot/parcel boundary** for **Land** listings, and it renders on a
  **map on the property detail screen** (the detail screen had no map before).
  - Backend: `parcel JSONB` column (`migrate.js`) — `[{lat,lng},…]` polygon; accepted on create/update
    (validated: array of `{lat,lng}`, ≥3 pts or `[]` to clear, ≤60). **Privacy-aware**: the outline
    reveals the exact plot, so `redactLocation` **nulls `parcel` for non-owners unless
    `location_visibility='exact'`** (owner always sees own).
  - Client: Post/Edit (Land only) gets a **ParcelDrawer** — tap the map to drop corners, drag to
    adjust, Undo/Clear (`post.js`, `react-native-maps` `Polygon`). Property detail shows a **Plot
    boundary** map (`Polygon`) with a **satellite/standard toggle** (`property/[id].js`).
  - Validated: 92/92 backend tests (parcel stored; visible when exact; **redacted for non-owners when
    approximate/hidden**; 400 on <3 points); iOS + web bundles compile (0 errors). Map needs a device.

### 2026-09-05 (feature: reviews + listing reporting/moderation)
- **Owner reviews** — rate an owner 1–5 ★ + optional text, **gated to a confirmed visit** (anti-spam),
  one per (owner, reviewer), upsert on repeat.
  - Backend: `reviews` table (`migrate.js`); `GET /users/:id/reviews` (average, count, `canReview`,
    `myReview`, recent reviews — reviewer clerk ids not leaked) + `POST /users/:id/reviews`
    (403 unless the caller has a `confirmed` visit with the owner; 400 on self-review) in `routes/users.js`.
  - Client: `useApi.getReviews`/`postReview`; property detail shows an **Owner reviews** card (★ avg,
    recent reviews, "Leave/Edit review" when eligible) + a rating modal, and a rating chip in the owner card.
- **Listing reporting + auto-hide moderation** — `POST /properties/:id/report` (dedup per reporter);
  a listing **auto-hides after 3 distinct reporters** (`flagged` column, excluded from public lists,
  like `owner_active`). Admin: `GET /properties/moderation` (queue with reporter counts + reasons) +
  `POST /properties/:id/moderate {action:"hide"|"restore"}`. Client: "⚠ Report this listing" on detail.
- Validated: 89/89 backend tests (reviews gate + upsert + no-id-leak; report dedup + auto-hide + own-listing 400);
  iOS + web bundles compile (0 errors).

### 2026-09-05 (feature: price insights — "good deal" vs area median)
- **Added:** price context on listings. `GET /properties/:id/insights` computes the listing's
  **₹/sqft** and compares it to the **median ₹/sqft of comparable listings** (same `type` + `status`,
  same locality — falls back to city if the locality sample is thin), returning a verdict:
  **good_deal** (≤ 90% of median) / **at_market** / **above_market** (≥ 110%) / **insufficient**
  (< 3 comparables), plus `deltaPct` and `sampleSize`.
  - `backend/src/insights.js`: price/area parsing (mirrors `mobile/src/utils/property.js` — Cr/L/K,
    sq ft/acres/etc.) + median-based verdict. Route in `properties.js` (public, no coords exposed).
  - `mobile`: `useApi.getInsights`; property detail shows a **Price insights** card
    (verdict chip + "X% below/above the area median · ₹/sqft here vs area median · from N similar").
  - Validated: 86/86 backend tests (6 unit parsing/verdict + 2 integration: good-deal vs comps,
    insufficient + 400 on bad id); iOS + web bundles compile (0 errors).

### 2026-09-05 (security: implement audit action items)
- **Ran the `vibe-check` audit** (findings in `security/AUDIT_SUMMARY.md`) and fixed the action items:
- **Deployment hardening** (`docker-compose.yml`): bound Postgres `5432`, MinIO `9000`/`9001`, and
  API `4000` to **`127.0.0.1`** (verified closed on the LAN IP; nginx `:80` + Metro `:8081` stay
  LAN-exposed for the phone). Parameterized DB/MinIO creds + `NODE_ENV` as `${VAR:-default}` so prod
  overrides via `.env`; DB healthcheck now reads container env.
- **Dependencies → 0 vulnerabilities:** `sharp` 0.33.5 → **0.35.4** (libvips CVEs); `qs` pinned via
  `overrides` `^6.16.0` (clears transitive `qs`/`body-parser` moderates, no express-5 bump).
- **Build fix:** added **`backend/.dockerignore`** — the image build was `COPY . .`-ing a stale host
  `node_modules` over the fresh `npm install` (why the sharp bump kept reverting to 0.33.5).
- **File uploads:** nginx `client_max_body_size` 50M → **16M** (server-side cap on presigned PUTs).
- Verified: API 200 via nginx, object-storage proxy alive, `npm audit` clean, 75/75 backend tests,
  sharp 0.35.4 in the running container. Data-store ports confirmed closed on the LAN IP.

### 2026-09-05 (chore: add vibe-check security toolkit)
- **Added `vibe-check/`** (from github.com/benavlabs/vibe-check) — a security checklist for
  AI/"vibe"-coded apps, in three layers: `AGENTS.md` (rules the AI follows while coding),
  `AI-CHECKLIST.MD` (automated whole-project audit prompt), `manual-checklist.md` (manual tests).
  Cloned into the repo root (nested `.git` removed so it's tracked here).
- **`CLAUDE.md`**: added a pointer under "Read these first" to `vibe-check/AGENTS.md` so the agent
  applies these security rules (the existing working guide is kept; not overwritten).

### 2026-09-05 (feature: Maps Phase 3 cont. — directions, satellite, list↔map sync, what's nearby)
- **Get directions** — a "Get directions" action in the map pin sheet (`map.js`) and on the property
  detail's Location card (`property/[id].js`); opens turn-by-turn to the pin in the device Maps app.
- **Satellite / standard toggle** on the Map tab (`mapType`) — handy for Land/plots.
- **List ↔ map sync** — tapping a map pin now highlights *and* scrolls to that listing's card in the
  list (page ScrollView ref + captured card offsets); the sheet's "Locate on map" covers card→pin.
- **"What's nearby"** on property detail — schools, hospitals, transit, shops, banks, food within
  ~1.2km via the free **OpenStreetMap Overpass** API (best-effort, 12s timeout, silent on failure);
  shown only for signed-in viewers on non-hidden listings, closest-first with distances.
- Validated: iOS + web bundles compile (0 errors). Map interactions need a device.

### 2026-09-05 (feature: Maps Phase 3 — price pins, "search this area", reverse-geocode)
- **Price-bubble markers** (`mobile/app/(tabs)/map.js`): single-listing pins now render the price
  (e.g. `₹85 L`) in a bubble instead of a generic marker — far more scannable (Zillow/Airbnb style).
  Approximate listings still draw their area circle behind the bubble; clusters still show the count.
- **"Search this area"**: a floating button on the map re-queries listings around the current map
  center (radius ≈ half the visible span) via the existing geo search, updating the pins + list.
- **Reverse-geocode the pin → address** (`post.js` `PinPicker`): tapping/dragging the map pin or
  using current location now reverse-geocodes (`Location.reverseGeocodeAsync`) and auto-fills the
  Address field **when it's empty** (never clobbers what the owner typed).
- Validated: iOS + web bundles compile (0 errors). Map interactions need a device.

### 2026-09-05 (feature: set the map pin for remote listings — Maps Phase 3, part 1)
- **Added:** remote owners (not posting on-site) can now set a listing's exact **map pin**, so it
  appears on the map and buyers can locate/navigate to it. Previously only on-site photo capture
  auto-pinned; a typed address set no coordinates, so the listing never showed on the map.
  - `mobile/app/(tabs)/post.js`: new **`PinPicker`** in the Location step — three ways to set the pin:
    **Find address** (`Location.geocodeAsync` on the typed address), **Use my location**
    (`getCurrentPositionAsync`), and **tap/drag** a draggable marker on a mini map (device only; web
    shows a notice). Shows the resolved coords + a clear "no pin → won't appear on the map" hint.
    `latitude`/`longitude` added to the form, edit-load, and create/update payloads.
  - `backend/src/routes/properties.js`: **PUT now accepts a pin update** (`latitude`/`longitude`) —
    a manually-set pin wins, else the stored one is kept; `computePhotoTrust` re-evaluates on-site
    against the chosen pin. (Create already accepted coords.)
  - Validated: 75/75 API tests (new: create stores the owner pin, PUT moves it, non-owner sees it);
    iOS + web bundles compile (0 errors). Map picker drag/tap needs a device.

### 2026-09-04 (fix: tapping the location in property detail now shows it on the map)
- **Fixed:** the "Tap to view on map" row on the property detail screen was a plain `View` with
  no handler — tapping did nothing. Now a `Pressable` (`property/[id].js`): on **device** it jumps
  to the in-app **Map tab** and centers/zooms onto the pin (deep-link params `lat`/`lng`/`focus`/`t`
  read by `map.js`, which animates via `mapRef`; a `t` nonce re-focuses on repeat taps). On **web**
  (map is stubbed) it opens **Google Maps**. Uses the listing's coordinates when shared
  (exact/approximate), else a locality text search; disabled for `hidden` listings. Chevron
  affordance added. Validated: iOS + web bundles compile (0 errors).

### 2026-09-04 (UX: map pin action sheet + posting-patience overlay)
- **Added — property action sheet** (`mobile/app/(tabs)/map.js`): tapping a property — either a
  **map pin** or a **card in the list** below the map — no longer navigates immediately. It opens a
  bottom sheet with two choices: **"View more details"** (→ property screen) and **"Locate on map"**
  (centers + zooms the map onto the pin; hidden only when the listing has no shown coordinates).
  Gives the user control instead of a forced navigation. (Cluster bubbles still zoom-to-split.)
- **Added — posting-patience overlay** (`mobile/app/(tabs)/post.js`): while a listing is being
  posted/edited (photo upload + processing can take several seconds), a full-screen blocking
  Modal shows a spinner + "Posting… please stay on this screen; no need to tap again." It swallows
  all touches so impatient re-taps do nothing, and `save()` early-returns if already in flight.
  Message adapts when photos are uploading vs. not.
  - Validated: iOS bundle compiles (0 errors).

### 2026-09-04 (change: usernames are permanent — remove edit from Settings)
- **Changed:** usernames can no longer be changed after signup. In Settings → Edit profile the
  editable username field is replaced with a **read-only, locked** display ("@handle 🔒 — permanent");
  `saveProfile` now only updates first/last name (dropped `username` from `user.update`). First/last
  name and all other profile fields (photo, email, password) remain editable.
  - `mobile/app/settings.js`: removed the username `TextInput` + `username`/`setUsername` state +
    its `startEdit` seed; kept the username shown read-only.
  - Ripple checked: the only other `username` writes are **signup** (sets it) and **sign-in**
    (enters it to log in) — both intentionally kept. Settings was the sole change path.
  - Validated: iOS bundle compiles (0 errors).

### 2026-09-04 (chore: upgrade Expo SDK 54 → 57, so current Expo Go can run the app)
- **Changed:** upgraded to **Expo SDK 57** (RN 0.81→**0.86.3**, React 19.1→**19.2.3**,
  expo-router 6→57, react-native-maps 1.20→1.27, all `expo-*` → ~57). Reason: iOS Expo Go only
  supports the latest SDK (57); the project was on 54, so the app couldn't open on-device without
  Xcode/EAS. Now it loads in Expo Go over the tunnel — no Xcode, no paid Apple account.
  - `mobile/package.json` + lockfile via `expo install --fix`.
  - `mobile/app.json`: moved the deprecated top-level `splash` into the `expo-splash-screen`
    plugin config (SDK 57 schema).
  - Tests: jest-expo 57 split out the RN preset → added `@react-native/jest-preset@0.86.3`
    (+ bumped `react-test-renderer` to 19.2) so `npm test` runs.
  - Ops: rebuilt the mobile image so the baked `node_modules` matches SDK 57 (the compose
    anonymous `node_modules` volume must be dropped — `docker compose rm -sfv mobile` — for a
    recreate to pick up new deps; a plain `--force-recreate` reuses the stale volume).
  - `mobile/eas.json`: dev-build profiles (kept for the future device/EAS path).
  - **Validated:** manifest `sdkVersion: 57.0.0`; iOS bundle compiles (0 errors); `expo-doctor`
    21/21; mobile tests 23/23. Backend untouched.
- **Added:** in-app **on-site photo capture** with live GPS → a server-authoritative
  **"Verified on-site" badge**. Owners tap "On-site photo" in Post/Edit; the app opens the
  camera and records the GPS fix at shutter time. A camera photo within ~150m of the listing
  pin counts as on-site; ≥1 on-site photo earns the badge. Fights fake listings (which reuse
  stock/downloaded images).
  - Backend: `photoTrust.js` `computePhotoTrust({existing,incoming,images,lat,lng})` — merges
    existing + newly-captured per-photo geo, scopes to photos still on the listing, computes
    per-photo `on_site` (Haversine ≤150m, **camera source only**), and **auto-pins** the listing
    from the first on-site capture when it has no coords (so app-made listings finally get a pin).
    `on_site` is never trusted from the client. Columns `photo_geo JSONB` + `on_site_verified`
    (`migrate.js`); wired into POST + PUT.
  - **Privacy:** capture coordinates are sensitive → `locationPrivacy.sanitizePhotoGeo` strips
    `photo_geo` to `[{url,on_site}]` for non-owners (owner sees full). Verified by test.
  - Client: `post.js` "On-site photo" button (`expo-image-picker` camera + `expo-location`),
    per-photo "📍 On-site" chip in the composer, capture geo threaded through the presigned
    upload (re-keyed local uri → hosted url) into `photo_geo`; edit seeds geo from the server.
    Property detail shows a **"📍 On-site verified"** chip (`property/[id].js`).
  - **Validated:** 74/74 API tests (6 `photoTrust` unit + 2 integration: badge + auto-pin,
    capture coords hidden from non-owners, client can't fake `on_site`, gallery ≠ verified).
    iOS bundle 0 errors. **Camera + GPS need a device/dev build to exercise the capture UI.**

### 2026-09-04 (feature: location privacy — Phase 1 of maps)
- **Added:** owner-controlled **location privacy**, server-enforced. Each listing has a
  `location_visibility` (`exact` | `approximate` | `hidden`); non-owners never receive true
  coordinates unless `exact`. Closes a real leak — `GET /properties` is public and previously
  emitted exact lat/lng to everyone (the client "sign in to view" was cosmetic).
  - Backend: `locationPrivacy.js` `redactLocation(row, viewerId)` — `approximate` returns a
    **deterministic ~400m jitter** (seeded by property id, stable across requests; true coords
    never sent) + `location_precision`/`location_radius_m`; `hidden` nulls lat/lng **and**
    `distance_km` (no proximity leak); owner always sees own exact. Applied in `GET /properties`
    (list + geo) and `GET /properties/:id`. Column added in `migrate.js`; enum validated.
  - Global default: `PUT /properties/location-visibility` bulk-updates all the owner's listings
    and stores the default in Clerk `publicMetadata` (`setLocationDefault`, backend-only so it
    can't be spoofed); new listings inherit it unless they override per-listing.
  - Client: Post/Edit gains a per-listing privacy selector (`post.js`); Settings → Privacy has a
    global default selector (`settings.js`); Map draws a **circle** (not a pin) for `approximate`
    and omits `hidden` listings (`map.js`, via `Circle`); property detail shows an honest
    precision subtitle (`property/[id].js`); `useApi.setLocationVisibility`.
  - Ripple checked: list, detail, geo "near me" (distance coarsened/omitted), map clustering
    (`withCoords` already drops null-coord/hidden rows), create + edit, owner-self view.
  - **Validated:** 66/66 API tests (incl. 6 unit + 4 consumer-perspective integration tests:
    approximate jitter within radius & deterministic, hidden nulls coords in both `/:id` and the
    public list, owner-sees-exact, bulk update, 400 on bad enum). iOS bundle 0 errors.

### 2026-09-04 (fix: handle email-code 2FA at sign-in)
- **Fixed:** username+password sign-in now handles `needs_second_factor`. On this Clerk instance,
  enabling email as a verifiable identifier (required for add/verify-email + `reset_password_email_code`)
  also forces an **email verification code as a second factor** for any account with a verified email —
  and there is **no dashboard toggle** to separate the two (Multi-factor has no email option; turning
  off "Sign in with email address" disables the email identifier entirely, breaking verify + reset;
  `sign_in.second_factor.required=false` is reported but the step is enforced regardless). Previously
  `sign-in.js` only handled `status==="complete"`, so verified-email users hit a dead-end error and
  couldn't log in.
  - `mobile/app/sign-in.js`: after `attemptFirstFactor(password)`, on `needs_second_factor` we find the
    `email_code` factor, `prepareSecondFactor({ strategy:"email_code", emailAddressId })`, and show a new
    **emailMfa** stage (code input + resend cooldown + back). `submitEmailMfa` calls
    `attemptSecondFactor({ strategy:"email_code", code })` → `setActive`. Verified against the SDK types
    (`EmailCodeSecondFactorConfig = { strategy, emailAddressId? }`, `EmailCodeAttempt = { strategy, code }`).
  - **UX note:** username-only accounts still log in with no code; only users who *chose* to verify an
    email get the login code (which doubles as real 2FA — an acceptable, coherent tradeoff).
  - **Validated (E2E vs live Clerk Frontend API, testing-token):** full flow PASS —
    signup(username) → add&verify email(424242) → password reset → **login: password → needs_second_factor
    → prepareSecondFactor(email_code) → attemptSecondFactor(424242) → complete**. iOS bundle 0 errors.
  - Guardrail added to `docs/BUGLOG.md` (email verification ⇒ enforced email 2FA on this plan).

### 2026-09-04 (change: single "Add & verify email" action)
- **Changed:** collapsed the redundant two-button email block in Settings into one contextual
  action. Previously a user with no email saw both "Add email & verify" *and* "Add email" — the
  latter (`isChangingEmail=true`) was functionally identical when there was no existing address,
  just confusing. Now: no email → single **"Add & verify email"**; email but unverified →
  **"Verify email"** + "Change email"; verified → "Change email" only.
  - `mobile/app/settings.js`: rewrote the `emailStage === "idle"` block; the "Change email"
    (secondary) button now renders only when `primaryEmail` exists. Aligned the `addEmail`-stage
    heading to "Add & verify email". The underlying add→code→verify flow is unchanged (Clerk still
    requires the code step to prove ownership — that's what earns the badge / powers reset).
  - Validated: iOS bundle compiles (HTTP 200, ~9.7 MB, 0 errors).
- **Note (blocker, config-side):** live Clerk config has `email_address.enabled=false`, so
  `createEmailAddress()` and `reset_password_email_code` do not work yet. Enabling Email (verify
  code, optional) + Reset-password email code in the Clerk dashboard is the prerequisite for both
  the add/verify flow and `forgot-password.js`. (Owner flipping this in dashboard.)
- **Fixed (denormalization ripple): reconcile-on-verify.** The Verified badge on *listings* reads
  the denormalized `properties.verified` column, previously re-synced only by the reconcile worker
  (every `RECONCILE_INTERVAL_MS`, default 6h, + on boot). A newly-verified owner's listings would
  therefore show no badge for up to 6h. Now propagated immediately:
  - `backend/src/clerkUsers.js`: new `reconcileOwner(pool, clerkUserId)` — single-owner reconcile
    (one Clerk call, only touches that owner's rows). `reconcileOwners` (all-owners sweep) unchanged.
  - `backend/src/routes/properties.js`: new **`POST /properties/reconcile-me`** (`requireAuth`) —
    safe self-serve; reconciles only the caller's own listings. (Distinct from the admin-only
    `/reconcile-owners` which fans out over everyone.)
  - `mobile/src/hooks/useApi.js`: `reconcileMe()`.
  - `mobile/app/settings.js`: `confirmEmailCode` now `await user.reload()` (updates the in-place
    "Verified" badge) then fires `api.reconcileMe()` (best-effort) after a successful verify.
  - Validated: backend syntax OK; 56/56 API tests pass; iOS bundle compiles (0 errors);
    `POST /properties/reconcile-me` → 401 unauthenticated (auth enforced), `GET /properties` → 200.
- **Clerk config (done by owner):** email **sign-up disabled**, but email **sign-in + email
  verification code enabled** — enough for `createEmailAddress()`/verify in Settings and for
  `reset_password_email_code`. (There was no "optional email at signup" toggle; disabling email
  signup achieves the same goal — username-first onboarding preserved.)
- **Tested (E2E against live Clerk Frontend API, via testing-token to bypass bot protection):**
  (1) signup username+password → `complete`, no email required ✅; (2) add+verify email (test code
  424242) → `verification.status: verified` ✅; (3) password reset email code → `needs_new_password`
  → `reset_password` → `complete`, old password 401 ✅.
- **⚠️ Guardrail found — email verification must NOT be a second factor.** With Clerk's email code
  enabled as **Multi-factor (2FA)**, any account with a *verified email* returns `needs_second_factor`
  at login, and `sign-in.js` only handles `status === "complete"` → **verified users get locked out**
  (username-only accounts log in fine). Fix: in Clerk → Multi-factor, keep "Email verification code"
  **OFF as a 2FA method** (email verify for the badge + `reset_password_email_code` do NOT need it).
  If 2FA is ever wanted, `sign-in.js` must add `prepareSecondFactor`/`attemptSecondFactor` first.

### 2026-09-04 (feature: in-app visit scheduling)
- **Added:** first-class **visit booking** (distinct from the informal in-chat visit *proposal*).
  A buyer requests a viewing slot from the listing; the owner confirms/declines; either party can
  cancel. Each transition notifies the other party (in-app + push).
  - Backend: `visits` table (`property_id`, `requester_id`, `owner_id`, `slot`, `note`, `status`
    pending→confirmed/declined/cancelled) + `routes/visits.js` mounted at `/visits`:
    `POST /visits` (book — derives owner from the property, rejects booking your own listing, past/
    invalid slots, and blocked users), `GET /visits` (mine as requester **or** owner, upcoming-first,
    with `role` + listing title/img), `POST /visits/:id/respond` (owner-only, pending-only),
    `POST /visits/:id/cancel` (either participant). Reuses `areBlocked`, `createNotification`, `sendPush`.
  - Mobile: **"Schedule a visit"** on the property detail (slot-picker modal → `POST /visits`), a new
    **Visits** screen (`app/visits.js`) with status badges + owner Confirm/Decline + Cancel, a Profile
    menu link, and `kind:"visit"` notification routing (in-app list + push tap) → `/visits`.
    `useApi`: `createVisit`/`getVisits`/`respondVisit`/`cancelVisit`.
  - **Ripple check:** notification routing updated in **both** `notifications.js` and `PushManager.js`;
    `migrate.js` creates the table + indexes; test cleanup drops `visits` rows. No change to the
    existing chat visit proposal (kept for quick in-conversation proposals).
  - **Tests:** +4 (56 total) — auth required; can't book own listing / past / invalid slot; full
    lifecycle (book → both roles see it → owner confirms → requester notified → can't re-respond);
    either party cancels (and re-cancel is a 404 no-op).

### 2026-09-04 (feature: verified-owner trust badge — server-authoritative, Clerk-synced)
- **Changed:** the "verified" badge is now **real, owner-level, and server-authoritative**.
  Previously `post.js` sent `verified: <clerk email verified>` but `POST /properties` **never stored
  it** (dead field) — so only seed rows ever showed the badge, and had it been stored it would have
  let a client self-assign a trust badge. Now:
  - `getUser` (`clerkUsers.js`) also returns `verified` = the owner's Clerk account has ≥1 **verified
    email or phone**. Guards: no `CLERK_SECRET_KEY` / seed owner → unverified, no network call.
  - `POST /properties` derives `verified` from the **owner's Clerk account** and stores it, **ignoring
    any client-sent value**. `reconcileOwners` syncs `verified` across all of an owner's listings on
    its schedule (kept fresh + consistent, like `owner_active`/`owner_image`).
  - Removed the dead `verified` from the `post.js` create payload.
- **Added:** a prominent **"✓ Verified"** pill on the property-detail owner card (cards + chat keep
  their existing ✓, now backed by the real flag).
- **Ripple check:** displays reading `p.verified` (`PropertyCard`, `property/[id].js`, `chat/[id].js`)
  now reflect a meaningful owner-level flag; `migrate.js` ensures the `verified` column exists;
  worker's scheduled `reconcileOwners` propagates it. Seed rows keep their init.sql `verified` values
  (reconcile skips `seed_user_*`).
- **Tests:** +1 (52) — a client cannot self-assign `verified` via the create body (persists `false`).

### 2026-09-03 (test infra: jest-expo + first mobile unit tests → caught 2 live bugs)
- **Added:** mobile test runner. `jest-expo`/`jest`/`react-test-renderer` devDeps, `jest.config.js`
  (jest-expo preset), `npm test` script, and `mobile/.npmrc` (`legacy-peer-deps=true`) so `npm ci`
  resolves in CI. New job **`mobile-tests`** in `.github/workflows/ci.yml` (checkout → `npm ci` →
  `npm test`) — merges are now gated on both `backend-tests` and `mobile-tests`.
- **Tests:** first mobile unit tests (23) for the pure helpers — `src/utils/__tests__/cluster.test.js`
  (merge/split by zoom, coord normalization, null/degenerate-region guards) and
  `.../property.test.js` (price/area parsing, ₹-prefix + comma regressions, ppsf/EMI formatting).
- **Fixed (surfaced by the new tests):** two live parsing bugs in `src/utils/property.js`.
  `priceToRupees("₹2.4 Cr")` returned `null` (`parseFloat` NaN's on the leading `₹`) and
  `areaToSqft("3,200 sq ft")` returned `3` (`parseFloat` stops at the comma) — so **price-per-sqft
  and the EMI estimate never rendered** on `PropertyCard`/property detail for ₹-prefixed listings
  (i.e. almost all of them) and comma'd areas were wildly off. Replaced ad-hoc `parseFloat` with a
  shared `parseAmount()` that strips the currency symbol + commas, reads the first numeric token, and
  detects spaced/unspaced unit suffixes. See BUGLOG (new "`parseFloat` on formatted strings" guardrail).
- **Fixed:** `withCoords` (`src/utils/cluster.js`) kept coordinate-less rows at lat/lng `0`
  (`Number(null)` is `0`, not `NaN`); now coerces null/""/undefined to `NaN` so pinless listings drop.
- **Ripple check:** `pricePerSqft`/`estimateEMI` consumers (`PropertyCard`, `property/[id].js`) are
  unchanged — they now simply render values that were silently null before. ios + web bundles compile.

### 2026-09-03 (feature: map clustering + live listings on the map)
- **Added:** the Map tab now clusters nearby pins. Zoomed out, close listings collapse into a
  single amber **"N"** bubble; tapping it zooms in (`animateToRegion`) so the group splits apart;
  single pins stay normal markers that open the property. Implemented as **grid clustering in a
  pure helper** (`src/utils/cluster.js#clusterProperties`) — buckets points into a grid sized off
  the visible `region` + zoom, no extra native dependency (kept it out of `react-native-maps`).
  `withCoords` normalizes seed `lat/lng` and DB `latitude/longitude` to finite coords and drops
  pinless rows. Guards null/degenerate regions (→ all points, no divide-by-zero).
- **Changed:** `app/(tabs)/map.js` loads **real listings** via `getProperties()` on focus (was
  static `SEED_PROPERTIES`), falls back to seed if the API is unreachable, tracks `region` via
  `onRegionChangeComplete`, and re-clusters with `useMemo`. Price/emoji render handles both numeric
  DB prices and seed strings.
- **Ripple check:** web has no `react-native-maps` (metro-stubbed) → the existing signed-in/​web
  placeholder path is unchanged and now shows the live `points.length`. The property list below the
  map switched from seed to the loaded `properties` (count + rows now reflect real data). No backend
  or API change. Verified the pure `clusterProperties`/`withCoords` logic with a standalone Node
  check (merge-on-zoom-out, split-on-zoom-in, bad-coord drop, null/zero-delta guards).
- **Tests:** none added — mobile has no test runner (adding `jest-expo` is out of scope here); logic
  is a pure, side-effect-free helper validated via the Node sanity check above + ios/web bundle compile.

### 2026-08-27 (feature: geo / "near me" search)
- **Added:** distance-based listing search. `GET /properties?lat&lng[&radius=km]` computes a
  **Haversine distance in plain SQL** (no PostGIS dependency), filters to listings within `radius`
  (default 25 km, clamped 1–500), and returns them sorted nearest-first with a `distance_km` field.
  Non-geo requests are unchanged (newest-first, no `distance_km`). `LEAST(1, …)` clamps the `acos`
  argument so float error can't yield `NaN`; rows with null lat/lng are excluded from geo results.
  - Mobile: Discover gains a **"Near me"** toggle pill (`app/(tabs)/discover.js`) — requests
    foreground location via `expo-location`, refetches with `lat/lng/radius`, shows a spinner while
    locating and an active state when on; toggling off restores the default feed. `PropertyCard`
    shows a **"📍 X.X km"** chip when `distance_km` is present. Added the `expo-location` plugin
    (with a location-usage string) to `app.json`.
  - **Ripple check:** `useApi.getProperties` already spreads arbitrary params → no change needed;
    `load` deps include `geo` so the focus-effect refetches on toggle; `distance_km` is additive so
    all existing consumers are unaffected.
  - **Tests:** +2 (51 total) — near point returned & far point excluded within radius, results
    ascending by distance with `distance_km` present; non-geo request omits `distance_km`.

### 2026-08-27 (feature: saved-search alerts + real notifications store)
- **Added:** save a search (discover filters: type/status/text) and get **alerted when a new
  matching listing is posted**.
  - Backend: `saved_searches` + `notifications` tables. `POST/GET /saved-searches`,
    `DELETE /saved-searches/:id`; `GET /notifications` (+ unread count), `POST /notifications/read`.
    `notifyListingMatch` runs on `POST /properties` → inserts a `listing_match` notification (+ push)
    for each matching searcher (owner excluded). `POST /messages` now also writes a `new_message`
    notification.
  - Replaced the derive-from-conversations notifications screen with a real store feed
    (`notifications.js` reads `GET /notifications`, marks read on open; new/listing rows with the
    right tap target). Discover gains a **“Save this search · get alerts”** button + a saved-searches
    manager screen (`saved-searches.js`, linked from Profile). Push taps route to the property for
    listing alerts.
  - **Tests:** +3 (49 total) — saved-search CRUD (auth-scoped), matching notifies the searcher (and
    non-match/own-listing don't), message → notification + mark-read.


### 2026-08-27 (authorization audit — 2 fixes)
Reviewed every route for authz (ownership scoping, recipient-only proposal actions, block/self
checks — all sound). Two real gaps found & fixed:
- **Removed `GET /auth/resolve`** — an **unauthenticated** endpoint that mapped a username → the
  account's **email** (PII harvesting / phishing enumeration). It was already unused by the client
  (username-first sign-in dropped it). Deleted the route + the dead `resolveUsername` client method.
- **`POST /properties/process` image tampering** — `base` paths are public (in listing image URLs)
  and `/process` didn't verify ownership, so any user could overwrite another listing's images.
  Now each presigned `base` is bound to the requesting user (`pending_uploads`) and `/process` only
  acts on bases the caller presigned (consumed on use); returns `{ processed }`.
- **Tests:** +2 (46 total). Findings recorded in `docs/BUGLOG.md`.


### 2026-08-19 (dev: PR-based flow + .env.example)
- **Ops:** adopted a feature-branch → PR → CI → merge flow (GitHub CLI). `.env.example` now
  documents the MinIO + security/ops vars (`CORS_ORIGIN`, `RATE_LIMIT_MAX`, `NODE_ENV`,
  `RECONCILE_INTERVAL_MS`). First change merged via the new flow to validate it end to end.

### 2026-08-19 (security & CI hardening + duplicate-send fix)
- **Fixed:** messages appeared **twice** on the sender's side (receiver saw one; reload showed one).
  Cause: optimistic message + the server's `message` socket echo to the sender's own room racing —
  the socket appended the real message before the HTTP response replaced the optimistic one, giving
  two copies of the same id. Fix: on HTTP resolve, drop the optimistic and add the real one only if
  the socket echo hasn't already (dedupe by id). Applied to text + image sends. `docs/BUGLOG.md`.
- **Security:** added `helmet` (security headers), `express-rate-limit` (600/min per IP, `trust
  proxy` for real client IP behind nginx), **configurable CORS** (`CORS_ORIGIN`, default `*` for
  dev), 1mb JSON body cap, and a **prod-safe error handler** (no stack/message leak when
  `NODE_ENV=production`).
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) — spins up Postgres + Redis, loads
  `db/init.sql`, runs the API tests on push/PR, plus `npm audit`. Extracted `migrate()` into
  `src/migrate.js` and added a Jest `globalSetup` so tests are self-contained (schema-wise).

### 2026-08-19 (fix: chat back button — real root cause)
- **Fixed:** the chat back button did nothing because `router.back()` **no-ops when there's no
  history to pop** (reload / deep-link / notification straight onto a `/chat/...` URL). Now guards
  with `router.canGoBack() ? router.back() : router.replace("/messages")` (+ `hitSlop`). Note: the
  earlier attempt (making menu/report Modals conditional) was a valid cleanup but **not** the cause
  — recorded in `docs/BUGLOG.md` as a two-attempt fix.

### 2026-08-19 (fixes: chat quick-reply appearance; add bug log)
- **Fixed:** quick-reply chips were clipped/half-visible — a horizontal `ScrollView` with no fixed
  height collapses on web. Wrapped it in a fixed-height (58) row, chips centered.
- **Changed (hygiene):** render the chat header menu/report `Modal`s conditionally.
- **Fixed:** quick-reply chips were clipped/half-visible — a horizontal `ScrollView` with no fixed
  height collapses on web. Wrapped it in a fixed-height (58) row, chips centered.
- **Docs:** added `docs/BUGLOG.md` — bug history + a **recurring-patterns/guardrails** table
  (useApi instability, RN-web overlay/layout quirks, denormalized-data propagation, messaging
  identity, npm ERESOLVE). Referenced from `CLAUDE.md` so it's checked during new work.

### 2026-08-19 (Tier 3 trust & safety: block, report, verified badge)
- **Added (safety):** block / report a user, and a verified badge in the chat header.
  - Backend: `blocks` + `reports` tables; `POST/DELETE /users/:id/block`, `GET /users/:id/block`
    (returns `blockedByMe`/`blockedMe`), `POST /users/:id/report { reason, property_id }`.
    Messaging (text/image/visit/offer) is **rejected with 403 if either party blocked the other**
    (`src/blocks.js`).
  - Client: chat header overflow menu (View listing · Report user · Block/Unblock); a blocked
    banner disables the composer with an Unblock action; report opens a reason picker; a
    **✓ Verified** badge shows in the header when the peer owns a verified listing.
- **Tests:** +4 (43 total) — block requires auth, can't block self, block → send 403 → unblock
  restores, report stored.


### 2026-08-19 (chat composer polish: + actions menu + quick-reply fix)
- **Changed (UI):** folded the photo / visit / offer buttons into a single **"+"** in the composer.
  Tapping it springs open a **vertical actions menu** (Send a photo · Request a visit · Make an
  offer) with a fade + slide-up animation; the "+" rotates to "×"; tap-outside closes. Declutters
  the composer.
- **Fixed (UI):** quick-reply chips were clipped ("half visible") — the row had a `maxHeight: 46`
  smaller than the chip height. Removed the cap (`flexGrow: 0`); chips now render fully. Also hide
  quick replies while the + menu is open.

### 2026-08-19 (Tier 2 chat: quick replies)
- **Added (UX):** context-aware quick-reply chips above the composer (shown when the input is
  empty) — buyer set ("Is it still available?", "Can I schedule a visit?", "Can you share more
  photos?", "Is the price negotiable?") vs owner set ("Yes, it's available", "When would you like
  to visit?", "I'll share more photos", "Price is negotiable"). One tap sends. Client-only —
  refactored `send` into a reusable `sendText`. No backend change (39 tests unchanged).

### 2026-08-19 (Tier 2 chat: photo attachments)
- **Added:** send photos in chat (`type='image'`, `meta={ url, thumb }`), reusing the existing
  presigned MinIO upload + sharp thumbnail pipeline. `POST /messages` now accepts an `image`
  body (no text required); image messages render as inline photos with the same read-receipt
  ticks. Composer gains an image button. *Purpose:* request/share specific property photos and
  documents in the zero-brokerage flow (buyers routinely want more than the fixed gallery).
- **Tests:** +1 (39 total) — an image message sends without requiring text.

### 2026-08-18 (Tier 2 chat: make an offer + counter/reschedule)
- **Added (marketplace):** generalized the visit feature into a unified **proposal** system —
  **visit** (`when`) and **offer** (`amount`) as structured messages — with a **counter** action.
  - `POST /messages/:propertyId/proposal { kind, receiver_id, value }` create;
    `POST /messages/proposal/:id/respond { status }` accept/decline (recipient only);
    `POST /messages/proposal/:id/counter { value }` marks the original `countered` and sends a
    fresh proposal back to the proposer (this is the "owner suggests another time / counter-offer"
    the request asked for — immediate, not just a decline). Emits `message` + `message-update`.
  - Client: composer now has **clock (visit)** + **tag (offer)** buttons; `ProposalCard` renders
    both with Accept / Decline / **Suggest another time / Make a counter-offer**; `OfferModal`
    (amount) + the existing day/time picker; counters open the picker prefilled to the kind.
  - Replaced the visit-only endpoints (`/visit`, `/visit/:id/respond`) with the generic ones.
- **Tests:** +3 (38 total) — offer propose/accept, invalid amount, invalid kind, and visit counter
  (original → countered, new pending back to the buyer).

### 2026-08-18 (Tier 2 chat: schedule a visit)
- **Added (marketplace action):** propose a property visit inside the chat. Modeled as a
  **structured message** (`messages.type='visit'` + `meta` JSON `{ when, status, by }`), so it
  flows through the existing chat, socket, conversations, and read-receipt pipeline.
  - `POST /messages/:propertyId/visit { receiver_id, when }` → creates a pending visit (emits
    `message` + push). `POST /messages/visit/:id/respond { status }` → **recipient only** accepts/
    declines (emits `message-update`).
  - Client: a clock button in the composer opens a bottom-sheet **day + time-slot picker** (no
    native date-picker dep → works on web + Expo Go); visits render as inline cards with
    Accept/Decline; status updates live via the new `message-update` socket event.
- **Postponed:** EAS development build (to receive push on device) parked in ROADMAP.
- **Tests:** +4 (35 total) — propose creates a pending visit; proposer can't respond (404);
  recipient accepts → accepted; invalid status → 400.

### 2026-08-12 (push notifications for new messages)
- **Added (push):** Expo push notifications so message replies land when the app is closed.
  - Backend: `push_tokens` table + `POST /push/register` / `POST /push/unregister`; `src/push.js`
    `sendPush` posts to the Expo Push API. `POST /messages` notifies the recipient (title = sender,
    body = message), fire-and-forget so a push failure never fails a send.
  - Client: `PushManager` registers the device's Expo token on sign-in, routes notification taps to
    the right chat, and **suppresses the banner for the chat that's already open**. Added
    `expo-notifications` + the app.json plugin.
- **Graceful degradation:** remote push needs a **development build** (Expo Go SDK 53+ dropped it)
  and web has no native push — `PushManager` no-ops safely in those. Verified `sendPush` reaches
  Expo and handles bad tokens without throwing.
- **Tests:** +2 (31 total) — push register requires auth + a token, and stores it per user.

### 2026-08-12 (fix messages inbox flicker + chat forecast plan)
- **Fixed (regression):** the messages inbox flickered in a render loop. The new `load`/`markRead`
  callbacks depended on `useApi()`, which isn't referentially stable, so `useFocusEffect` re-ran
  every render → `setState` → re-render. Pinned `api` in a ref (`apiRef`) in `messages.js` and
  `chat/[id].js` — the same pattern already used in discover/profile. Also stops repeated
  mark-read API calls in chat.
- **Docs:** added the **chat enhancements forecast** (Tiers 1–3 with resources) to `docs/ROADMAP.md`.

### 2026-08-11 (real-time chat + read receipts)
- **Added (real-time):** Socket.io on the Express API (`src/realtime.js`), attached to the HTTP
  server. Clients authenticate with their Clerk session token (verified via `@clerk/backend`;
  unauthenticated/bad tokens rejected) and join a personal room (their Clerk id). Reaches the app
  through nginx at `/api/socket.io` (WS upgrade already configured) — no infra change.
- **Instant delivery:** `POST /messages` emits the new message to both participants' rooms; the
  chat + inbox update live (no refresh). Dedup by id on the client.
- **Read receipts:** `messages.read_at` column + `POST /messages/:propertyId/read?peer=` marks the
  peer's messages read and emits a `read` event → sender's ticks flip to ✓✓ (seen) in real time.
  Own messages show ✓ (sent) / ✓✓ (seen).
- **Unread badges:** conversations now return an `unread` count; the inbox shows a per-thread badge
  and refreshes live on new messages.
- **Typing indicator:** ephemeral `typing` socket event → the header shows "typing…".
- **Client:** `SocketProvider` (one Clerk-authenticated socket for the app, refreshes token on
  reconnect); chat + inbox subscribe to `message`/`read`/`typing`.
- **Deps:** `socket.io` (backend), `socket.io-client` (mobile).
- **Tests:** +1 (28 total) — unread count then mark-read. Verified: nginx handshake + WS upgrade;
  socket rejects missing/invalid tokens. Live two-device delivery is the on-device check (Clerk
  restricts minting session tokens from the Backend API).


### 2026-08-11 (messaging fixed properly: one thread, two-way, with sender identity)
- **Root cause (found by inspecting the DB):** the old "receiver = owner always" bug had
  written **10 self-addressed messages** (sender = receiver = owner) for the amrit5377↔ram123
  thread. These created a phantom **second thread** (peer = self) and were never delivered to
  the buyer. The prior peer fix didn't clean this legacy data.
- **Data repair (migration):** re-address every self-message (sender = receiver) to the other
  participant on that property — preserving history AND finally delivering it. Verified: 0
  self-messages remain; amrit5377 now has **one** thread with ram123 (18 msgs merged); ram123's
  view now includes amrit's 10 replies.
- **Prevention:** `POST /messages` rejects self-addressed messages (400); the chat screen refuses
  to send to yourself. So the bug class can't recur.
- **Sender identity stored (requested):** `messages` gains `sender_name` / `sender_avatar` /
  `sender_image`; each send stamps the sender's identity. Conversations resolve the **peer's**
  name/avatar/image (owner info if the peer is the owner, else the buyer's stamped identity).
- **Ripple:** inbox and chat header now show **who you're chatting with** (peer), not the owner;
  `useApi.sendMessage` forwards sender identity; chat send guards self + stamps identity.
- **Tests:** +2 (27 total) — self-message rejected (400); owner sees exactly ONE thread with the
  buyer's name. Two-way delivery + per-buyer threads still pass.

### 2026-08-11 (bugfix: messages not delivered both ways)
- **Fixed (messaging):** replies never reached the other person. `chat/[id].js` always set the
  receiver to the **property owner**, so when the owner replied it was addressed to *themselves*
  and the buyer never received it (and vice-versa). Root cause: conversations weren't scoped to
  the two participants.
- **Peer-aware conversations (the real fix):**
  - `chat/[id].js` now takes a `peer` param and sends to the **peer** (the other person), not
    always the owner; loads the peer-scoped thread.
  - Backend `GET /messages/:propertyId?peer=<id>` returns the exact two-person thread; `POST`
    unchanged (receiver from body).
  - `GET /messages` (conversations) now groups by **(property, peer)** and returns `peer_id`, so
    an owner gets a separate thread per buyer.
- **Ripple (open a chat with the right peer):** property detail passes `peer=<owner>`; inbox and
  notifications pass `peer=<peer_id>`; chat header shows the property title when the owner views a
  buyer's thread (buyer names aren't stored).
- **Tests:** +2 (26 total) — owner & buyer both see the full thread; conversation list carries
  `peer_id`. Live-verified two-way delivery + per-buyer threads.

### 2026-08-11 (soft-hide listings from flagged/deleted owners)
- **Changed (visibility / industry-standard soft-delete):** Listings whose owner is flagged
  `owner_active = false` are now **hidden** from the app, not shown with an "Unavailable" badge.
  Filtered out of `GET /properties` (discover + search) and `GET /saved`. Data is **retained**
  in Postgres — nothing is deleted.
- **Kept reachable by direct id** (`GET /properties/:id`) so existing deep links / chat threads
  still resolve and show the "no longer available" state. Conversations remain visible with the
  flag (users keep their chat history rather than having it vanish).
- **Test:** +1 — a flagged owner's listing disappears from the list but is still reachable by id
  (24 total). Live-verified: 2 flagged rows retained in DB, 0 shown by the public API.

### 2026-08-11 (prefer full name over username, consistently)
- **Changed:** show a user's **full name** to others when they've set one, else fall back to
  `@username`. This was already the rule for chat/new listings; the reconcile now also **syncs
  the denormalized listing `owner_name`/`owner_avatar`/`owner_image` from Clerk**, so existing
  listings match (previously backfilled to `@username`). Ran it: the active owner's listings now
  show "Amrit pal Singh" instead of "@amrit5377".
- Consistent across listings, chat header, inbox, and message sender identity.

### 2026-08-11 (bugfix: owner couldn't see the buyer's name in chat)
- **Root cause:** the owner reads the buyer's name from the `sender_name` stamped on the buyer's
  messages, but messages sent **before** the sender-identity feature had `sender_name = NULL`, so
  the owner's header/inbox fell back to "Chat"/"User". (The buyer always saw the owner because
  owner identity is denormalized on the property.)
- **Fix:** `backfillMessageSenders` (in `clerkUsers.js`) fills `sender_name`/`sender_avatar`/
  `sender_image` on NULL messages from Clerk; the worker's scheduled reconcile now runs it too, so
  it self-heals. Ran once — ram123's messages now resolve to "Ram Tirath".
- **Robustness:** chat header prefers a peer message that actually carries a name and falls back
  to "Buyer" instead of "Chat".

### 2026-08-11 (cosmetic: punctuation overlap while typing)
- **Fixed (UI, chat):** repeated narrow punctuation (`?` `.` `-`) visually overlapped in the
  chat input + message bubbles. **Not a data bug** — stored text is intact (verified
  `[???????????????]` in the DB); purely how the monospace design font (GeistMono) advances
  those glyphs. Added `letterSpacing: 0.3` to the composer input and bubble text so repeated
  glyphs don't collide (monospace look preserved).
- **Ripple (pending confirmation):** the same font is used in all other inputs (`NeoInput`,
  `GlassInput`, discover search). Will apply the same `letterSpacing` there once the chat fix is
  confirmed visually.

### 2026-08-11 (tab bar transition animation)
- **Changed (UI polish):** Bottom tab bar now animates on screen switch — the active
  highlight pill **fades + scales** in/out between tabs (via the existing per-tab spring),
  and the newly-active **icon lifts + scales** slightly at the same time. Post stays a
  persistent amber CTA. Driven natively (opacity/transform), single file `_layout.js`.

### 2026-08-11 (UI bugfixes: tab labels + home header identity)
- **Fixed (tab bar):** inactive tab labels were invisible in both themes — `_layout.js` set
  label `opacity` to the per-tab anim value (0 when inactive). Now interpolates to 0.8–1 so
  all labels are visible; active state still emphasized via color + opacity.
- **Fixed (home header):** the Discover greeting showed "Hello, there" + a generic "M" and no
  photo for username-first accounts. Now falls back to the **username** for the name/initials
  and shows the user's **profile picture** (`user.imageUrl`) when set. Consistent with the
  profile/settings username+image handling.

### 2026-08-05 (bugfix: owner profile photo not visible on listings / to others)
- **Fixed:** profile photos showed only on the owner's own Profile/Settings, never on their
  listings or to other users, because owner display data is **denormalized** onto each
  property and the image was never propagated.
- **Backend:** added `owner_image TEXT` (migration); `POST /properties` now accepts+stores it;
  conversations query returns it; `reconcileOwners` now also **syncs `owner_image`** from Clerk
  (and skips rows on transient errors so nothing gets wiped).
- **Ripple (all owner-avatar spots):** `Avatar` (`ui.js`) gained an `imageUrl` prop; passed it
  in `PropertyCard`, `property/[id].js`, `chat/[id].js`, `messages.js`; `post.js` sends the
  owner's `imageUrl` on create.
- **Verified cross-user:** public `GET /properties` returns `owner_image` for the active owner
  (`img.clerk.com/…`) — i.e. what *other* users see. Reconcile backfilled existing listings.
- **Lesson:** denormalized/copied data must be propagated to every copy, and features must be
  tested from the *consumer's* (other user's) perspective — the public API — not just the
  author's screen. Reinforced in CLAUDE.md rule #1.

### 2026-08-05 (scheduled reconcile + profile pictures)
- **Added (worker):** Scheduled owner-liveness reconcile — a `maintenance` BullMQ queue +
  a second Worker in `worker.js` run `reconcileOwners` on a repeat schedule
  (`RECONCILE_INTERVAL_MS`, default 6h) and once on boot. Verified: `checked 3, inactive 2`.
- **Ripple (ops):** `docker-compose.yml` worker was missing `CLERK_SECRET_KEY` (only `api`
  had it) — reconcile would have silently no-op'd. Added it + `RECONCILE_INTERVAL_MS`.
- **Added (profile picture):** Users can set a profile photo (Clerk `setProfileImage`) —
  `settings.js` tap-avatar → pick image (expo-image-picker) → upload → shows a camera badge
  + spinner. `AccentDisc` renders `user.imageUrl` when set.
- **Ripple (avatar display):** `profile.js` now shows `user.imageUrl` (tap → Settings) when
  the user has a photo, else the initials gradient. (Owner avatars on listings are separate —
  they use the denormalized `owner_avatar` initials, not the Clerk image.)
- Backend tests still 23/23; iOS + web bundles compile. Profile-image upload **verified on
  web (2026-08-05)**; ⏳ still needs verification on the **mobile/native** app (RN Blob may
  need to become a `{ uri, name, type }` / FormData upload).

### 2026-08-05 (flag owners whose account no longer exists)
- **Added (backend):** `owner_active` boolean on `properties` (migration, default true) +
  `src/clerkUsers.js` (`userExists` via Clerk Backend API, `reconcileOwners`) +
  `POST /properties/reconcile-owners` to flag listings whose owner's Clerk account is gone
  (404). Seed/demo owners are always treated as active. `owner_active` flows through
  `SELECT *` responses and was added to the conversations query.
- **Changed (ripple — flag unavailable owners everywhere they appear):**
  - `PropertyCard.js`: red "Unavailable" tag on the owner row.
  - `property/[id].js`: owner card shows "⚠ No longer available"; contact panel replaced with
    a disabled "Owner no longer available" state (no chat/call/whatsapp).
  - `chat/[id].js`: header status shows "No longer available" + a banner; (also fixed the
    header to reflect this instead of always-"Online").
  - `messages.js` inbox: conversations with a gone owner show "⚠ Owner no longer available".
- **Ops:** Ran reconcile — flagged 2 deleted/fake owners (`@deeep0202`, `Amrit Singh`),
  1 active (`@amrit5377`).
- **Test:** created listings assert `owner_active === true` (23 total, all passing).
- **Deferred:** password reset parked in ROADMAP until add-email/phone lands.
- **Future:** automate reconcile via a Clerk `user.deleted` webhook or a scheduled job
  (currently on-demand).

### 2026-08-05 (password reset)
- **Added (auth):** Password reset flow — new `app/forgot-password.js`. Enter
  username/email/phone → Clerk sends a reset code to the account's verified email or phone
  (`prepareFirstFactor` with `reset_password_email_code`/`reset_password_phone_code`) →
  enter code + new password (`attemptFirstFactor` → `resetPassword`) → signed in.
- **Changed (ripple):** `sign-in.js` — added a "Forgot password?" link on the username tab
  → `/forgot-password`.
- **Ripple/impact checked:** `forgot-password.js` (new), `sign-in.js` (link); verified
  `_layout.js` AuthGuard treats only `(tabs)` as protected, so signed-out users can reach
  the reset screen. **Requires** the account to have a verified email or phone AND "reset
  password" enabled in Clerk — username-only accounts with no contact can't reset until they
  add one (Settings). Documented in ARCHITECTURE.

### 2026-08-05 (replace mock data with a real conversations backbone)
- **Added (backend):** `GET /messages` — lists the current user's conversations (one row
  per property, newest first) with property + last-message info. Registered before
  `/:propertyId`. Auth-guarded; +2 tests (suite now 23).
- **Changed (removed mocks):**
  - `messages.js`: `FAKE_CHATS` → real inbox from `getConversations()`, with loading +
    empty states; tapping opens `/chat/{property_id}`.
  - `notifications.js`: `FAKE_NOTIFS` → real inbound-message activity derived from
    conversations; tap opens the chat. (Read state still local for the session.)
  - `profile.js`: "Inquiries" stat was hardcoded `0` → real count of conversations on
    listings the user owns.
- **Fixed (ripple):** `chat/[id].js` looked up the property from SEED data only, so real
  (UUID) listings had no header and `receiver_id` fell back to `seed_user_1`. Now fetches
  the real property via `getProperty(id)` and uses its `clerk_user_id` as the receiver.
- **Added:** shared `src/utils/time.js#timeAgo` (used by inbox + notifications).
- **Ripple/impact checked:** `messages.js`, `notifications.js`, `profile.js` (Inquiries),
  `chat/[id].js` (receiver + header), `useApi.js` (`getConversations`), backend
  `routes/messages.js`. Verified `chat/[id].js` still works for seed listings (fallback kept).
  Note: unread badges intentionally dropped — no read-tracking column exists yet (future work).

### 2026-08-04 (owner username on listings — bugfix)
- **Fixed (UI):** Property owner's username wasn't shown on listings. Username-first
  accounts have no first/last name, so `post.js` stored a generic `"Owner"` / `"ZM"` as
  `owner_name`/`owner_avatar`. Now falls back to `@username` (and username initial).
- **Fixed (UI):** `settings.js` had the same bug — read username from the old
  `unsafeMetadata.username`; now reads native `user.username`. Also its "Save profile"
  required a first name (impossible for username-only users) and saved username to the
  wrong place — now saves native `username` and treats name as optional.
- **Ops (data backfill):** Updated existing listings whose `owner_name` was still `"Owner"`
  — looked up each owner's Clerk username via the Backend API and set `@username` +
  avatar initial (`@amrit5377`, `@deeep0202`).
- Note: `profile.js` was already fixed earlier this day; this extends the same fix to
  listing creation + settings.

### 2026-08-04 (input validation)
- **Added (security/validation):** Dependency-free request validation for write endpoints
  — `backend/src/validation.js` (`validateProperty`, `validateMessage`, `isUuid`).
  - `POST /properties` + `PUT /properties/:id`: required fields, `type`/`status` enums,
    string length caps, integer ranges (beds/baths), coordinate ranges, string-array checks.
    Invalid → **400** with an `errors[]` list.
  - `:id`/`:propertyId` params validated as UUIDs on `PUT`/`DELETE /properties`,
    `POST/DELETE /saved`, `POST /messages` → **400** instead of a Postgres 500.
  - `POST /messages/:propertyId`: requires non-empty `text` (≤2000) + `receiver_id`.
  - Validation runs **after** `requireAuth`, so unauthenticated still returns 401.
- **Added (tests):** 8 validation tests (suite now **21** total, all passing).

### 2026-08-04 (later)
- **Added (tests):** First automated API test suite — `backend/tests/api.test.js`
  (Jest + Supertest, 13 tests): health, public reads + filtering, 404s, all auth guards
  (401 when signed out), and property CRUD + ownership (create 201, `/mine`, non-owner
  PUT/DELETE → 404, owner delete → 200 then gone). Clerk is mocked via an `x-test-user`
  header; tests run against the real Postgres inside the container: `docker exec zamin_api npm test`.
- **Changed (refactor):** Split `backend/src/index.js` → exportable `backend/src/app.js`
  (Express app) + thin `index.js` (listen + migrate + bucket). Enables importing the app in
  tests without starting a server. `ROADMAP` "automated tests" item now in progress.
- **Docs:** Removed a stray `</content>` line accidentally introduced at the end of the
  new doc/code files during authoring.

### 2026-08-04
- **Docs:** Added full documentation system — `docs/ARCHITECTURE.md` (A–Z system
  reference), `CHANGELOG.md` (this file), `docs/ROADMAP.md` (goals + backlog), and root
  `CLAUDE.md` (operational runbook + working agreement). Purpose: preserve architecture
  knowledge across sessions and enforce a track-everything workflow.
- **Changed (auth UX):** Removed the "Sign In / Register" tab switcher from both
  `sign-in.js` and `sign-up.js`. Navigation now relies on the existing bottom links.
  Kept the Username/Phone method toggle. *Why:* user wanted a simpler auth screen.
- **Fixed (profile):** `app/(tabs)/profile.js` read `user.unsafeMetadata.username`
  (old storage) → now reads Clerk-native `user.username`, and uses it for the display
  name + avatar initials when no first/last name exists. *Why:* username-only accounts
  showed blank name.
- **Changed (auth simplification):** Reworked sign-up to a Username↔Phone toggle
  (default Username), username path creates an account instantly with no email/SMS.
  Removed email from the auth flow entirely (to move to profile settings later).
  Files: `app/sign-up.js`, `app/sign-in.js`. *Why:* fast multi-user testing +
  simplest onboarding.
- **Fixed (sign-up diagnostics):** On incomplete signup, surface Clerk's actual
  `missingFields`/`unverifiedFields` in the on-screen error + `console.log`, instead of
  a generic message. *Why:* pinpoint dashboard config problems (turned out `phone_number`
  was set to *required*).
- **Added (phone auth):** SMS-based phone sign-up (`preparePhoneNumberVerification`) and
  passwordless phone sign-in (`prepareFirstFactor`/`attemptFirstFactor` with `phone_code`),
  with E.164 normalization defaulting to +91.
- **Ops:** Brought the full stack up locally and verified end-to-end (7 containers, API via
  nginx, DB seed, MinIO, Metro, phone tunnel). Added `docker-compose.override.yml` for Expo
  **tunnel mode** so a physical iPhone can connect over any network.

---

## Baseline (from git history, before this changelog existed)

- `39d272b` Refresh discover listings on focus instead of mount
- `97b7727` Redesign UI + scalable image pipeline (object storage, thumbnails, background worker)
- `a7ebac3` Overhaul post form UX + clean profile + in-app delete confirm modal
- `7b83957` Fix delete not working: 401 auth + web-safe confirmation
- `cdfface` Add full CRUD for property listings + fix Clerk web AuthContext error
