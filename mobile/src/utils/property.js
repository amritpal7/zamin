// Pull the leading amount + its unit out of a stored string. Robust to a
// currency symbol prefix ("₹2.4 Cr"), thousands commas ("3,200 sq ft"), and
// both spaced ("85 L") and unspaced ("22K") unit suffixes. `parseFloat` alone
// mis-handles all three (NaN on ₹, truncates at the comma).
function parseAmount(str) {
  if (str === null || str === undefined || str === "") return null;
  const s = String(str).replace(/,/g, "");
  const num = s.match(/-?\d+(?:\.\d+)?/);
  if (!num) return null;
  const unit = s.match(/\d\s*([a-z]+)/i);       // letters right after a digit
  return { n: parseFloat(num[0]), unit: unit ? unit[1].toLowerCase() : "" };
}

// Parses stored price string → rupees (number) or null
export function priceToRupees(str) {
  const p = parseAmount(str);
  if (!p || isNaN(p.n)) return null;
  if (p.unit.startsWith("cr"))                     return p.n * 1e7;
  if (p.unit === "l" || p.unit.startsWith("lakh")) return p.n * 1e5;
  if (p.unit === "k")                              return p.n * 1e3;
  return p.n;
}

// Parses stored area string → sqft (number) or null
export function areaToSqft(str) {
  const p = parseAmount(str);
  if (!p || !(p.n > 0)) return null;
  const s = String(str);
  if (/sq\s*m/i.test(s))   return p.n * 10.764;
  if (/acre/i.test(s))     return p.n * 43560;
  if (/bigha/i.test(s))    return p.n * 27225; // ~1 bigha = 27,225 sqft (UP standard)
  if (/guntha/i.test(s))   return p.n * 1089;
  if (/yard/i.test(s))     return p.n * 9;
  return p.n; // assume sqft
}

// Returns price per sqft as a formatted string, or null
export function pricePerSqft(priceStr, areaStr) {
  const rupees = priceToRupees(priceStr);
  const sqft   = areaToSqft(areaStr);
  if (!rupees || !sqft) return null;
  const ppsf = Math.round(rupees / sqft);
  if (ppsf <= 0 || ppsf > 5e6) return null; // sanity check
  return ppsf >= 1000
    ? `₹${(ppsf / 1000).toFixed(1)}k/sqft`
    : `₹${ppsf}/sqft`;
}

// Returns EMI estimate string for For Sale listings, or null
// Formula: P × r(1+r)^n / ((1+r)^n − 1) at 9% p.a. for 20 years
export function estimateEMI(priceStr, status) {
  if (status !== "For Sale") return null;
  const P = priceToRupees(priceStr);
  if (!P || P <= 0) return null;
  const r = 0.09 / 12;
  const n = 240;
  const emi = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  if (emi >= 1e5) return `EMI ~₹${(emi / 1e5).toFixed(1)}L/mo`;
  if (emi >= 1000) return `EMI ~₹${Math.round(emi / 1000)}k/mo`;
  return `EMI ~₹${Math.round(emi)}/mo`;
}
