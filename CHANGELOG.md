# Changelog

All notable changes to Zamin are recorded here. **Newest first.**

Format: each entry is dated and tagged `Added` / `Changed` / `Fixed` / `Removed` /
`Security` / `Docs` / `Ops`. Keep entries short but specific — name the file(s) and the
*why*, not just the *what*. Update this file **in the same change** that makes the edit.

> Convention: an entry is not "done" until it's (a) built/validated and (b) logged here.

---

## [Unreleased]

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
