import { clusterProperties, withCoords } from "../cluster";

// Region covering roughly all of India (matches the map's initial view).
const WIDE = { latitude: 15, longitude: 76, latitudeDelta: 9, longitudeDelta: 9 };

// Two Bengaluru listings sit ~15km apart; one Mumbai listing is far away.
const BLR_A = { id: "a", latitude: 12.93, longitude: 77.62 };
const BLR_B = { id: "b", latitude: 12.97, longitude: 77.75 };
const MUM   = { id: "c", latitude: 19.05, longitude: 72.83 };

describe("withCoords", () => {
  test("normalizes seed lat/lng and DB latitude/longitude to lat/lng", () => {
    const [seed, db] = withCoords([
      { id: "s", lat: 12.9, lng: 77.6 },
      { id: "d", latitude: 19.0, longitude: 72.8 },
    ]);
    expect(seed).toMatchObject({ lat: 12.9, lng: 77.6 });
    expect(db).toMatchObject({ lat: 19.0, lng: 72.8 });
  });

  test("drops rows without finite coordinates", () => {
    const out = withCoords([
      BLR_A,
      { id: "x", latitude: null, longitude: 77 },
      { id: "y", lat: NaN, lng: 5 },
      { id: "z" },
    ]);
    expect(out.map((p) => p.id)).toEqual(["a"]);
  });

  test("tolerates null/empty input", () => {
    expect(withCoords(null)).toEqual([]);
    expect(withCoords([])).toEqual([]);
  });
});

describe("clusterProperties", () => {
  const pts = withCoords([BLR_A, BLR_B, MUM]);

  test("merges nearby points into one cluster when zoomed out", () => {
    const out = clusterProperties(pts, WIDE, 8);
    const cluster = out.find((c) => c.type === "cluster");
    const point = out.find((c) => c.type === "point");
    expect(cluster).toBeDefined();
    expect(cluster.count).toBe(2);              // the two BLR pins collapse
    expect(cluster.items.map((p) => p.id).sort()).toEqual(["a", "b"]);
    expect(point.property.id).toBe("c");        // Mumbai stays on its own
    // cluster centroid is the mean of its members
    expect(cluster.lat).toBeCloseTo((BLR_A.latitude + BLR_B.latitude) / 2, 5);
  });

  test("splits the cluster apart when zoomed in tight", () => {
    const tight = { latitude: 12.95, longitude: 77.68, latitudeDelta: 0.3, longitudeDelta: 0.3 };
    const out = clusterProperties(pts, tight, 8);
    // At this zoom the two BLR pins land in different cells → all points.
    expect(out.every((c) => c.type === "point")).toBe(true);
  });

  test("no region → every point stands alone", () => {
    const out = clusterProperties(pts, null);
    expect(out).toHaveLength(3);
    expect(out.every((c) => c.type === "point")).toBe(true);
  });

  test("degenerate (zero-delta) region does not divide by zero", () => {
    const out = clusterProperties(pts, { latitude: 12, longitude: 77, latitudeDelta: 0, longitudeDelta: 0 });
    expect(out).toHaveLength(3);
    expect(out.every((c) => c.type === "point")).toBe(true);
  });

  test("ignores points with bad coordinates", () => {
    // clusterProperties consumes normalized {lat,lng} points (withCoords runs first).
    const out = clusterProperties([{ id: "a", lat: 12.93, lng: 77.62 }, { id: "bad", lat: NaN, lng: 1 }], WIDE);
    expect(out).toHaveLength(1);
    expect(out[0].property.id).toBe("a");
  });
});
