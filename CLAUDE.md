# CLAUDE.md — Zamin working guide

This file is loaded into context every session. Keep it **short and current**. Deep detail
lives in the linked docs; this is the map + the rules + the runbook.

## Read these first
- **`docs/ARCHITECTURE.md`** — full A–Z: stack, services, data model, auth, API, image pipeline. **The source of truth.**
- **`docs/ROADMAP.md`** — the end goal + backlog. Skim at the start of a session so we don't drift.
- **`CHANGELOG.md`** — what changed and why. Newest first.

## What Zamin is (one line)
Zero-brokerage property marketplace. Expo/React Native (iOS/Android/web) + Express API +
Postgres + Clerk auth + MinIO object storage + Redis/BullMQ image worker, all via Docker Compose.

## Working agreement (do this every change)
1. **Trace the ripple — every change.** Before calling a change done, find EVERY other place
   the touched thing is used and update/verify each, so a fix here doesn't leave a bug there.
   Ask: other screens/components reading the same field? API routes + DB columns (incl.
   **denormalized/stored** copies)? Shared utils/hooks? Both create *and* edit paths? web + native?
   - How: `grep -rn "<symbol/field>" mobile/app mobile/src backend/src` and read each hit.
   - Write the impact list in the CHANGELOG entry (which places were checked/updated).
   - Real example: the username-first change rippled to `profile.js`, `settings.js`, `post.js`,
     `PropertyCard`, property detail, chat, *and* denormalized `owner_name` rows in Postgres.
2. **Track everything.** After any feature/fix, add a dated entry to `CHANGELOG.md` (file + why).
   A change isn't done until it's built/validated **and** logged.
3. **Keep the docs true.** If you change architecture, endpoints, auth, or data model,
   update `docs/ARCHITECTURE.md` in the *same* change. Tick/adjust `docs/ROADMAP.md`.
4. **Validate before claiming done.** Compile the bundle (below) and/or hit the API. Report
   real results — if something failed or was skipped, say so.
5. **Security is a pillar, not a phase.** Check the ROADMAP security backlog; consider
   `/security-review` for anything touching auth, input, or data exposure.
6. **Prefer simple.** This project's guiding preference is minimal, obvious UX.
7. **Commit messages:** plain and simple, NO `Co-Authored-By` / Claude signature.

## Architecture guardrails (don't break these)
- Clerk `clerkMiddleware()` is **global** → invalid keys 500 even public routes. Keep keys valid.
- API auth guard must return **401 JSON, not a 302 redirect** (`middleware/auth.js`). The client
  uses `redirect: "manual"` in `useApi` for this reason. Don't "simplify" either away.
- Users live in **Clerk**, not Postgres. We only store `clerk_user_id`.
- Image bytes never flow through the API — presigned direct-to-storage + BullMQ worker.
- `react-native-maps` is web-stubbed; guard native map code.

## Runbook (local)

Start / status:
```bash
docker compose up --build -d      # first run may hit a transient npm error — retry
docker compose ps
```

Health check (all should be 200 except /saved which is 401 unauthenticated):
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/properties      # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/api/properties       # 200 (nginx)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/saved           # 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8081/status          # 200 (Metro)
```

Validate a client change compiles (no device needed) — catches JSX/syntax errors:
```bash
curl -s -o /tmp/b.js -w "HTTP %{http_code} | %{size_download}b\n" \
  "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=ios&dev=true&hot=false"
# 200 + multi-MB = OK. Small body containing "type":"error" = build failed.
```

Get the Expo **tunnel URL** (when `docker-compose.override.yml` runs tunnel mode):
```bash
curl -s -H "Expo-Platform: ios" http://localhost:8081 \
 | python3 -c "import sys,json,re;print('exp://'+(re.findall(r'[a-z0-9.-]+\.exp\.direct',json.dumps(json.load(sys.stdin)))or['?'])[0])"
```

Inspect live **Clerk config** (which attributes are required, password rules) without the dashboard:
```bash
pk=$(grep CLERK_PUBLISHABLE_KEY .env | cut -d= -f2)
domain=$(echo "${pk#pk_test_}" | base64 -d | sed 's/\$$//')
curl -s "https://$domain/v1/environment?_clerk_js_version=5" | python3 -m json.tool | less
# user_settings.attributes[*].{enabled,required} ; user_settings.password_settings.{min_zxcvbn_strength,disable_hibp}
```

Create a **test user** (username-only) via Clerk Backend API:
```bash
sk=$(grep CLERK_SECRET_KEY .env | cut -d= -f2)
curl -s -X POST https://api.clerk.com/v1/users -H "Authorization: Bearer $sk" \
  -H "Content-Type: application/json" -d '{"username":"zamintest02","password":"<strong-unbreached-pw>"}'
```

## Current Clerk config expectations (username-first)
`username` + `password` required; `phone` optional (or off); `email` off. If username-only
signup returns `missing_requirements`, an identifier is wrongly marked *required* in the dashboard.

## Existing test account
`@zamintest01` / `River-Trail-9284` (created 2026-08-04 to verify profile username display).
