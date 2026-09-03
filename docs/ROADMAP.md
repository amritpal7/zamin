# Zamin — Roadmap & Backlog

> The **end goal** and the path to it. Review this at the start of a work session so we
> don't drift. Move items between sections as they progress. When a backlog item ships,
> log it in `CHANGELOG.md` and check it off here.

---

## North star

A **feature-full, secure, genuinely usable** zero-brokerage property marketplace where
owners and buyers connect directly with trust and zero friction.

Three pillars we judge every change against:
1. **Usability** — fast, obvious, low-friction on iOS/Android/web.
2. **Security & trust** — auth, authorization, input validation, no data leaks, verified users.
3. **Feature completeness** — the workflows a real marketplace needs (search, contact, manage, get notified).

---

## Now (in progress / next up)

- [ ] **Auth polish (username-first).** Done: username/phone toggle, profile username fix.
      Next: decide final Clerk password policy (relax zxcvbn + HIBP for dev; re-tighten for prod).
- [ ] **Add + verify email/phone in Profile settings** (moved out of signup by design).
      **Unblocks password reset** — the reset flow (`forgot-password.js`) already exists but
      can't work until accounts have a verified contact method.
- [ ] **Password reset — DEFERRED (UI already built):** turn it on once add-email/phone lands.
      Enable "reset password" + a contact method in Clerk. Tracked here so we don't lose it.
- [x] **Owner liveness / flag deleted accounts:** DONE — `owner_active` flag on properties,
      reconciled against Clerk (deleted account → 404 → flagged), surfaced in listings, detail,
      chat, and inbox. **Now automated**: the worker runs a scheduled reconcile every
      `RECONCILE_INTERVAL_MS` (default 6h) + on boot; `POST /properties/reconcile-owners` still
      available for on-demand. Optional future: Clerk `user.deleted` webhook for instant flags.
- [~] **Profile pictures** — users can set a Clerk profile photo from Settings; shown in
      Profile + Settings. ✅ verified on **web** (2026-08-05). ⏳ **TODO: verify the upload on
      the mobile/native app** — Clerk `setProfileImage` may reject the RN `Blob`; if so, pass
      the picked asset as `{ uri, name, type }` / FormData instead. **← remind the user.**
- [ ] **Confirm authorization on `saved`/`messages` routes** — ensure every handler enforces
      the Clerk user and ownership (audit `getAuth` usage).

## Near term (weeks)

- [~] **Automated tests.** ✅ API smoke suite (`backend/tests/api.test.js`, Jest + Supertest: auth
      guards, ownership, CRUD, geo). ✅ First **mobile** unit tests (2026-09-03, `jest-expo`) for pure
      helpers (`utils/cluster`, `utils/property`) — both CI jobs (`backend-tests` + `mobile-tests`)
      gate merges. Next: component tests (PropertyCard, chat), more edge cases.
- [x] **Input validation** on write endpoints (required fields, enums, lengths, ranges,
      UUID params) → 400 with `errors[]`. `backend/src/validation.js` + 8 tests. *(2026-08-04)*
- [ ] **Pagination + server-side search** on `GET /properties` (before the table grows).
- [x] **Chat — real-time + read receipts** (2026-08-11): Socket.io on the API, instant delivery,
      ✓/✓✓ read receipts (`read_at`), unread badges, typing indicator. Inbox/chat update live.
      Next for chat: **push notifications** (Expo + FCM/APNs) so replies land when the app is
      closed; `@socket.io/redis-adapter` when we run multiple API instances; then Tier-2
      marketplace actions (schedule a visit, make an offer, photo attachments).
- [ ] **Push notifications** (Expo + FCM/APNs) for new messages & saved-listing price drops.
- [ ] **Migration tooling** — replace the hand-rolled `migrate()` with a real tool
      (node-pg-migrate / drizzle / prisma-migrate).

## Medium term (1–3 months)

- [ ] **Owner/listing verification** (phone/email/ID) → trust badge (`verified` column already exists).
- [x] **Geo "near me" search** (2026-08-27) — `GET /properties?lat&lng&radius` via a **Haversine
      distance in plain SQL** (skipped the PostGIS dependency), nearest-first + `distance_km`.
      Discover "Near me" toggle (`expo-location`) + distance chip on cards.
- [x] **Map clustering** (2026-09-03) — grid clustering in a pure helper (`src/utils/cluster.js`),
      no extra native dep; Map tab loads live listings, collapses nearby pins into a count bubble
      that splits on zoom.
- [x] **Saved-search alerts** (2026-08-27) — `saved_searches` + a real `notifications` store; new
      matching listing → in-app notification (+ push). Discover "Save this search" + manager screen.
- [ ] **In-app visit scheduling** (request/confirm viewing slots).
- [ ] **Price insights** (avg ₹/sqft for area, price history, "good deal" flag).
- [ ] **Reviews / reporting** — rate owners, flag suspicious listings, moderation queue.

