# Zamin — Architecture & System Reference (A–Z)

> **Single source of truth** for how Zamin is built and how data flows through it.
> Keep this file accurate. If you change architecture, update this file in the same change.
> Last verified against code: **2026-08-04**.

---

## 1. What Zamin is

Zamin is a **zero-brokerage property marketplace**. Users browse houses & land, and
contact owners directly (chat / call) — no middlemen. It is a cross-platform app:
one Expo/React Native codebase runs on **iOS, Android, and web**.

**Core value:** free listings, 0% brokerage, direct owner contact.

---

## 2. High-level architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Expo RN)                          │
│  iOS · Android · Web   —   expo-router file-based navigation      │
│  Auth: Clerk (@clerk/clerk-expo)   Data: useApi() fetch wrapper   │
└───────────────┬─────────────────────────────────────────────────┘
                │ HTTPS  (Bearer <Clerk JWT>)
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    nginx  (:80)  reverse proxy                     │
│   /api/*   → api:4000        /media/*  → minio (object storage)    │
└───────────────┬─────────────────────────────────────────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
┌───────────────┐  ┌──────────────────────────────────────────────┐
│  Express API  │  │  MinIO (S3-compatible object storage)         │
│   (:4000)     │  │  raw uploads + resized images + thumbnails    │
│  Clerk auth   │  └──────────────────────────────────────────────┘
│  guards       │                 ▲
└───┬───────┬───┘                 │ resize/thumbnail (sharp)
    │       │                     │
    ▼       ▼              ┌──────┴───────┐   ┌──────────────┐
┌────────┐ ┌──────────┐    │   Worker     │◀──│    Redis     │
│Postgres│ │  Redis   │    │  (BullMQ     │   │ (BullMQ queue│
│ (:5432)│ │ (queue)  │    │   consumer)  │   │  backend)    │
└────────┘ └──────────┘    └──────────────┘   └──────────────┘
```

**Users are owned by Clerk** (not in our DB). Our Postgres only stores `clerk_user_id`
as a foreign-key-like reference on every row.

---

## 3. Tech stack

| Layer | Tech |
|-------|------|
| Mobile/Web client | Expo SDK 54, React Native, expo-router, react-native-web |
| Auth | Clerk (`@clerk/clerk-expo` on client, `@clerk/express` on API) |
| API | Node + Express |
| Real-time | Socket.io on the API (`/api/socket.io` via nginx); client `socket.io-client` |
| Database | PostgreSQL 16 |
| Object storage | MinIO (S3-compatible; swappable for AWS S3 / Cloudflare R2 via env only) |
| Job queue | BullMQ on Redis 7 |
| Image processing | sharp (resize + thumbnail), in the worker |
| Reverse proxy | nginx |
| Orchestration | Docker Compose (dev + prod override) |
| Fonts/UI | Geist, Instrument Serif; custom "Neo" component kit; amber theme |

---

## 4. Services (docker-compose.yml)

| Container | Service | Port(s) | Role |
|-----------|---------|---------|------|
| `zamin_api` | api | 4000 | Express REST API; runs idempotent migrations + ensures storage bucket on boot |
| `zamin_worker` | worker | — | BullMQ consumer; image resize/thumbnails (sharp) + scheduled reconcile: owner-liveness + message sender-identity backfill (needs `CLERK_SECRET_KEY`) |
| `zamin_redis` | redis | 6379 (internal) | BullMQ job queue backend |
| `zamin_minio` | minio | 9000 (S3 API), 9001 (console) | Object storage for images |
| `zamin_db` | db | 5432 | PostgreSQL; auto-runs `backend/db/init.sql` on first boot |
| `zamin_nginx` | nginx | 80 | Reverse proxy: `/api`→api, `/media`→minio |
| `zamin_mobile` | mobile | 8081, 19000, 19001 | Expo Metro bundler (dev) |

`docker-compose.override.yml` (local-only, git-ignored candidate) switches the mobile
service to **tunnel mode** (`expo start --tunnel`) so a physical phone can connect over
any network. Remove/rename it to go back to LAN mode.

---

## 5. Data model (`backend/db/init.sql`)

Three tables. Clerk owns identity; we key everything by `clerk_user_id VARCHAR(255)`.

### `properties`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | `uuid_generate_v4()` |
| clerk_user_id | VARCHAR | owner (Clerk user id) |
| owner_name, owner_phone, owner_avatar | VARCHAR | denormalized owner display |
| title, description | VARCHAR/TEXT | |
| type | VARCHAR | House \| Apartment \| Land \| Commercial |
| status | VARCHAR | For Sale \| For Rent |
| price, area | VARCHAR | free-text (e.g. "₹2.4 Cr", "3,200 sq ft") |
| beds, baths | INTEGER | nullable (land has none) |
| location | VARCHAR | human-readable |
| latitude, longitude | DECIMAL(10,7) | for map |
| tags | TEXT[] | e.g. {Pool, Garden} |
| img, color | VARCHAR | emoji + accent color fallback |
| images, thumbnails | TEXT[] | object-storage URLs (added via migration) |
| verified | BOOLEAN | **owner-level trust badge, server-authoritative.** Set from the owner's Clerk account (≥1 verified email/phone) on create + kept in sync across all their listings by `reconcileOwners`. Never trusted from the client. Seed rows keep their init.sql values (reconcile skips `seed_user_*`) |
| owner_active | BOOLEAN | false = owner's Clerk account no longer exists (reconciled). **Soft-hide:** false rows are excluded from `GET /properties` + `GET /saved` (data retained, reachable by direct id) |
| owner_image | TEXT | owner's Clerk profile photo URL (denormalized; set on create + reconcile) |
| location_visibility | VARCHAR | `exact` \| `approximate` \| `hidden`. **Server-enforced privacy** (`locationPrivacy.js`): reads redact non-owners' coords — `approximate` returns a deterministic ~400m jitter (+`location_precision`/`location_radius_m`), `hidden` returns null lat/lng and null `distance_km`. Owner always sees exact. Per-listing (Post/Edit) with a global default in Clerk `publicMetadata.default_location_visibility` (bulk-set via `PUT /properties/location-visibility`) |
| photo_geo | JSONB | Per-photo capture metadata `[{url,lat,lng,at,source,on_site}]` for on-site verification (`photoTrust.js`). **Server-authoritative** `on_site` (camera photo within ~150m of the pin; auto-pins the listing from the first on-site capture when no pin). **Capture coords are redacted for non-owners** → they see only `[{url,on_site}]` (`locationPrivacy.sanitizePhotoGeo`) |
| on_site_verified | BOOLEAN | derived: ≥1 on-site photo → **"Verified on-site" badge**. Anti-fraud (fake listings reuse stock photos). Client can't self-assign |
| parcel | JSONB | Land plot boundary polygon `[{lat,lng},…]`. **Redacted for non-owners unless `location_visibility='exact'`** (reveals the exact outline). Drawn in Post, rendered on the detail-screen map |
| created_at, updated_at | TIMESTAMPTZ | |

Indexes: `type`, `status`, `clerk_user_id`.

### `saved_properties`
Bookmarks. `UNIQUE(clerk_user_id, property_id)`, `property_id` FK → properties (ON DELETE CASCADE). Index on `clerk_user_id`.

### `saved_searches` / `notifications`
**Saved-search alerts.** `saved_searches (clerk_user_id, name, type, status, search)` — a buyer's
filters. On `POST /properties`, `notifyListingMatch` (`src/notify.js`) finds saved searches that
match (type/status wildcard-or-equal + free-text in title/location, owner excluded) and writes a
`notifications` row (+ push). `notifications (clerk_user_id, type, title, body, data, read_at)` is
the app's notification feed (`new_message` + `listing_match`); `GET /notifications` (+ unread),
`POST /notifications/read`. Endpoints: `/saved-searches` (POST/GET/DELETE), `/notifications`.

### `visits`
**In-app visit scheduling** (first-class booking, distinct from the informal in-chat visit
*proposal*). `visits (property_id, requester_id, owner_id, slot, note, status)` where status is
`pending → confirmed | declined | cancelled`. `routes/visits.js` at `/visits`: `POST /` (buyer books
a slot — owner derived from the property; rejects your own listing, past/invalid slots, blocked
users), `GET /` (mine as requester **or** owner, upcoming-first, with a `role` + listing title/img),
`POST /:id/respond {confirmed|declined}` (owner-only, pending-only), `POST /:id/cancel` (either
participant). Each transition writes a `notifications` row (type `visit`, `data.kind:"visit"`) + push;
taps route to the `/visits` screen. Indexes on `(owner_id, slot)` and `(requester_id, slot)`.

### `blocks` / `reports`
Trust & safety. `blocks (blocker_id, blocked_id)` — messaging is rejected (403) when either
party has blocked the other (`src/blocks.js`, enforced in message/proposal sends). `reports
(reporter_id, reported_id, property_id, reason)` — a moderation queue. Endpoints under `/users`:
`POST/DELETE /:id/block`, `GET /:id/block`, `POST /:id/report`.

### `push_tokens`
Expo push tokens per user for notifications. `token` PK, `clerk_user_id`, `updated_at`. One user
may have several devices. Registered via `POST /push/register`; a message send notifies the
recipient via the Expo Push API (`backend/src/push.js`). Remote push needs a **dev build**
(Expo Go SDK 53+ dropped it); no-ops safely otherwise.

### `messages`
1:1 chat between two users about a property. `property_id` FK (CASCADE), `sender_id`,
`receiver_id` (both Clerk ids), `text`, `created_at`, plus denormalized sender identity
`sender_name` / `sender_avatar` / `sender_image` (so the inbox/chat can show who wrote).
Index on `property_id`. **Invariant:** `sender_id <> receiver_id` (enforced in the route;
legacy self-messages repaired by migration). A conversation = (property, peer) where peer is
"the other person"; the receiver is always the peer, never yourself. `read_at` (nullable) drives
read receipts + unread counts. `type` (`text`|`visit`|`offer`|`image`) + `meta` JSONB. An **image** message carries
`meta={ url, thumb }` (uploaded via the existing presigned MinIO + sharp pipeline, sent through
`POST /messages` with an `image` body). Structured **proposals** — a visit
(`meta.when`) or an offer (`meta.amount`), `meta.status` = pending|accepted|declined|countered.
Endpoints (all under `/messages`): `POST /:propertyId/proposal { kind, receiver_id, value }`
create; `POST /proposal/:id/respond { status }` accept/decline (recipient only); `POST
/proposal/:id/counter { value }` marks the original `countered` and sends a fresh proposal back
to the proposer. Status changes emit a `message-update` socket event.

### Real-time (`backend/src/realtime.js`)
Socket.io attaches to the HTTP server. Each client authenticates with its Clerk session token
(`@clerk/backend` `verifyToken`) and joins a personal room keyed by its Clerk id. Events:
`message` (emitted by `POST /messages` to both participants), `read` (emitted by the mark-read
route → flips the sender's ticks to ✓✓), `typing` (ephemeral, relayed to the peer). Reached at
`/api/socket.io` (nginx already forwards WS upgrades). Single-node today; add
`@socket.io/redis-adapter` (Redis is already running) to scale to multiple API instances.

> **Migrations today:** there is no migration framework. `backend/src/index.js` runs a
> hand-written idempotent `migrate()` on boot (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
> plus a seed-image backfill. New schema changes should follow the same idempotent pattern
> *or* we introduce a real migration tool (see ROADMAP).

---

## 6. Authentication flow (Clerk)

**Clerk is the identity provider.** No passwords or sessions live in our DB.

### Client
- `mobile/app/_layout.js` wraps the app in `<ClerkProvider>` and mounts `<AuthGuard>`.
- `AuthGuard` watches `isSignedIn`:
  - not signed in + on a protected route → `router.replace("/sign-in")`
  - signed in + on sign-in/sign-up → `router.replace("/(tabs)/discover")`
- `useApi()` calls `getToken()` and attaches `Authorization: Bearer <JWT>` to every request.

### API
- `app.use(clerkMiddleware())` in `index.js` runs on **every** request and attaches auth state.
  - ⚠️ Because it's global, an **invalid publishable key breaks even public routes** (returns 500). Keys must be valid.
- `middleware/auth.js` exposes `requireAuth` — returns **401 JSON** (never a 302 redirect, which would break `fetch`).
- `properties` routes use `requireAuth` explicitly on write/owner routes. `saved` and `messages` handlers read the user from Clerk's `getAuth(req)` context.

### Sign-up / Sign-in (current design — username-first)
- **Sign up** (`app/sign-up.js`): a **Username ↔ Phone** method toggle (default Username).
  - Username: `username + password` → account created instantly (no verification).
  - Phone: `phone + password` → SMS OTP → verify.
- **Sign in** (`app/sign-in.js`): same **Username ↔ Phone** toggle (default Username).
  - Username: `username + password`.
  - Phone: passwordless — number → SMS OTP (`prepareFirstFactor`/`attemptFirstFactor`).
- Email removed from auth entirely (planned to move to profile settings later).
- Phone numbers normalized to **E.164**, defaulting to **+91 (India)**.
- **Password reset** (`app/forgot-password.js`, linked from sign-in): sends a reset code to
  the account's verified email/phone, then sets a new password. ⚠️ Only works if the account
  has a verified email or phone and "reset password" is enabled in Clerk — username-only
  accounts with no contact method can't reset until they add one.

### ⚠️ Clerk Dashboard config this design REQUIRES
In dashboard.clerk.com → **User & Authentication → Email, Phone, Username**:
- **Username** = enabled + required (it's the primary identifier)
- **Password** = enabled + required
- **Phone** = enabled but *optional* (or fully off if not offering phone)
- **Email** = off (or optional)
- If email/phone is marked **required**, username-only signup fails with `missing_requirements`.

Password strength lives in **Password settings**:
- `min_zxcvbn_strength` (0=off … 4=strong)
- `disable_hibp` (breach/HaveIBeenPwned check; `false` = check is ON = rejects breached passwords)

You can inspect live Clerk config without the dashboard by decoding the Frontend API
domain from the publishable key and hitting `/v1/environment` (see `docs/RUNBOOK` notes
in CLAUDE.md).

---

## 7. API reference

Base path through nginx: `/api`. Direct: `http://localhost:4000`.

### Properties (`routes/properties.js`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/properties` | public | List (paginated): `?limit`(1–100,def 24)`&offset` + `?type&status&search` + geo `?lat&lng&radius`. Returns `{items,total,limit,offset,hasMore}`; per-listing location redacted |
| GET | `/properties/:id` | public | Single property |
| GET | `/properties/:id/insights` | public | Price insights: listing ₹/sqft vs area median of comparable listings (same type+status+locality) → verdict good_deal/at_market/above_market/insufficient (`insights.js`) |
| POST | `/properties/:id/report` | 🔒 | Flag a listing (dedup per reporter); auto-hides (`flagged`) after 3 distinct reporters |
| GET | `/properties/moderation` | 🔒 admin | Moderation queue: reported listings + reporter counts/reasons |
| POST | `/properties/:id/moderate` | 🔒 admin | Hide/restore a listing (`flagged`) |
| GET | `/properties/mine` | 🔒 | Current user's listings |
| POST | `/properties` | 🔒 | Create listing |
| PUT | `/properties/:id` | 🔒 owner | Update listing |
| DELETE | `/properties/:id` | 🔒 owner | Delete listing |
| POST | `/properties/presign` | 🔒 | Get presigned upload URLs (direct-to-storage) |
| POST | `/properties/process` | 🔒 | Enqueue resize/thumbnail job for uploaded originals |
| POST | `/properties/upload` | 🔒 | (legacy/alt) multipart upload path |
| POST | `/properties/reconcile-owners` | 🔒 | Admin-only. Check **every** owner against Clerk, set `owner_active`/`verified` (fans out one Clerk call per owner; also scheduled in the worker) |
| POST | `/properties/reconcile-me` | 🔒 | Self-serve. Reconcile **only the caller's own** listings from Clerk (one call). Used after verifying email to propagate the trust badge to their listings immediately |
| PUT | `/properties/location-visibility` | 🔒 | Set location privacy (`exact`/`approximate`/`hidden`) on **all** the caller's listings + store it as their default (Clerk `publicMetadata`) for new listings |

### Saved (`routes/saved.js`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/saved` | My saved properties |
| POST | `/saved/:propertyId` | Save |
| DELETE | `/saved/:propertyId` | Unsave |

### Messages (`routes/messages.js`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/messages` | List conversations, grouped by (property, **peer**); returns `peer_id` per row |
| GET | `/messages/:propertyId?peer=<id>` | The two-person thread (me ↔ peer); without `peer`, all my messages on the property |
| POST | `/messages/:propertyId` | Send message (`{ text, receiver_id }`) — receiver is the **peer**, not always the owner |

### Users / trust & safety (`routes/users.js`, all 🔒)
| Method | Path | Purpose |
|--------|------|---------|
| POST/DELETE | `/users/:id/block` | Block / unblock (messaging then rejected 403 either way) |
| GET | `/users/:id/block` | `{ blockedByMe, blockedMe }` |
| POST | `/users/:id/report` | File a report (moderation queue) |

### Misc
- `GET /health` → `{ status: "ok" }`
- `GET /uploads/*` → static files (legacy local upload dir)

### Input validation (`backend/src/validation.js`)
Write endpoints validate their payloads **after** auth and return **400** with an `errors[]`
list on failure:
- `validateProperty` — required fields (title/price/location, +owner_name on create),
  `type`/`status` enums, string length caps, integer ranges (beds/baths 0–100), coordinate
  ranges, string-array checks (tags/images/thumbnails). Used by `POST` + `PUT /properties`.
- `validateMessage` — non-empty `text` (≤2000) + `receiver_id`. Used by `POST /messages`.
- `isUuid` — guards `:id`/`:propertyId` params on property/saved/message writes, returning
  400 instead of letting a malformed UUID hit Postgres as a 500.

---

## 8. Image pipeline (scalable, bytes never touch the API)

Defined in `mobile/src/hooks/useApi.js#uploadImages` + `routes/properties.js` + `worker.js`.

1. Client asks API for **presigned URLs**: `POST /properties/presign { count }` (each `base` is
   bound to the requesting user in `pending_uploads`).
2. Client **PUTs each file straight to MinIO** using the signed URL (API never proxies bytes).
3. Client calls `POST /properties/process { items:[{base, origKey}] }` → API verifies the caller
   presigned each `base` (else skipped) then **enqueues a BullMQ job**.
4. **Worker** (`worker.js`) consumes the job, uses **sharp** to resize + build a thumbnail, writes them back to storage.
5. Final URLs (`{ url, thumb }`) are stored on the property (`images[]`, `thumbnails[]`) and served via nginx `/media`.
6. Client keeps an **optimistic local mapping** (`utils/imageCache.js`) so the just-picked local image shows instantly before the processed one lands.

**Why:** decouples upload from processing, keeps the API stateless/fast, and makes storage
swappable (MinIO → S3/R2) by changing only `S3_*` env vars.

---

## 9. Mobile app structure (`mobile/app`, expo-router)

| Route | Screen |
|-------|--------|
| `index.js` | Animated splash / entry |
| `sign-in.js`, `sign-up.js` | Auth (username/phone) |
| `(tabs)/discover.js` | Search + listings (refreshes on focus) |
| `(tabs)/map.js` | react-native-maps (native only; web shows stub via `src/stubs/react-native-maps.js`) |
| `(tabs)/post.js` | Multi-step create-listing wizard |
| `(tabs)/saved.js` | Saved listings |
| `(tabs)/profile.js` | Profile: name/username, stats, links |
| `property/[id].js` | Property detail |
| `property/edit/[id].js` | Edit listing |
| `chat/[id].js` | 1:1 messaging |
| `messages.js` | Conversations list |
| `my-listings.js` | Owner's listings |
| `notifications.js`, `settings.js` | Secondary screens |

Shared code in `mobile/src`:
- `components/` — Neo* UI kit (NeoBox, NeoButton), PropertyCard, SmartImage, ConfirmModal, Header, Icon, ui (NeoInput, Tag, Avatar).
- `hooks/useApi.js` — typed API client, auto-injects Clerk JWT.
- `context/ThemeContext.js`, `theme/index.js` — theming (`C` colors, `FONT`, `FONT_HEAD`).
- `utils/` — `imageCache.js`, `property.js`, `cluster.js` (grid map clustering: `clusterProperties`, `withCoords`).
- `data/properties.js` — seed/fallback data.

---

## 10. Configuration (env)

`.env` at repo root (copy from `.env.example`):

| Var | Purpose |
|-----|---------|
| `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk auth (client + API) |
| `HOST_IP` | LAN IP so phone/Expo reaches Metro + presigned URLs are signed for the right host |
| `POSTGRES_USER/PASSWORD/DB` | Postgres |
| `MINIO_ROOT_USER/PASSWORD` | Object storage creds (default `zamin_minio` / `zamin_minio_secret`) |

Derived/compose-set: `DATABASE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_PUBLIC_BASE=/media`,
`REDIS_HOST/PORT`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.

Security/ops (optional): `CORS_ORIGIN` (comma-separated allow-list; default `*` for dev),
`RATE_LIMIT_MAX` (per-IP/min, default 600), `NODE_ENV=production` (prod-safe error responses).
The API uses `helmet`, `express-rate-limit` (behind nginx via `trust proxy`), and a prod-safe
error handler. Schema migrations live in `backend/src/migrate.js` (run on boot + in test/CI
`globalSetup`). CI: `.github/workflows/ci.yml`.

---

## 11. Running & validating locally

```bash
cp .env.example .env          # fill Clerk keys + HOST_IP (ipconfig getifaddr en0)
docker compose up --build     # all 7 services
```

- Web: `http://localhost:8081`  ·  API: `http://localhost:4000/properties`
- MinIO console: `http://localhost:9001`
- Phone (tunnel): with `docker-compose.override.yml` present, get the tunnel URL from the
  manifest and connect via the iOS **Camera** app or the Expo Go URL field.

**Fast bundle validation without a device** (catches JSX/syntax errors):
```bash
curl -s -o /tmp/b.js -w "HTTP %{http_code} | %{size_download}b\n" \
  "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=ios&dev=true&hot=false"
# 200 + multi-MB = compiles. A small JSON body with "type":"error" = build failed.
```

See `CLAUDE.md` for the full operational runbook (tunnel URL extraction, Clerk config
inspection, creating test users via the Backend API, etc.).

---

## 12. Known gotchas / sharp edges

- **Global Clerk middleware**: invalid keys 500 even public routes. Keep keys valid.
- **`requireAuth` must 401, not 302** — a redirect makes `fetch` receive HTML. Don't swap it for Clerk's redirecting guard.
- **`redirect: "manual"` in `useApi`** exists for the same reason — don't remove.
- **Native-only maps**: `react-native-maps` is stubbed on web; guard native map code.
- **API tests:** `backend/tests/api.test.js` (Jest + Supertest) covers auth guards + CRUD +
  ownership. Run with `docker exec zamin_api npm test`. Clerk is mocked via `x-test-user`
  header; the app is imported from `src/app.js` (server-less).
- **Mobile tests:** `jest-expo` preset (`mobile/jest.config.js`), specs under
  `mobile/src/**/__tests__/*.test.js` — currently the pure helpers (`utils/cluster`, `utils/property`).
  Run with `docker compose exec mobile npm test`. `mobile/.npmrc` pins `legacy-peer-deps=true` so
  `npm ci` resolves. Both `backend-tests` + `mobile-tests` CI jobs gate merges.
- **Docker build npm flakiness**: first `--build` can fail on a transient npm network error; retry usually succeeds.
- **Messages/notifications are real** (backed by the `messages` table via `GET /messages`),
  but there is **no read-tracking column**, so unread badges are intentionally absent. Adding
  a `read_at`/`last_read` mechanism is future work (see ROADMAP real-time chat).
- **Profile name for username-only accounts**: no first/last name, so display falls back to `@username` (see `profile.js`).