/* Simple dependency-free load test for the PUBLIC read path (nginx → API → Postgres).
 * Simulates C concurrent virtual users for D seconds, each looping over a realistic mix
 * of endpoints (paginated list, search, geo/near-me, detail, price-insights). Reports
 * throughput, error rate, and latency percentiles.
 *
 *   node scripts/loadtest.js [baseURL] [concurrency] [durationSec]
 *   e.g. node scripts/loadtest.js http://localhost/api 100 20
 *
 * NOTE: authenticated writes + Socket.io chat are NOT covered (each needs a per-user
 * Clerk token). This measures the dominant browse/read load on ONE API instance.
 */
const BASE = process.argv[2] || "http://localhost/api";
const CONC = parseInt(process.argv[3], 10) || 100;
const DUR = (parseInt(process.argv[4], 10) || 20) * 1000;

let ids = [];
const lat = [], errs = { total: 0 };
let done = 0, inflight = 0;

async function fetchIds() {
  const r = await fetch(`${BASE}/properties?limit=50`);
  const j = await r.json();
  ids = (j.items || []).map((p) => p.id);
  if (!ids.length) throw new Error("no properties to test against — seed first");
}

function pickReq() {
  const id = ids[(Math.random() * ids.length) | 0];
  const cities = ["Bengaluru", "Mumbai", "Delhi", "Pune", "Chennai"];
  const geo = [[19.07, 72.87], [12.97, 77.59], [28.64, 77.21]][(Math.random() * 3) | 0];
  const roll = Math.random();
  if (roll < 0.4) return `/properties?limit=24&offset=${(Math.random() * 96) | 0}`;      // paginated list
  if (roll < 0.6) return `/properties?search=${cities[(Math.random() * cities.length) | 0]}&limit=24`; // search
  if (roll < 0.75) return `/properties?lat=${geo[0]}&lng=${geo[1]}&radius=25&limit=24`;   // geo
  if (roll < 0.9) return `/properties/${id}`;                                              // detail
  return `/properties/${id}/insights`;                                                     // insights
}

async function worker(deadline) {
  while (Date.now() < deadline) {
    const path = pickReq();
    const t0 = performance.now();
    inflight++;
    try {
      const r = await fetch(`${BASE}${path}`);
      if (!r.ok) errs.total++; else await r.text();
    } catch { errs.total++; }
    finally { inflight--; lat.push(performance.now() - t0); done++; }
  }
}

function pct(arr, p) { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * p))]; }

(async () => {
  console.log(`Load test → ${BASE}  ·  ${CONC} concurrent  ·  ${DUR / 1000}s`);
  await fetchIds();
  const deadline = Date.now() + DUR;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: CONC }, () => worker(deadline)));
  const secs = (Date.now() - t0) / 1000;
  console.log(`\n── Results ──`);
  console.log(`requests:      ${done}`);
  console.log(`throughput:    ${(done / secs).toFixed(0)} req/s`);
  console.log(`errors:        ${errs.total} (${((errs.total / done) * 100).toFixed(2)}%)`);
  console.log(`latency p50:   ${pct(lat, 0.5).toFixed(0)} ms`);
  console.log(`latency p95:   ${pct(lat, 0.95).toFixed(0)} ms`);
  console.log(`latency p99:   ${pct(lat, 0.99).toFixed(0)} ms`);
  console.log(`latency max:   ${Math.max(...lat).toFixed(0)} ms`);
  process.exit(0);
})().catch((e) => { console.error("LOADTEST FAILED:", e.message); process.exit(1); });