## Postponed (revisit later — not blocking)
- [ ] **EAS development build** — needed to actually *receive* push notifications on device
      (code is done; Expo Go SDK 53+ can't receive remote push). Steps: `eas build:configure` →
      set `extra.eas.projectId` in `app.json` → `eas build --profile development` → install.
      Parked 2026-08-18 to keep moving on features testable in Expo Go/web.

## Chat enhancements (forecast — discussed 2026-08-11)

The plan for taking chat further, tiered by user value. Tier 1 foundation is done.

**Tier 1 — feel like real chat**
- [x] Real-time delivery, read receipts (✓/✓✓), unread badges, typing indicator (Socket.io).
- [x] **Push notifications** (2026-08-12) — `expo-notifications` + Expo Push; message replies
      notify the recipient, taps open the chat, in-chat banners suppressed. Needs a **dev build**
      to actually receive (Expo Go SDK 53+ dropped remote push); no-ops safely in Expo Go/web.
- [ ] `@socket.io/redis-adapter` once we run multiple API instances (Redis already available).

**Tier 2 — move the deal forward (marketplace differentiators)**
- [x] **📅 Schedule a visit + 💰 Make an offer** (2026-08-18) — unified **proposal** system
      (visit=`when`, offer=`amount`) as structured messages. Recipient can **Accept / Decline /
      Counter** — countering (e.g. owner suggests another time, or a counter-offer) marks the
      original `countered` and sends a fresh proposal back immediately. Inline cards + day/time
      and amount pickers (no native deps → web + Expo Go); live via `message-update` sockets.
- [x] **📷 Photo attachments** (2026-08-19) — send photos in chat (`type='image'`, `meta={url,thumb}`)
      reusing the presigned MinIO + sharp pipeline. Purpose: request/share specific property
      photos + documents in the broker-less flow. (Doc files / PDFs = future extension.)
- [x] **⚡ Quick replies** (2026-08-19) — context-aware canned chips (buyer vs owner) above the
      composer; one tap to send. Client-only.
- [ ] Richer property context in the chat header (live price, "still available" badge).

**Tier 3 — trust & safety (given fake-account concerns)**
- [x] **Report / block user** (2026-08-19) — `blocks`+`reports` tables, `/users/:id/block|report`,
      messaging rejected 403 when either party blocked the other; chat header menu + blocked banner.
- [x] **Verified badge** in the chat header (2026-08-19) — shows when the peer owns a verified listing.
- [ ] Contact-reveal controls (e.g. show phone only after a chat starts).
- [ ] Moderation: auto-flag/hide after N reports; an admin review surface for `reports`.

**Resources / approach (for reference)**
- Real-time: Socket.io on our Express API (chosen — we own the stack); Supabase Realtime / Stream
  Chat are managed alternatives.
- Push: `expo-notifications` + Expo Push service.
- Offers / visits / receipts / attachments: Postgres tables + the existing image pipeline — no new infra.

## Security backlog (ongoing — never "done")

- [x] Rate limiting on API (2026-08-19) — `express-rate-limit`, 600/min per IP, `trust proxy`.
- [x] CORS configurable (2026-08-19) — `CORS_ORIGIN` env (default `*` dev; set known origins in prod).
- [x] Structured error handling (2026-08-19) — prod-safe handler, no stack/message leak.
- [x] Security headers (2026-08-19) — `helmet`.
- [x] Dependency scanning (2026-08-19) — `npm audit` in CI.
- [ ] Secrets management — `.env` is git-ignored ✓; add secret scanning.
- [ ] Object storage: private buckets + short-lived signed GET URLs where appropriate.
- [x] Authorization audit (2026-08-27) — reviewed all routes; fixed unauth email-by-username leak
      (`/auth/resolve` removed) and `/process` image-tampering (base bound to user). Rest sound.
- [ ] Run `/security-review` before each significant merge.

## Platform / scale (later)

- [~] CI/CD: GitHub Actions runs API tests (Postgres+Redis) + `npm audit` on push/PR (2026-08-19).
      Next: lint, build, deploy stages.
- [ ] Prod object storage (S3/R2) via `S3_*` env swap.
- [ ] Observability — logs/metrics/error tracking (Sentry).
- [ ] Standalone app builds (EAS) for App Store / Play Store.

---

## Decision log (why we chose things)

- **Clerk for auth** — offload identity/security; store only `clerk_user_id`.
- **Username-first onboarding** — fastest multi-user testing; email/phone optional.
- **Presigned direct-to-storage uploads + BullMQ worker** — keep API stateless/fast, storage swappable.
- **MinIO in dev** — S3-compatible, swap to S3/R2 in prod via env only.
- **nginx single entry** — one origin for `/api` and `/media`.
