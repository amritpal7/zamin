# Zamin — Bug Log

A running record of bugs: symptom → root cause → fix → **category**. The point is to spot
**recurring patterns** and turn them into guardrails so we stop reintroducing the same classes
of bug while building new features. Newest first. Update this whenever we fix a bug.

## Recurring patterns & guardrails (check these when building)

| Pattern | Times hit | Guardrail |
|---------|-----------|-----------|
| **`useApi()` isn't referentially stable → `useFocusEffect`/effect render loop (flicker)** | 2+ | Any effect/callback that uses the API client must pin it in a ref (`const apiRef = useRef(api); apiRef.current = api;`) and depend on primitives, not `api`. Pattern already in discover/profile. |
| **react-native-web layout quirks** | 2 | Horizontal `ScrollView` with no fixed height **collapses on web** → wrap in a fixed-height `View`. (Also: keyboard covering inputs.) |
| **`router.back()` no-op / dead nav buttons** | 2 | `router.back()` does nothing with no history (reload/deep-link/notification). Use `router.canGoBack() ? router.back() : router.replace(<fallback>)`. Also: a dead button = handler-not-firing (overlay) OR handler-no-op (nav) — distinguish before fixing. **Swept 2026-09-12:** fixed `property/[id]` (push-notification target), `messages`, `my-listings`, `settings`; `chat/[id]` already had it. |
| **Modal hygiene** | 1 | Render `Modal`s **conditionally** (`{open && <Modal visible/>}`), not always-mounted — cleaner and avoids RN-web overlay risk. |
| **Denormalized data not propagated to every copy** | 3 | owner_name / owner_avatar / owner_image / sender_name are copied onto rows — update ALL copies + the reconcile job, not just the Clerk user. (CLAUDE.md rule #1) |
| **`INSERT … SELECT $1,$2 WHERE NOT EXISTS(…)` → "inconsistent types deduced for parameter $1"** | 1 | Postgres can't infer column types for bare params in a `SELECT` list that are also compared in `WHERE`. For conditional insert, don't use `INSERT…SELECT…WHERE NOT EXISTS` with untyped `$n` — either cast (`$1::uuid`) or (cleaner) do a `SELECT 1 … LIMIT 1` existence check then a plain `INSERT … VALUES`. |
| **Verified email ⇒ enforced email-code 2FA at login (Clerk, this plan)** | 1 | Enabling email as a verifiable identifier (needed for add/verify-email + `reset_password_email_code`) **also forces an `email_code` second factor** for any account with a verified email. There is **no dashboard toggle to separate them**: Multi-factor has no email option; turning off "Sign in with email address" disables email entirely (breaks verify+reset); `sign_in.second_factor.required=false` is reported but the step is enforced anyway. **Sign-in MUST handle `needs_second_factor`** (done in `sign-in.js`: `prepareSecondFactor`/`attemptSecondFactor` with `email_code`). Username-only accounts are unaffected. Any new auth entry point (e.g. a future email/social sign-in) must handle this branch too. |
| **Messaging receiver/thread identity** | 2 | Receiver = the *peer* (other person), never self/owner-always; conversations keyed by (property, peer). Backend rejects `sender==receiver`. |
| **mobile `npm install` ERESOLVE** | 2 | Install in the mobile container with `--legacy-peer-deps` (matches its Dockerfile). Now pinned via `mobile/.npmrc` (`legacy-peer-deps=true`) so `npm ci` works in CI too. |
| **Stray `</content>` appended by the Write tool** | many | After writing files, strip lines matching `^</content>$`. |
| **`parseFloat` on formatted strings** | 2 | `parseFloat("₹2.4 Cr")` is `NaN` (leading symbol) and `parseFloat("3,200")` is `3` (stops at comma). Strip currency/commas and match the numeric token before parsing. |
| **Location-privacy: redacting a field ≠ hiding the row** | 1 | A `hidden` listing keeps real coords in the DB, so it passes a geo `WHERE` and its distance is only *redacted* after the query — but its mere presence in a radius result leaks it's within `radius`. For proximity/geo queries, **exclude** privacy-restricted rows in SQL (unless the viewer owns them); don't just null the field post-query. |
| **Status transitions must be atomic — guard the UPDATE, not just a prior SELECT** | 1 | A SELECT that checks `status='pending'` followed by an unguarded `UPDATE … WHERE id=$1` is a TOCTOU race: a concurrent transition slips in between. Put the state guard in the UPDATE itself (`… AND meta->>'status'='pending' RETURNING *`) and treat 0 rows as "already answered" (409). Validate inputs *before* the flip so a later failure can't strand a half-applied state. (Proposal counter hit this; `respond` and `/visits` already did it right.) |
| **Dev-only URL/path assumptions break in prod** | 2 | Dev routes everything through nginx (`/api/*`, `/media/*`); prod talks to the API directly with absolute object URLs. Hardcoded dev paths silently break in prod: (1) thumbnail derivation keyed on `u.includes("/media/")` → prod URLs are `…/zamin/properties/<id>.jpg`; (2) **Socket.io path hardcoded `/api/socket.io`** (nginx-strips-`/api`) → prod serves `/socket.io`, so realtime never connected. Derive paths from whether BASE has an `/api` prefix (`utils/net.js socketConfig`), and detect our images by a scheme-independent key pattern. After a dev→cloud switch, grep the client for `/media`, `/api/`, `localhost`, `.railway.internal`. |

## Log

### 2026-09-12 (visits/offers hardening pass — proposal counter race + silent accept/decline)
- **Chat-proposal counter had a TOCTOU race.** It `SELECT`ed the original (checking pending), then
  flipped it to `countered` with an unguarded `UPDATE … WHERE id=$1` — so a concurrent accept/decline
  (or a double-counter) could clobber the real outcome. **Fix:** single guarded UPDATE (`receiver +
  still-pending`) that aborts 409 if it lost the race; value validated before the flip so an invalid
  counter can't strand the original as "countered". **Category:** concurrency / atomicity.
- **Accept/decline of a chat proposal was silent.** `respond` only emitted a socket `message-update` —
  no push / in-app notification — so a proposer with the app closed never learned their offer/visit was
  answered (create, counter, and first-class visits all notify). **Fix:** push + feed notification to
  the proposer on respond. **Category:** notification gap.
- Added 4 proposal tests (create→accept→notify, counter, counter-guard, validation) — chat proposals
  were untested. Reviewed first-class `/visits` + the Visits screen: solid (atomic transitions, focus
  refresh, optimistic-with-revert). 99 backend tests pass.
- *Noted (not a bug, product decision):* accepting a *chat* "visit" proposal does not create a
  first-class `/visits` row — the two systems are intentionally separate (informal vs. booked).

### 2026-09-12 (auth hardening pass — AuthGuard only protected the tab group)
- **Signed-out users could land on authenticated non-tab screens.** The `AuthGuard` only redirected
  to sign-in when `segments[0] === "(tabs)"`, but `chat`, `messages`, `my-listings`, `settings`,
  `visits`, `notifications`, `saved-searches`, and `property/edit` all require auth. Reaching them
  signed-out (push deep-link → `/chat` or `/visits`, a web URL, or a session that expired mid-use)
  showed a broken/empty screen with failing API calls instead of the sign-in screen. **Category:**
  authz / navigation.
  - *Fix:* `PROTECTED_SEGMENTS` set + a `property/edit` special-case (so the public `/property/[id]`
    view stays open) in `mobile/app/_layout.js`. *Enhancement noted (not done):* preserve the
    deep-link target across sign-in to return the user to where they were headed.
  - *Reviewed OK:* `sign-in` (credentials/phone/email-MFA branches, resend cooldowns, interval
    cleanup), `forgot-password` (email/phone reset → `needs_new_password` → `resetPassword`), `sign-up`
    (username/phone verify). Sign-in already handles the enforced email-code 2FA branch.

### 2026-09-12 (chat/realtime hardening pass — realtime dead in prod)
- **Realtime chat never connected in prod.** `SocketContext` hardcoded `SOCKET_PATH =
  "/api/socket.io"` (the dev nginx path — nginx strips `/api` → server's `/socket.io`). Prod has no
  nginx: the app talks to the API directly, which serves Socket.io at `/socket.io`, so the handshake
  404'd and the socket retried forever. Effect: no live messages/typing/read-receipts in prod (REST
  send/fetch still worked, so chat looked "alive" but wasn't realtime). **Category:** dev-vs-prod path
  assumption.
  - *Fix:* extracted `socketConfig(base)` (`mobile/src/utils/net.js`) — path = `/api/socket.io` when
    BASE has an `/api` prefix (dev via nginx), else `/socket.io` (prod direct). `SocketContext` uses
    it. +3 unit tests. The server serves the default `/socket.io` (no custom path).
- **Missed messages on reconnect.** Socket.io does not redeliver events emitted while a client is
  offline, so a network blip silently dropped messages until the thread was reopened. `chat/[id]` now
  refetches the thread + re-marks read on every socket `connect` (covers reconnects and a socket that
  connects after the screen mounts). **Category:** realtime robustness.

### 2026-09-12 (upload-flow hardening pass — thumbnail derivation broke in prod)
- **Editing a listing in prod replaced every existing thumbnail with the full-res image URL.** Root
  cause: for already-hosted images, the thumbnail was derived only when the URL contained `/media/`
  (the dev path); prod URLs are absolute MinIO URLs (`…/zamin/properties/<id>.jpg`) with no `/media/`,
  so it fell back to the full image as its own thumbnail — a silent bandwidth/perf regression on
  every edit. **Category:** dev-vs-prod URL assumption.
  - *Fix:* extracted `thumbFor()` (`mobile/src/utils/property.js`) that detects our images by the
    stable `…/properties/<id>.jpg` key pattern (works dev + prod) and derives `_thumb.jpg`; external
    URLs unchanged. Used in `post.js`. +4 unit tests.
  - *Also verified this pass (prod, no code change needed):* public-read policy is applied
    (anon GET of a missing object → 404, bucket listing → 403); the queue already retries
    (`attempts: 3` + exponential backoff); `/process` binds each `base` to the presigning user.
    The presigned-PUT SigV4 round-trip through Railway's proxy is the one piece left to confirm
    on-device (couldn't test without exposing the prod secret).
  - *Guardrail (added above):* after a dev→cloud switch, grep the client for `/media`, `localhost`,
    `.railway.internal` assumptions.

### 2026-09-12 (geo/near-me leaked the proximity of `hidden` listings)
- **`hidden`-visibility listings surfaced in near-me search.** Root cause: `GET /properties?lat&lng`
  filters by the real coords + computes `distance_km`, then `redactLocation` nulls the distance for
  `hidden` listings — but returning the row *at all* leaks that it sits within `radius` of the search
  point, contradicting the privacy intent ("hidden → no coordinates AND no distance"). **Category:**
  authz / data exposure (location privacy).
  - *Fix:* exclude `hidden` listings from geo results unless the viewer owns them
    (`location_visibility IS DISTINCT FROM 'hidden' OR clerk_user_id = $viewer`), resolving `getAuth`
    up-front. Non-geo browse still lists them (without a pin). `backend/src/routes/properties.js`.
  - *How found:* the geo ordering test began failing once `seed-demo` added `hidden` listings near
    Bengaluru to the dev/test DB — the redacted `distance_km` (null→0) broke the sort assertion, which
    pointed straight at the leak. Also hardened that test to assert ordering on two *exact* rows it
    controls (privacy-coarsened `approximate` distances legitimately aren't strictly monotonic).
  - *Guardrail (added above):* redacting a field ≠ hiding the row.

### 2026-09-03 (mobile test setup surfaced two live parsing bugs)
- **`priceToRupees` returned null for every ₹-prefixed price.** Root cause: `parseFloat("₹2.4 Cr")`
  is `NaN` because the string starts with `₹`. Effect: **price-per-sqft and EMI estimate silently
  never rendered** on `PropertyCard` + property detail for essentially all real listings (DB stores
  `₹2.4 Cr`, `₹85 L`, …) and all seed data. **Category:** input parsing.
- **`areaToSqft` truncated comma'd areas.** `parseFloat("3,200 sq ft")` → `3` (stops at the comma),
  so a 3,200 sqft plot parsed as 3 sqft → ppsf failed its sanity cap → null. **Category:** input parsing.
  - *Fix (both):* a shared `parseAmount()` that strips the currency symbol + thousands commas, reads
    the first numeric token, and detects the unit suffix (spaced `85 L` **and** unspaced `22K`).
  - *How found:* writing the **first mobile unit tests** for these pure helpers (jest-expo). The tests
    asserted the documented behavior; the helpers didn't meet it. Exactly the point of the exercise.
  - *Guardrail (added above):* never `parseFloat` a display-formatted string directly.

### 2026-08-27 (authorization audit — security findings)
- **Unauthenticated PII exposure:** `GET /auth/resolve?username=` returned the account's **email**
  with no auth — username→email harvesting. Fix: removed the (unused) endpoint. **Category:** authz / data exposure.
- **Image tampering via `/process`:** image `base` paths are public (in listing URLs) and `/process`
  didn't check ownership, so any user could overwrite another listing's images. Fix: bind `base` to
  the presigning user (`pending_uploads`), verify + consume in `/process`. **Category:** authz / integrity.
  *Guardrail:* any endpoint that acts on a client-supplied storage key/path must verify the caller
  owns/created it — public identifiers are not authorization.

### 2026-08-19
- **Messages sent twice on the sender's screen** (receiver saw one; reload showed one). Root cause:
  optimistic message + the server's `message` **socket echo to the sender's own room** race. The
  socket appended the real message (real id) before the HTTP response replaced the optimistic
  (temp id) one → two copies of the same real id. Fix: on HTTP resolve, drop the optimistic and
  add the real only if not already present (dedupe by id). **Category:** optimistic-UI / socket echo.
  *Guardrail:* any optimistic send that also arrives via socket must reconcile by dropping the temp
  and de-duping the real id — never blindly `map(temp → real)`.
- **Chat back button "not working".** ⚠️ **Two-attempt fix — first root cause was WRONG.**
  - *First (incorrect) hypothesis:* always-mounted menu/report `Modal`s overlaying clicks →
    made them conditional. Valid cleanup, but the back button still didn't work → **disproved the
    overlay theory** (removing them changed nothing).
  - *Actual root cause:* `router.back()` is a **no-op when there's no history to pop** (reload /
    deep-link / notification straight onto a `/chat/...` URL, common on web). `onPress` was firing
    all along. Fix: `if (router.canGoBack()) router.back(); else router.replace("/messages")`.
  - **Lesson:** when a fix doesn't work, that *disproves* the hypothesis — don't ship the next guess
    without checking. A dead button is either (a) the handler not firing (overlay/pointerEvents) or
    (b) the handler firing but no-op'ing (navigation/history). Distinguish before fixing. **Category:** navigation / debugging discipline.
- **Quick-reply chips clipped / "half visible".** Root cause: a horizontal `ScrollView` with no
  fixed height collapses on web (earlier it was over-clipped by a too-small `maxHeight`). Fix:
  wrap the ScrollView in a fixed-height (58) `View`, chips vertically centered. **Category:** RN-web layout.
- **Quick-reply chips clipped / "half visible".** Root cause: a horizontal `ScrollView` with no
  fixed height collapses on web (earlier it was over-clipped by a too-small `maxHeight`). Fix:
  wrap the ScrollView in a fixed-height (58) `View`, chips vertically centered. **Category:** RN-web layout.

### 2026-08-12
- **Messages inbox flickering (render loop).** Root cause: new `load`/`markRead` callbacks depended
  on `useApi()` (not stable) → `useFocusEffect` re-ran every render. Fix: `apiRef` pattern.
  **Category:** useApi instability.

### 2026-08-11
- **Owner couldn't see buyer's name in chat.** Root cause: buyer identity read from `sender_name`,
  but legacy messages had it NULL. Fix: backfill `sender_name/avatar/image` from Clerk + worker
  self-heals. **Category:** denormalized data.
- **Messages not delivered both ways / two threads.** Root cause: receiver was always the owner, so
  owner replies were self-addressed (legacy self-messages formed a phantom thread). Fix: peer-aware
  conversations, self-message guard + repair migration. **Category:** messaging identity.

### 2026-08-05
- **Owner profile photo not visible on listings / to others.** Root cause: owner display data is
  denormalized on properties; the image was only on the Clerk user. Fix: `owner_image` column,
  propagate on create + reconcile; verified via public `GET /properties`. **Category:** denormalized data.
- **Username not shown on listings / profile / settings.** Root cause: read old
  `unsafeMetadata.username` instead of native `user.username`. Fix: read native, sync on reconcile.
  **Category:** denormalized data / field source.

### Earlier (from git history)
- Infinite loop in `useFocusEffect` (pinned api in a ref) — **Category:** useApi instability.
- Delete not working: 401 auth + web-safe confirmation — **Category:** auth/RN-web.
- Keyboard covering inputs on sign-in/sign-up/post — **Category:** RN-web layout.
