// Unit tests for server-side location privacy (the security-critical redaction).
const { redactLocation, APPROX_RADIUS_M } = require("../src/locationPrivacy");

const OWNER = "user_owner";
const OTHER = "user_other";
const base = (vis) => ({
  id: "11111111-1111-1111-1111-111111111111",
  clerk_user_id: OWNER,
  latitude: 19.076,
  longitude: 72.8777,
  location: "Bandra, Mumbai",
  location_visibility: vis,
});

// meters between two lat/lng (Haversine)
function metres(a, b) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude), dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

describe("redactLocation", () => {
  test("exact → true coords for everyone", () => {
    const r = redactLocation(base("exact"), OTHER);
    expect(r.latitude).toBe(19.076);
    expect(r.longitude).toBe(72.8777);
    expect(r.location_precision).toBe("exact");
  });

  test("owner always sees own exact coords, whatever the visibility", () => {
    for (const vis of ["approximate", "hidden"]) {
      const r = redactLocation(base(vis), OWNER);
      expect(r.latitude).toBe(19.076);
      expect(r.longitude).toBe(72.8777);
      expect(r.location_precision).toBe("exact");
    }
  });

  test("approximate → jittered within radius, true coords never emitted", () => {
    const r = redactLocation(base("approximate"), OTHER);
    expect(r.location_precision).toBe("approximate");
    expect(r.location_radius_m).toBe(APPROX_RADIUS_M);
    expect(r.latitude).not.toBe(19.076);
    expect(r.longitude).not.toBe(72.8777);
    const d = metres({ latitude: 19.076, longitude: 72.8777 }, r);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(APPROX_RADIUS_M + 1);
  });

  test("approximate jitter is deterministic (stable across calls)", () => {
    const a = redactLocation(base("approximate"), OTHER);
    const b = redactLocation(base("approximate"), OTHER);
    expect(a.latitude).toBe(b.latitude);
    expect(a.longitude).toBe(b.longitude);
  });

  test("hidden → no coords and no distance leaked", () => {
    const row = { ...base("hidden"), distance_km: 2.3 };
    const r = redactLocation(row, OTHER);
    expect(r.latitude).toBeNull();
    expect(r.longitude).toBeNull();
    expect(r.distance_km).toBeNull();
    expect(r.location_precision).toBe("hidden");
    expect(r.location).toBe("Bandra, Mumbai"); // locality text still shown
  });

  test("approximate coarsens distance_km", () => {
    const r = redactLocation({ ...base("approximate"), distance_km: 2.34 }, OTHER);
    expect(r.distance_km).toBe(2.5);
  });
});
