# Changelog

All notable changes to Zamin are recorded here. **Newest first.**

Format: each entry is dated and tagged `Added` / `Changed` / `Fixed` / `Removed` /
`Security` / `Docs` / `Ops`. Keep entries short but specific — name the file(s) and the
*why*, not just the *what*. Update this file **in the same change** that makes the edit.

> Convention: an entry is not "done" until it's (a) built/validated and (b) logged here.

---

## [Unreleased]

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
