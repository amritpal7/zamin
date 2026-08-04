# Changelog

All notable changes to Zamin are recorded here. **Newest first.**

Format: each entry is dated and tagged `Added` / `Changed` / `Fixed` / `Removed` /
`Security` / `Docs` / `Ops`. Keep entries short but specific — name the file(s) and the
*why*, not just the *what*. Update this file **in the same change** that makes the edit.

> Convention: an entry is not "done" until it's (a) built/validated and (b) logged here.

---

## [Unreleased]

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
</content>
