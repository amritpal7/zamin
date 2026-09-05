// Price insights: parse stored price/area strings into ₹ and sqft, then compare a
// listing's ₹/sqft against comparable listings (same type + status, same locality/city).
// Parsing mirrors mobile/src/utils/property.js so client and server agree.

function parseAmount(str) {
  if (str === null || str === undefined || str === "") return null;
  const s = String(str).replace(/,/g, "");
  const num = s.match(/-?\d+(?:\.\d+)?/);
  if (!num) return null;
  const unit = s.match(/\d\s*([a-z]+)/i); // letters right after a digit
  return { n: parseFloat(num[0]), unit: unit ? unit[1].toLowerCase() : "" };
}

function priceToRupees(str) {
  const p = parseAmount(str);
  if (!p || Number.isNaN(p.n)) return null;
  if (p.unit.startsWith("cr")) return p.n * 1e7;
  if (p.unit === "l" || p.unit.startsWith("lakh")) return p.n * 1e5;
  if (p.unit === "k") return p.n * 1e3;
  return p.n;
}

function areaToSqft(str) {
  const p = parseAmount(str);
  if (!p || !(p.n > 0)) return null;
  const s = String(str);
  if (/sq\s*m/i.test(s)) return p.n * 10.764;
  if (/acre/i.test(s)) return p.n * 43560;
  if (/bigha/i.test(s)) return p.n * 27225;
  if (/guntha/i.test(s)) return p.n * 1089;
  if (/yard/i.test(s)) return p.n * 9;
  return p.n; // assume sqft
}

// ₹/sqft for one listing, or null when unparseable / implausible.
function pricePerSqft(priceStr, areaStr) {
  const rupees = priceToRupees(priceStr);
  const sqft = areaToSqft(areaStr);
  if (!rupees || !sqft) return null;
  const ppsf = rupees / sqft;
  if (ppsf <= 0 || ppsf > 5e6) return null; // sanity bound (matches client)
  return ppsf;
}

function median(nums) {
  if (!nums.length) return null;
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

const GOOD_DEAL = 0.9;   // <= 90% of area median
const ABOVE_MKT = 1.1;   // >= 110% of area median
const MIN_SAMPLE = 3;    // need at least this many comparables to call it

// listing: the row; comparables: other rows (same type+status+area). Returns a
// verdict + the numbers behind it. `area` is the locality/city label used.
function computeInsights(listing, comparables, areaLabel) {
  const mine = pricePerSqft(listing.price, listing.area);
  const vals = comparables.map((c) => pricePerSqft(c.price, c.area)).filter((v) => v != null);
  const areaAvg = median(vals);
  const base = {
    area: areaLabel || null,
    status: listing.status,
    type: listing.type,
    pricePerSqft: mine != null ? Math.round(mine) : null,
    areaMedianPerSqft: areaAvg != null ? Math.round(areaAvg) : null,
    sampleSize: vals.length,
  };
  if (mine == null || areaAvg == null || vals.length < MIN_SAMPLE) {
    return { ...base, verdict: "insufficient", deltaPct: null };
  }
  const deltaPct = Math.round(((mine - areaAvg) / areaAvg) * 100);
  let verdict = "at_market";
  if (mine <= areaAvg * GOOD_DEAL) verdict = "good_deal";
  else if (mine >= areaAvg * ABOVE_MKT) verdict = "above_market";
  return { ...base, verdict, deltaPct };
}

module.exports = { priceToRupees, areaToSqft, pricePerSqft, median, computeInsights, MIN_SAMPLE };
