// Server-side location privacy. Owners choose how precisely a listing's location is
// exposed; the API must NOT emit true coordinates when a listing isn't `exact`, because
// GET /properties is public (hiding pins in the client would leak coords over the wire).
//
// - exact       → true latitude/longitude.
// - approximate → a DETERMINISTIC jitter (same offset every request, seeded by the
//                 property id, so the circle doesn't wander) within APPROX_RADIUS_M.
//                 True coords never leave the server; the client draws a circle.
// - hidden      → no coordinates at all (and no distance), only the owner's locality text.
//
// The owner always sees their own listing's exact location (so they can verify the pin).

const crypto = require("crypto");

const VISIBILITIES = ["exact", "approximate", "hidden"];
const APPROX_RADIUS_M = 400;
const M_PER_DEG_LAT = 111320;

// Deterministic point inside a disc of radius APPROX_RADIUS_M around (lat,lng).
// Seeded by the property id → stable across requests. sqrt(r) gives a uniform disc.
function jitter(lat, lng, seed) {
  const h = crypto.createHash("sha256").update(String(seed)).digest();
  const r1 = h.readUInt32BE(0) / 0xffffffff;
  const r2 = h.readUInt32BE(4) / 0xffffffff;
  const angle = r1 * 2 * Math.PI;
  const dist = Math.sqrt(r2) * APPROX_RADIUS_M;
  const cosLat = Math.cos((lat * Math.PI) / 180) || 1e-6;
  const dLat = (dist * Math.cos(angle)) / M_PER_DEG_LAT;
  const dLng = (dist * Math.sin(angle)) / (M_PER_DEG_LAT * cosLat);
  return { lat: lat + dLat, lng: lng + dLng };
}

// Strip raw capture coordinates from photo_geo for non-owners, leaving only what's safe
// to show publicly ({url, on_site}). Owners keep the full metadata.
function sanitizePhotoGeo(row) {
  if (!Array.isArray(row.photo_geo)) return row;
  return { ...row, photo_geo: row.photo_geo.map((g) => ({ url: g.url, on_site: !!g.on_site })) };
}

// Return a privacy-adjusted shallow copy of a property row for `viewerId`.
function redactLocation(row, viewerId) {
  if (!row) return row;
  const vis = row.location_visibility || "exact";
  const isOwner = viewerId && row.clerk_user_id === viewerId;

  if (isOwner) {
    return { ...row, location_precision: "exact" };
  }
  if (vis === "exact") {
    return sanitizePhotoGeo({ ...row, location_precision: "exact" });
  }

  const out = sanitizePhotoGeo({ ...row });
  if (vis === "hidden") {
    out.latitude = null;
    out.longitude = null;
    if ("distance_km" in out) out.distance_km = null; // don't leak proximity
    out.location_precision = "hidden";
    return out;
  }

  // approximate
  if (row.latitude != null && row.longitude != null) {
    const j = jitter(Number(row.latitude), Number(row.longitude), row.id);
    out.latitude = j.lat;
    out.longitude = j.lng;
  }
  if (out.distance_km != null) out.distance_km = Math.round(Number(out.distance_km) * 2) / 2; // coarsen to 0.5 km
  out.location_precision = "approximate";
  out.location_radius_m = APPROX_RADIUS_M;
  return out;
}

module.exports = { redactLocation, VISIBILITIES, APPROX_RADIUS_M };
