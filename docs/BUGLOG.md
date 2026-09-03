# Zamin — Bug Log

A running record of bugs: symptom → root cause → fix → **category**. The point is to spot
**recurring patterns** and turn them into guardrails so we stop reintroducing the same classes
of bug while building new features. Newest first. Update this whenever we fix a bug.

## Recurring patterns & guardrails (check these when building)

| Pattern | Times hit | Guardrail |
|---------|-----------|-----------|
| **`useApi()` isn't referentially stable → `useFocusEffect`/effect render loop (flicker)** | 2+ | Any effect/callback that uses the API client must pin it in a ref (`const apiRef = useRef(api); apiRef.current = api;`) and depend on primitives, not `api`. Pattern already in discover/profile. |
| **react-native-web layout quirks** | 2 | Horizontal `ScrollView` with no fixed height **collapses on web** → wrap in a fixed-height `View`. (Also: keyboard covering inputs.) |
| **`router.back()` no-op / dead nav buttons** | 1 | `router.back()` does nothing with no history (reload/deep-link/notification). Use `router.canGoBack() ? router.back() : router.replace(<fallback>)`. Also: a dead button = handler-not-firing (overlay) OR handler-no-op (nav) — distinguish before fixing. |
| **Modal hygiene** | 1 | Render `Modal`s **conditionally** (`{open && <Modal visible/>}`), not always-mounted — cleaner and avoids RN-web overlay risk. |
| **Denormalized data not propagated to every copy** | 3 | owner_name / owner_avatar / owner_image / sender_name are copied onto rows — update ALL copies + the reconcile job, not just the Clerk user. (CLAUDE.md rule #1) |
| **Messaging receiver/thread identity** | 2 | Receiver = the *peer* (other person), never self/owner-always; conversations keyed by (property, peer). Backend rejects `sender==receiver`. |
| **mobile `npm install` ERESOLVE** | 2 | Install in the mobile container with `--legacy-peer-deps` (matches its Dockerfile). Now pinned via `mobile/.npmrc` (`legacy-peer-deps=true`) so `npm ci` works in CI too. |
| **Stray `</content>` appended by the Write tool** | many | After writing files, strip lines matching `^</content>$`. |
| **`parseFloat` on formatted strings** | 2 | `parseFloat("₹2.4 Cr")` is `NaN` (leading symbol) and `parseFloat("3,200")` is `3` (stops at comma). Strip currency/commas and match the numeric token before parsing. |

## Log

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
