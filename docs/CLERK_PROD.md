# Zamin — Production Clerk setup

Phase 2 of `LAUNCH.md`. The backend + app currently run on the **dev** Clerk instance
(`pk_test_/sk_test_`). This is the turnkey path to a **production** instance.

> **Status: blocked on a domain.** A Clerk production instance requires a custom domain you
> control DNS for — Clerk serves its Frontend API from `clerk.<yourdomain>` and needs DKIM
> records for email. A `*.railway.app` / `*.vercel.app` subdomain will **not** work. Everything
> below is ready to run the moment you have a domain.

## Decisions locked in (this session)
- **Username + password only.** No Google/social for launch (the app has **no** Google
  sign-in button, so this is invisible to users). Google can be added later via a Clerk
  dashboard toggle + Google Cloud OAuth creds — no app rebuild needed.
- Mirror the current dev config exactly (read from the live dev instance):
  - `username` — **on + required**, used as the sign-in first factor
  - `password` — **on + required** (zxcvbn min strength **2**, HIBP breach-check **on**)
  - `first_name` / `last_name` — on, optional
  - `email` / `phone` — **off** (not identifiers, not required)

## Step 0 — get a domain (the blocker)
Buy one (~$10/yr; Cloudflare/Namecheap/etc.) — you'll also want it for the API
(`api.<domain>`) and images (`cdn.<domain>`). Then continue.

## Step 1 — create the production instance
Clerk dashboard → the Zamin app → **top-left instance switcher → Production** (a.k.a.
"Deploy to production"). It seeds prod from your dev settings as a starting point.

## Step 2 — add your domain + DNS records
In the prod instance → **Domains**, enter your domain. Clerk shows the exact records to add
at your registrar — typically:
```
clerk.<domain>            CNAME  frontend-api.clerk.services
accounts.<domain>         CNAME  accounts.clerk.services
clk._domainkey.<domain>   CNAME  (DKIM target Clerk shows)
clk2._domainkey.<domain>  CNAME  (DKIM target Clerk shows)
clkmail.<domain>          CNAME  (email target Clerk shows)
```
Add them, then wait for Clerk to verify (DNS propagation: minutes–hours).

## Step 3 — match auth settings (User & Authentication)
- **Username:** on + required; set as the identifier / first factor.
- **Password:** on + required; min zxcvbn strength 2; keep breach protection (HIBP) on.
- **Name:** first/last optional (or off).
- **Email / Phone:** off. ⚠️ If you later turn on email *verification*, this plan forces an
  email-code 2FA — see `docs/BUGLOG.md` before enabling.
- **Social → Google:** leave **off**.

## Step 4 — copy the live keys
Prod instance → **API Keys** → copy `pk_live_…` and `sk_live_…`.

## Step 5 — hand me the keys; I do the wiring
Give me `pk_live_…` + `sk_live_…` and I'll:
1. **Railway `api` service** → set `CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` to the live
   values → redeploy. (Global `clerkMiddleware()` means keys must be valid or all routes 500.)
2. **`mobile/eas.json`** → set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` to `pk_live_…` in the
   `preview` + `production` profiles.
3. **Re-seed demo owners into prod** — Clerk users are **per-instance**; the dev-instance
   accounts (`demo_*`, `@zamintest01`) do **not** carry over. Re-run `seed-demo.js` against prod
   with the live secret key (via the worker one-off in `DEPLOY.md`).
4. **Verify** — sign up + sign in against prod; confirm `/saved` (auth-gated) works with a
   real token.

## Gotchas
- **No user migration dev→prod.** Prod starts with an empty user pool; the re-seed recreates
  the demo owners. Any real testers must sign up fresh on prod.
- The dev instance keeps working for local development — only the deployed API + built app
  move to prod keys.
