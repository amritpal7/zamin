// Parses stored price string → rupees (number) or null
export function priceToRupees(str) {
  if (!str) return null;
  const n = parseFloat(str);
  if (isNaN(n)) return null;
  if (/cr/i.test(str))      return n * 1e7;
  if (/\bL\b/i.test(str))   return n * 1e5;
  if (/\bK\b/i.test(str))   return n * 1e3;
  return n;
}

// Parses stored area string → sqft (number) or null
export function areaToSqft(str) {
  if (!str) return null;
  const n = parseFloat(str);
  if (isNaN(n) || n <= 0) return null;
  if (/sq\s*m/i.test(str))   return n * 10.764;
  if (/acre/i.test(str))     return n * 43560;
  if (/bigha/i.test(str))    return n * 27225; // ~1 bigha = 27,225 sqft (UP standard)
  if (/guntha/i.test(str))   return n * 1089;
  if (/yard/i.test(str))     return n * 9;
  return n; // assume sqft
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
