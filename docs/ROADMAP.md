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
- [~] **Owner liveness / flag deleted accounts:** DONE — `owner_active` flag on properties,
      reconciled against Clerk (deleted account → 404 → flagged), surfaced in listings, detail,
      chat, and inbox. Next: **automate** via a Clerk `user.deleted` webhook or a scheduled
      reconcile (currently run on demand via `POST /properties/reconcile-owners`).
- [ ] **Confirm authorization on `saved`/`messages` routes** — ensure every handler enforces
      the Clerk user and ownership (audit `getAuth` usage).

## Near term (weeks)

- [~] **Automated tests.** ✅ API smoke suite done (`backend/tests/api.test.js`, Jest +
      Supertest: auth guards, ownership, CRUD). Next: validation/edge cases, `saved`/`messages`
      happy-path, and CI to run it automatically. No client/mobile tests yet.
- [x] **Input validation** on write endpoints (required fields, enums, lengths, ranges,
      UUID params) → 400 with `errors[]`. `backend/src/validation.js` + 8 tests. *(2026-08-04)*
- [ ] **Pagination + server-side search** on `GET /properties` (before the table grows).
- [~] **Chat**: real conversations inbox + notifications + Inquiries stat now live (`GET /messages`).
      Next: real-time delivery (Socket.io / Supabase Realtime) + **unread badges** (needs a
      `read_at`/`last_read` column — none exists yet).
- [ ] **Push notifications** (Expo + FCM/APNs) for new messages & saved-listing price drops.
- [ ] **Migration tooling** — replace the hand-rolled `migrate()` with a real tool
      (node-pg-migrate / drizzle / prisma-migrate).

## Medium term (1–3 months)

- [ ] **Owner/listing verification** (phone/email/ID) → trust badge (`verified` column already exists).
- [ ] **Geo "near me" search** (PostGIS `ST_DWithin`) + map clustering.
- [ ] **Saved-search alerts** — persist filters, notify on new matches.
- [ ] **In-app visit scheduling** (request/confirm viewing slots).
- [ ] **Price insights** (avg ₹/sqft for area, price history, "good deal" flag).
- [ ] **Reviews / reporting** — rate owners, flag suspicious listings, moderation queue.

## Security backlog (ongoing — never "done")

- [ ] Rate limiting on API (esp. auth + messaging endpoints).
- [ ] CORS: lock `origin: "*"` down to known origins in prod.
- [ ] Secrets management — no secrets in git; verify `.env` is git-ignored.
- [ ] Object storage: private buckets + short-lived signed GET URLs where appropriate.
- [ ] Authorization audit — every route checks ownership, not just authentication.
- [ ] Dependency scanning (npm audit / Dependabot) in CI.
- [ ] Structured error handling — never leak stack traces / internal messages to clients in prod.
- [ ] Run `/security-review` before each significant merge.

## Platform / scale (later)

- [ ] CI/CD pipeline (lint, test, build, deploy).
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
