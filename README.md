# Zamin 🏠

Cross-platform property marketplace — find houses & land, chat or call owners directly, **zero brokerage**. Built with **Expo + React Native**, **Clerk auth**, **Express API**, **PostgreSQL**, all containerised with **Docker Compose**.

---

## Project structure

```
zamin/
├── docker-compose.yml          # Dev: api + db + nginx + mobile
├── docker-compose.prod.yml     # Prod overrides
├── .env.example                # Copy to .env and fill in
├── nginx/nginx.conf            # Reverse proxy /api → backend
│
├── backend/                    # Node + Express API
│   ├── Dockerfile
│   ├── src/
│   │   ├── index.js            # Entry point
│   │   ├── db.js               # Postgres pool
│   │   ├── middleware/auth.js  # Clerk requireAuth guard
│   │   └── routes/
│   │       ├── properties.js   # CRUD listings
│   │       ├── saved.js        # Save/unsave
│   │       └── messages.js     # Chat messages
│   └── db/init.sql             # Schema + seed data (auto-runs)
│
└── mobile/                     # Expo React Native app
    ├── Dockerfile
    ├── app/                    # expo-router file-based routes
    │   ├── _layout.js          # ClerkProvider + AuthGuard
    │   ├── index.js            # Animated splash
    │   ├── sign-in.js          # Clerk sign in
    │   ├── sign-up.js          # Clerk sign up + email verify
    │   ├── (tabs)/
    │   │   ├── discover.js     # Search + listings
    │   │   ├── map.js          # react-native-maps (gated)
    │   │   ├── post.js         # 4-step listing wizard (gated)
    │   │   ├── saved.js        # Saved listings (gated)
    │   │   └── profile.js      # Clerk user profile + sign out
    │   ├── property/[id].js    # Detail modal (location gated)
    │   └── chat/[id].js        # 1:1 messaging
    └── src/
        ├── components/         # NeoBox, NeoButton, PropertyCard...
        ├── hooks/useApi.js     # Typed API client (auto-injects JWT)
        ├── data/properties.js  # Seed fallback data
        └── theme/index.js      # Colors + fonts
```

---

## Quick start

### 1. Get Clerk keys
1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) → Create application
2. Choose **Email + Password** (and optionally Google/Apple)
3. Copy **Publishable Key** and **Secret Key**

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env:
#   CLERK_PUBLISHABLE_KEY=pk_test_...
#   CLERK_SECRET_KEY=sk_test_...
#   HOST_IP=<your machine's LAN IP>  ← so Expo Go on phone can reach Metro
```

Find your LAN IP:
```bash
# Mac
ipconfig getifaddr en0
# Linux
hostname -I | awk '{print $1}'
```

### 3. Run everything with Docker
```bash
docker compose up --build
```

This starts:
| Container | What | Port |
|-----------|------|------|
| `zamin_db` | Postgres (auto-creates schema + seed data) | 5432 |
| `zamin_api` | Express API | 4000 |
| `zamin_nginx` | Reverse proxy | 80 |
| `zamin_mobile` | Expo Metro bundler | 8081 |

### 4. Open the app
- **Expo Go (phone):** scan QR from `http://localhost:8081`
- **iOS simulator:** `docker exec zamin_mobile npx expo start --ios`
- **Browser:** `http://localhost:8081` (web mode)

---

## Auth flow (Clerk)

```
User opens app
  → Clerk checks session token in SecureStore
  → isSignedIn=true  → (tabs)/discover
  → isSignedIn=false → /sign-in

Sign up flow:
  /sign-up → signUp.create() → prepareEmailVerification()
           → user enters OTP → attemptEmailVerification()
           → session created → setActive() → app

API requests:
  useApi() → getToken() → Bearer <JWT> → Express
           → clerkMiddleware() validates JWT
           → requireAuth guard on protected routes
```

## Protected routes (require login)
| Feature | Guest | Signed In |
|---------|-------|-----------|
| Browse listings | ✅ | ✅ |
| View property details | ✅ | ✅ |
| View exact location | ❌ | ✅ |
| Chat with owner | ❌ | ✅ |
| Call owner | ❌ | ✅ |
| Post a listing | ❌ | ✅ |
| Save properties | ❌ | ✅ |
| Profile | ❌ | ✅ |

---

## API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /properties | Public | List all (filter: type, status, search) |
| GET | /properties/:id | Public | Single property |
| POST | /properties | 🔒 | Create listing |
| DELETE | /properties/:id | 🔒 Owner only | Delete listing |
| GET | /saved | 🔒 | My saved properties |
| POST | /saved/:id | 🔒 | Save property |
| DELETE | /saved/:id | 🔒 | Unsave |
| GET | /messages/:propertyId | 🔒 | Conversation |
| POST | /messages/:propertyId | 🔒 | Send message |

---

## Google Maps setup (for native map)

1. Get API key from [Google Cloud Console](https://console.cloud.google.com) → Enable **Maps SDK for Android** and **Maps SDK for iOS**
2. Replace in `mobile/app.json`:
   ```json
   "ios":     { "config": { "googleMapsApiKey": "YOUR_KEY" } },
   "android": { "config": { "googleMaps": { "apiKey": "YOUR_KEY" } } }
   ```
The map renders natively on device. On web it shows a placeholder (react-native-maps is native-only).

---

## Production deployment

```bash
# Build and start prod containers
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Build standalone mobile apps (no Expo Go needed)
cd mobile
npx expo build:ios      # → .ipa for App Store
npx expo build:android  # → .apk / .aab for Play Store
```

For the backend, push to any VPS (DigitalOcean, Railway, AWS EC2) running Docker. Point your domain at it, add an SSL cert with Certbot, and update `nginx.prod.conf`.

---

## Next steps to grow

| When | Add |
|------|-----|
| Day 1 | Cloudinary for photo uploads in Post wizard |
| Week 1 | Supabase Realtime or Socket.io for live chat |
| Month 1 | Elasticsearch for geo-search ("near me") |
| Month 3 | Push notifications (Expo + FCM) |
| Month 6 | Kubernetes if you outgrow a single VPS |
