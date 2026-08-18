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
| **mobile `npm install` ERESOLVE** | 2 | Install in the mobile container with `--legacy-peer-deps` (matches its Dockerfile). |
| **Stray `</content>` appended by the Write tool** | many | After writing files, strip lines matching `^</content>$`. |

## Log

### 2026-08-19
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
