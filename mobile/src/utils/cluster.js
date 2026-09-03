// Lightweight grid clustering for the map — no PostGIS, no extra native dep.
// Buckets points into a grid sized off the visible region + zoom, so nearby
// pins collapse into one "N" bubble that splits apart as you zoom in.
//
// points: [{ id, lat, lng, ... }] (lat/lng finite numbers)
// region: { latitude, longitude, latitudeDelta, longitudeDelta } | null
// gridSize: number of cells across the viewport (higher = finer / fewer merges)
//
// Returns a flat list of:
//   { type: "point",   key, lat, lng, property }
//   { type: "cluster", key, lat, lng, count, items }
export function clusterProperties(points, region, gridSize = 8) {
  const valid = (points || []).filter(
    (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng)
  );

  // No region yet (first paint) → every point stands alone.
  if (!region || !Number.isFinite(region.latitudeDelta) || !Number.isFinite(region.longitudeDelta)) {
    return valid.map((p) => ({ type: "point", key: String(p.id), lat: p.lat, lng: p.lng, property: p }));
  }

  const cellLat = region.latitudeDelta / gridSize;
  const cellLng = region.longitudeDelta / gridSize;
  // Degenerate deltas (fully zoomed in) → don't divide by ~0; treat all as points.
  if (!(cellLat > 0) || !(cellLng > 0)) {
    return valid.map((p) => ({ type: "point", key: String(p.id), lat: p.lat, lng: p.lng, property: p }));
  }

  const originLat = region.latitude - region.latitudeDelta / 2;
  const originLng = region.longitude - region.longitudeDelta / 2;

  const buckets = new Map();
  for (const p of valid) {
    const row = Math.floor((p.lat - originLat) / cellLat);
    const col = Math.floor((p.lng - originLng) / cellLng);
    const key = `${row}:${col}`;
    (buckets.get(key) || buckets.set(key, []).get(key)).push(p);
  }

  const out = [];
  for (const [key, items] of buckets) {
    if (items.length === 1) {
      const p = items[0];
      out.push({ type: "point", key, lat: p.lat, lng: p.lng, property: p });
    } else {
      const lat = items.reduce((s, p) => s + p.lat, 0) / items.length;
      const lng = items.reduce((s, p) => s + p.lng, 0) / items.length;
      out.push({ type: "cluster", key, lat, lng, count: items.length, items });
    }
  }
  return out;
}

// Normalize a listing (seed uses lat/lng; DB rows use latitude/longitude) to
// finite lat/lng, dropping any without coordinates.
export function withCoords(list) {
  return (list || [])
    .map((p) => ({ ...p, lat: Number(p.lat ?? p.latitude), lng: Number(p.lng ?? p.longitude) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}
