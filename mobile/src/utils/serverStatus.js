// Cold-start awareness. The production API runs on a free host that sleeps after ~15 min idle and
// takes up to ~1 min to wake. Without this, the first screen just spins (or errors) and testers
// think the app is broken. We:
//   1. ping /health as soon as the app starts (the server starts waking during splash/sign-in),
//   2. flag "slow" when any API request has been pending > SLOW_MS (a banner explains the wait),
//   3. retry a GET once if it fails with a network error / 502-504 while the server is starting.
import Constants from "expo-constants";

export const API_BASE = Constants.expoConfig?.extra?.apiUrl
  || process.env.EXPO_PUBLIC_API_URL
  || "http://localhost/api";

const SLOW_MS = 4000;
const RETRY_DELAY_MS = 3000;
const listeners = new Set();
const pending = new Map(); // id → timer
let seq = 0;
let slow = false;

function setSlow(v) {
  if (v === slow) return;
  slow = v;
  listeners.forEach((fn) => { try { fn(slow); } catch {} });
}

export function onServerSlow(fn) {
  listeners.add(fn);
  fn(slow);
  return () => listeners.delete(fn);
}

function begin() {
  const id = ++seq;
  pending.set(id, setTimeout(() => setSlow(true), SLOW_MS));
  return id;
}
function end(id) {
  clearTimeout(pending.get(id));
  pending.delete(id);
  if (pending.size === 0) setSlow(false);
}

const RETRYABLE = new Set([502, 503, 504]);

// fetch() wrapper used by the API client. Same signature/return as fetch.
export async function trackedFetch(url, options = {}) {
  const id = begin();
  const method = (options.method || "GET").toUpperCase();
  try {
    try {
      const res = await fetch(url, options);
      if (method === "GET" && RETRYABLE.has(res.status)) throw Object.assign(new Error("starting"), { retryable: true });
      return res;
    } catch (e) {
      // Only reads are retried (never a POST/PUT/DELETE — could double-submit).
      if (method !== "GET") throw e;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return await fetch(url, options);
    }
  } finally {
    end(id);
  }
}

// Fire-and-forget warm-up (doesn't hit the database).
let warmed = false;
export function warmUpServer() {
  if (warmed) return;
  warmed = true;
  trackedFetch(`${API_BASE}/health`).catch(() => {});
}
