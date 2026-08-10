# Changelog

All notable changes to Zamin are recorded here. **Newest first.**

Format: each entry is dated and tagged `Added` / `Changed` / `Fixed` / `Removed` /
`Security` / `Docs` / `Ops`. Keep entries short but specific — name the file(s) and the
*why*, not just the *what*. Update this file **in the same change** that makes the edit.

> Convention: an entry is not "done" until it's (a) built/validated and (b) logged here.

---

## [Unreleased]

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
