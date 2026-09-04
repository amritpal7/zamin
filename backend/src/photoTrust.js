// On-site photo verification. Owners can capture photos in-app on the property site;
// each carries the GPS fix at shutter time. A photo taken with the in-app camera close
// to the listing's location counts as "on-site" — a real anti-fraud signal (fake listings
// reuse stock/downloaded images). A listing with >=1 on-site photo earns the badge.
//
// Capture coordinates are sensitive; they are NEVER exposed to non-owners (see
// locationPrivacy.redactLocation, which strips photo_geo down to {url,on_site}).

const ON_SITE_THRESHOLD_M = 150;

function haversineM(aLat, aLng, bLat, bLng) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// Merge existing + incoming per-photo geo, keep only photos still on the listing, then
// compute each photo's on_site and the listing's on_site_verified. If the listing has no
// pin yet, the first on-site camera capture auto-sets it (so app-made listings get coords).
// Returns { photo_geo, latitude, longitude, on_site_verified }.
function computePhotoTrust({ existing = [], incoming = [], images = [], lat = null, lng = null }) {
  const byUrl = new Map();
  for (const g of existing || []) if (g && g.url) byUrl.set(g.url, g);
  for (const g of incoming || []) if (g && g.url) byUrl.set(g.url, { ...byUrl.get(g.url), ...g });

  // Only retain metadata for photos still present on the listing (drops removed ones).
  const kept = (images || []).map((u) => byUrl.get(u)).filter(Boolean);

  // Auto-pin from the first camera capture that has a GPS fix, when no pin is set.
  let plat = isNum(lat) ? lat : null;
  let plng = isNum(lng) ? lng : null;
  if (plat == null || plng == null) {
    const seed = kept.find((g) => g.source === "camera" && isNum(g.lat) && isNum(g.lng));
    if (seed) { plat = seed.lat; plng = seed.lng; }
  }

  let anyOnSite = false;
  const photo_geo = kept.map((g) => {
    let on_site = false;
    if (g.source === "camera" && isNum(g.lat) && isNum(g.lng) && plat != null && plng != null) {
      on_site = haversineM(plat, plng, g.lat, g.lng) <= ON_SITE_THRESHOLD_M;
    }
    if (on_site) anyOnSite = true;
    return { url: g.url, lat: isNum(g.lat) ? g.lat : null, lng: isNum(g.lng) ? g.lng : null, at: g.at || null, source: g.source || "gallery", on_site };
  });

  return { photo_geo, latitude: plat, longitude: plng, on_site_verified: anyOnSite };
}

module.exports = { computePhotoTrust, haversineM, ON_SITE_THRESHOLD_M };
