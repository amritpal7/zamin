// Thin API integration tests: auth guards + property CRUD + ownership.
//
// Clerk is mocked so a test header (x-test-user) controls the authenticated
// user. The database is the REAL Postgres the API talks to (run in-container
// via `npm test`), so route logic + SQL are exercised end-to-end.
//
// Run:  docker exec zamin_api npm test

jest.mock("@clerk/express", () => ({
  // no-op middleware; auth state comes from the mocked getAuth below
  clerkMiddleware: () => (_req, _res, next) => next(),
  // userId is whatever the request's x-test-user header says (or null = signed out)
  getAuth: (req) => ({ userId: req.headers["x-test-user"] || null }),
}));

const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/db");

const USER_A = "test_user_jest_a";
const USER_B = "test_user_jest_b";

const sampleListing = {
  owner_name: "Jest Tester",
  owner_phone: "+91 90000 00000",
  owner_avatar: "JT",
  title: "Jest Test Listing",
  description: "Created by the automated test suite.",
  type: "House",
  status: "For Sale",
  price: "₹1 Cr",
  area: "1,000 sq ft",
  beds: 2,
  baths: 2,
  location: "Test Nagar, Testville",
  latitude: 19.0,
  longitude: 72.8,
  tags: ["Test"],
};

// Clean up any rows the suite created (even if an assertion failed mid-way).
afterAll(async () => {
  await pool.query("DELETE FROM properties WHERE clerk_user_id LIKE 'test_user_jest%'");
  await pool.query("DELETE FROM push_tokens WHERE clerk_user_id LIKE 'test_user_jest%'");
  await pool.query("DELETE FROM blocks WHERE blocker_id LIKE 'test_user_jest%' OR blocked_id LIKE 'test_user_jest%'");
  await pool.query("DELETE FROM reports WHERE reporter_id LIKE 'test_user_jest%' OR reporter_id LIKE 'rep\\_%'");
  await pool.query("DELETE FROM reviews WHERE owner_id LIKE 'test_user_jest%' OR reviewer_id LIKE 'test_user_jest%'");
  await pool.query("DELETE FROM pending_uploads WHERE clerk_user_id LIKE 'test_user_jest%'");
  await pool.query("DELETE FROM saved_searches WHERE clerk_user_id LIKE 'test_user_jest%'");
  await pool.query("DELETE FROM notifications WHERE clerk_user_id LIKE 'test_user_jest%'");
  await pool.query("DELETE FROM visits WHERE requester_id LIKE 'test_user_jest%' OR owner_id LIKE 'test_user_jest%'");
  await pool.end();
});

describe("health & public reads", () => {
  test("GET /health → 200 ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("GET /properties → 200 array (seed data present)", async () => {
    const res = await request(app).get("/properties");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test("GET /properties?type=Land → only Land rows", async () => {
    const res = await request(app).get("/properties?type=Land");
    expect(res.status).toBe(200);
    for (const row of res.body) expect(row.type).toBe("Land");
  });

  test("GET /properties/:id (unknown uuid) → 404", async () => {
    const res = await request(app).get("/properties/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});

describe("auth guards (401 when signed out)", () => {
  test("POST /properties → 401", async () => {
    const res = await request(app).post("/properties").send(sampleListing);
    expect(res.status).toBe(401);
  });
  test("GET /properties/mine → 401", async () => {
    expect((await request(app).get("/properties/mine")).status).toBe(401);
  });
  test("GET /saved → 401", async () => {
    expect((await request(app).get("/saved")).status).toBe(401);
  });
  test("GET /messages/:id → 401", async () => {
    expect((await request(app).get("/messages/00000000-0000-0000-0000-000000000000")).status).toBe(401);
  });
  test("GET /messages (conversations) → 401", async () => {
    expect((await request(app).get("/messages")).status).toBe(401);
  });
  test("POST /push/register → 401", async () => {
    expect((await request(app).post("/push/register").send({ token: "x" })).status).toBe(401);
  });
});

describe("push token registration", () => {
  test("register requires a token (400)", async () => {
    const res = await request(app).post("/push/register").set("x-test-user", USER_A).send({});
    expect(res.status).toBe(400);
  });
  test("register stores the token for the user", async () => {
    const token = "ExponentPushToken[test-jest-a]";
    const res = await request(app).post("/push/register").set("x-test-user", USER_A).send({ token });
    expect(res.status).toBe(200);
    const { rows } = await pool.query("SELECT clerk_user_id FROM push_tokens WHERE token = $1", [token]);
    expect(rows[0]?.clerk_user_id).toBe(USER_A);
  });
});

describe("geo / near-me search", () => {
  let nearId, farId;
  beforeAll(async () => {
    const near = await request(app).post("/properties").set("x-test-user", USER_A)
      .send({ ...sampleListing, title: "Near BLR", latitude: 12.98, longitude: 77.60 });
    nearId = near.body.id;
    const far = await request(app).post("/properties").set("x-test-user", USER_A)
      .send({ ...sampleListing, title: "Far Delhi", latitude: 28.6139, longitude: 77.2090 });
    farId = far.body.id;
  });

  test("returns listings within radius, sorted by distance, with distance_km", async () => {
    const res = await request(app).get("/properties?lat=12.9716&lng=77.5946&radius=25");
    expect(res.status).toBe(200);
    const near = res.body.find((p) => p.id === nearId);
    expect(near).toBeDefined();
    expect(Number(near.distance_km)).toBeLessThan(25);
    // the far listing (Delhi, ~1700 km) is excluded by the 25 km radius
    expect(res.body.some((p) => p.id === farId)).toBe(false);
    // results are ascending by distance
    const dists = res.body.map((p) => Number(p.distance_km));
    for (let i = 1; i < dists.length; i++) expect(dists[i]).toBeGreaterThanOrEqual(dists[i - 1] - 0.001);
  });

  test("without geo params → normal list, no distance_km", async () => {
    const res = await request(app).get("/properties");
    const near = res.body.find((p) => p.id === nearId);
    expect(near).toBeDefined();
    expect(near.distance_km).toBeUndefined();
  });
});

describe("verified trust badge (server-authoritative)", () => {
  test("a client cannot self-assign verified via the create body", async () => {
    // The badge is derived server-side from Clerk. With no Clerk configured in
    // tests, a freshly created listing must be verified=false even though the
    // client sent verified:true.
    const res = await request(app).post("/properties").set("x-test-user", USER_A)
      .send({ ...sampleListing, title: "Fake Verified", verified: true });
    expect(res.status).toBe(201);
    expect(res.body.verified).toBe(false);
    // and it's persisted false, not just omitted from the response
    const got = await request(app).get(`/properties/${res.body.id}`);
    expect(got.body.verified).toBe(false);
  });
});

describe("location privacy (server-enforced)", () => {
  const coords = { latitude: 19.076, longitude: 72.8777 };

  test("approximate → other users get jittered coords, never the true ones", async () => {
    const created = await request(app).post("/properties").set("x-test-user", USER_A)
      .send({ ...sampleListing, title: "Approx listing", ...coords, location_visibility: "approximate" });
    expect(created.status).toBe(201);
    const id = created.body.id;

    // Consumer view (a DIFFERENT user): jittered + flagged, true coords withheld.
    const other = await request(app).get(`/properties/${id}`).set("x-test-user", USER_B);
    expect(other.body.location_precision).toBe("approximate");
    expect(other.body.location_radius_m).toBeGreaterThan(0);
    expect(other.body.latitude).not.toBe(coords.latitude);
    expect(other.body.longitude).not.toBe(coords.longitude);

    // Owner still sees exact.
    const owner = await request(app).get(`/properties/${id}`).set("x-test-user", USER_A);
    expect(owner.body.location_precision).toBe("exact");
    expect(Number(owner.body.latitude)).toBeCloseTo(coords.latitude, 4);
  });

  test("hidden → no coordinates leave the server for other users", async () => {
    const created = await request(app).post("/properties").set("x-test-user", USER_A)
      .send({ ...sampleListing, title: "Hidden listing", ...coords, location_visibility: "hidden" });
    const id = created.body.id;

    const other = await request(app).get(`/properties/${id}`).set("x-test-user", USER_B);
    expect(other.body.location_precision).toBe("hidden");
    expect(other.body.latitude).toBeNull();
    expect(other.body.longitude).toBeNull();
    expect(other.body.location).toBe(sampleListing.location); // locality text still shown

    // And in the public list, too (the consumer path most likely to leak).
    const list = await request(app).get("/properties").set("x-test-user", USER_B);
    const row = list.body.find((p) => p.id === id);
    expect(row.latitude).toBeNull();
  });

  test("invalid location_visibility → 400", async () => {
    const res = await request(app).post("/properties").set("x-test-user", USER_A)
      .send({ ...sampleListing, location_visibility: "nope" });
    expect(res.status).toBe(400);
  });

  test("bulk PUT /location-visibility updates all the owner's listings", async () => {
    await request(app).post("/properties").set("x-test-user", USER_A).send({ ...sampleListing, ...coords });
    const res = await request(app).put("/properties/location-visibility").set("x-test-user", USER_A)
      .send({ visibility: "hidden" });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBeGreaterThan(0);
    // every one of A's listings now reads hidden to another user
    const list = await request(app).get("/properties").set("x-test-user", USER_B);
    const mine = list.body.filter((p) => p.clerk_user_id === USER_A);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((p) => p.location_precision === "hidden")).toBe(true);
  });
});

describe("manual location pin (remote posting)", () => {
  test("create stores the owner-set pin; PUT can move it", async () => {
    const created = await request(app).post("/properties").set("x-test-user", USER_A)
      .send({ ...sampleListing, title: "Remote pin", latitude: 28.6139, longitude: 77.2090 });
    expect(created.status).toBe(201);
    expect(Number(created.body.latitude)).toBeCloseTo(28.6139, 4);

    // Owner moves the pin via edit.
    const moved = await request(app).put(`/properties/${created.body.id}`).set("x-test-user", USER_A)
      .send({ ...sampleListing, title: "Remote pin", latitude: 19.2183, longitude: 72.9781 });
    expect(moved.status).toBe(200);
    expect(Number(moved.body.latitude)).toBeCloseTo(19.2183, 4);

    // A non-owner (exact visibility) sees the moved pin on the public read.
    const seen = await request(app).get(`/properties/${created.body.id}`).set("x-test-user", USER_B);
    expect(Number(seen.body.latitude)).toBeCloseTo(19.2183, 4);
  });
});

describe("price insights", () => {
  test("flags a below-market listing as a good deal vs area comparables", async () => {
    const mk = (title, price) => request(app).post("/properties").set("x-test-user", USER_A).send({
      ...sampleListing, title, price, area: "1,000 sq ft", type: "Apartment", status: "For Sale",
      location: "Insightville, Testcity",
    });
    // three comparables at ₹1 Cr / 1000 sqft ≈ ₹10,000/sqft
    await mk("Comp A", "₹1 Cr"); await mk("Comp B", "₹1 Cr"); await mk("Comp C", "₹1 Cr");
    const target = await mk("Cheap one", "₹75 L"); // ₹7,500/sqft
    const res = await request(app).get(`/properties/${target.body.id}/insights`);
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe("good_deal");
    expect(res.body.areaMedianPerSqft).toBe(10000);
    expect(res.body.sampleSize).toBeGreaterThanOrEqual(3);
    expect(res.body.area).toBe("Insightville");
  });

  test("insufficient sample → verdict insufficient (400 on bad id)", async () => {
    const only = await request(app).post("/properties").set("x-test-user", USER_A).send({
      ...sampleListing, title: "Lonely", price: "₹1 Cr", area: "1,000 sq ft", location: "Nowheresville, Testcity", type: "Land", status: "For Sale",
    });
    const res = await request(app).get(`/properties/${only.body.id}/insights`);
    expect(res.body.verdict).toBe("insufficient");
    expect((await request(app).get("/properties/not-a-uuid/insights")).status).toBe(400);
  });
});

describe("Land parcel boundary", () => {
  const poly = [{ lat: 18.5, lng: 73.8 }, { lat: 18.5, lng: 73.81 }, { lat: 18.51, lng: 73.81 }];
  test("stored on create; owner + exact see it, non-owner sees it when exact", async () => {
    const c = await request(app).post("/properties").set("x-test-user", USER_A).send({
      ...sampleListing, title: "Plot", type: "Land", status: "For Sale", location: "Talegaon, Pune",
      parcel: poly, location_visibility: "exact",
    });
    expect(c.status).toBe(201);
    expect(Array.isArray(c.body.parcel)).toBe(true);
    expect(c.body.parcel.length).toBe(3);
    const other = await request(app).get(`/properties/${c.body.id}`).set("x-test-user", USER_B);
    expect(other.body.parcel).not.toBeNull(); // exact → visible
  });

  test("parcel is redacted for non-owners when not exact", async () => {
    const c = await request(app).post("/properties").set("x-test-user", USER_A).send({
      ...sampleListing, title: "Hidden Plot", type: "Land", status: "For Sale", location: "Talegaon, Pune",
      parcel: poly, location_visibility: "approximate",
    });
    const owner = await request(app).get(`/properties/${c.body.id}`).set("x-test-user", USER_A);
    expect(owner.body.parcel).not.toBeNull(); // owner always sees own
    const other = await request(app).get(`/properties/${c.body.id}`).set("x-test-user", USER_B);
    expect(other.body.parcel).toBeNull(); // approximate → outline hidden from others
  });

  test("bad parcel (too few points) → 400", async () => {
    const res = await request(app).post("/properties").set("x-test-user", USER_A).send({
      ...sampleListing, title: "Bad", parcel: [{ lat: 1, lng: 1 }],
    });
    expect(res.status).toBe(400);
  });
});

describe("owner reviews", () => {
  test("gated by a confirmed visit; rate + aggregate + upsert", async () => {
    const create = await request(app).post("/properties").set("x-test-user", USER_A).send({ ...sampleListing, title: "Review Listing" });
    const pid = create.body.id;
    // no confirmed visit yet → can't review
    expect((await request(app).post(`/users/${USER_A}/reviews`).set("x-test-user", USER_B).send({ rating: 5 })).status).toBe(403);
    // book + owner confirms a visit
    const book = await request(app).post("/visits").set("x-test-user", USER_B).send({ property_id: pid, slot: new Date(Date.now() + 86400000).toISOString() });
    await request(app).post(`/visits/${book.body.id}/respond`).set("x-test-user", USER_A).send({ status: "confirmed" });
    // now eligible
    const rev = await request(app).post(`/users/${USER_A}/reviews`).set("x-test-user", USER_B).send({ rating: 4, text: "Smooth", reviewer_name: "Bee" });
    expect(rev.status).toBe(201);
    const got = await request(app).get(`/users/${USER_A}/reviews`).set("x-test-user", USER_B);
    expect(got.body.count).toBe(1);
    expect(got.body.average).toBe(4);
    expect(got.body.canReview).toBe(true);
    expect(got.body.myReview.rating).toBe(4);
    expect(got.body.reviews[0].reviewer_name).toBe("Bee");
    expect(got.body.reviews[0]).not.toHaveProperty("reviewer_id"); // clerk id not leaked
    // upsert: same reviewer updates, not duplicates
    await request(app).post(`/users/${USER_A}/reviews`).set("x-test-user", USER_B).send({ rating: 5 });
    const got2 = await request(app).get(`/users/${USER_A}/reviews`).set("x-test-user", USER_B);
    expect(got2.body.count).toBe(1);
    expect(got2.body.average).toBe(5);
  });
  test("can't review yourself → 400", async () => {
    expect((await request(app).post(`/users/${USER_A}/reviews`).set("x-test-user", USER_A).send({ rating: 5 })).status).toBe(400);
  });
});

describe("listing reports + auto-hide moderation", () => {
  test("hides after 3 distinct reporters; dedupes; owner can't report own", async () => {
    const create = await request(app).post("/properties").set("x-test-user", USER_A).send({ ...sampleListing, title: "Reported Listing" });
    const pid = create.body.id;
    expect((await request(app).post(`/properties/${pid}/report`).set("x-test-user", USER_A).send({ reason: "x" })).status).toBe(400); // own listing
    await request(app).post(`/properties/${pid}/report`).set("x-test-user", "rep_1").send({ reason: "fake" });
    expect((await request(app).post(`/properties/${pid}/report`).set("x-test-user", "rep_2").send({ reason: "fake" })).body.hidden).toBe(false);
    // same reporter again → dedup (still 2)
    expect((await request(app).post(`/properties/${pid}/report`).set("x-test-user", "rep_2").send({ reason: "fake" })).body.reportCount).toBe(2);
    // third distinct → auto-hidden
    expect((await request(app).post(`/properties/${pid}/report`).set("x-test-user", "rep_3").send({ reason: "fake" })).body.hidden).toBe(true);
    // gone from the public list
    const list = await request(app).get("/properties");
    expect(list.body.some((p) => p.id === pid)).toBe(false);
  });
});

describe("on-site photo verification", () => {
  test("camera photo at the pin → on_site_verified, auto-pins the listing", async () => {
    const created = await request(app).post("/properties").set("x-test-user", USER_A).send({
      ...sampleListing, title: "On-site listing", latitude: null, longitude: null,
      images: ["p1.jpg"],
      photo_geo: [{ url: "p1.jpg", source: "camera", lat: 12.9716, lng: 77.5946, at: "2026-09-04T10:00:00Z" }],
    });
    expect(created.status).toBe(201);
    expect(created.body.on_site_verified).toBe(true);
    // auto-pinned from the on-site capture
    expect(Number(created.body.latitude)).toBeCloseTo(12.9716, 3);

    // A different viewer sees the badge but NOT the raw capture coordinates.
    const other = await request(app).get(`/properties/${created.body.id}`).set("x-test-user", USER_B);
    expect(other.body.on_site_verified).toBe(true);
    expect(other.body.photo_geo[0]).toEqual({ url: "p1.jpg", on_site: true });
    expect(other.body.photo_geo[0].lat).toBeUndefined();
  });

  test("gallery-only photos → not verified; a client cannot fake on_site", async () => {
    const created = await request(app).post("/properties").set("x-test-user", USER_A).send({
      ...sampleListing, title: "Gallery listing", images: ["g1.jpg"],
      photo_geo: [{ url: "g1.jpg", source: "gallery", lat: 12.9716, lng: 77.5946, on_site: true }],
    });
    expect(created.body.on_site_verified).toBe(false);
  });
});

describe("in-app visit scheduling", () => {
  let pid;               // USER_A's listing
  const soon = () => new Date(Date.now() + 86400000).toISOString(); // tomorrow

  beforeAll(async () => {
    const create = await request(app).post("/properties").set("x-test-user", USER_A)
      .send({ ...sampleListing, title: "Visit Listing" });
    pid = create.body.id;
  });

  test("requires auth", async () => {
    expect((await request(app).post("/visits").send({ property_id: pid, slot: soon() })).status).toBe(401);
  });

  test("owner can't book their own listing; rejects past/invalid slots", async () => {
    expect((await request(app).post("/visits").set("x-test-user", USER_A)
      .send({ property_id: pid, slot: soon() })).status).toBe(400);
    expect((await request(app).post("/visits").set("x-test-user", USER_B)
      .send({ property_id: pid, slot: "not-a-date" })).status).toBe(400);
    expect((await request(app).post("/visits").set("x-test-user", USER_B)
      .send({ property_id: pid, slot: new Date(Date.now() - 86400000).toISOString() })).status).toBe(400);
  });

  test("full lifecycle: book → both see it → owner confirms → notifies requester", async () => {
    const book = await request(app).post("/visits").set("x-test-user", USER_B)
      .send({ property_id: pid, slot: soon(), note: "Evening works best" });
    expect(book.status).toBe(201);
    expect(book.body.status).toBe("pending");
    const vid = book.body.id;

    // owner sees it with role=owner; requester sees it with role=requester
    const ownerList = await request(app).get("/visits").set("x-test-user", USER_A);
    expect(ownerList.body.find((v) => v.id === vid)?.role).toBe("owner");
    const reqList = await request(app).get("/visits").set("x-test-user", USER_B);
    expect(reqList.body.find((v) => v.id === vid)?.role).toBe("requester");
    expect(reqList.body.find((v) => v.id === vid)?.property_title).toBe("Visit Listing");

    // requester can't respond; owner can confirm
    expect((await request(app).post(`/visits/${vid}/respond`).set("x-test-user", USER_B)
      .send({ status: "confirmed" })).status).toBe(404);
    const respond = await request(app).post(`/visits/${vid}/respond`).set("x-test-user", USER_A)
      .send({ status: "confirmed" });
    expect(respond.status).toBe(200);
    expect(respond.body.status).toBe("confirmed");

    // requester got a notification
    const notifs = await request(app).get("/notifications").set("x-test-user", USER_B);
    expect(notifs.body.notifications.some((n) => n.type === "visit")).toBe(true);

    // can't respond again (no longer pending)
    expect((await request(app).post(`/visits/${vid}/respond`).set("x-test-user", USER_A)
      .send({ status: "declined" })).status).toBe(404);
  });

  test("either party can cancel", async () => {
    const book = await request(app).post("/visits").set("x-test-user", USER_B)
      .send({ property_id: pid, slot: soon() });
    const vid = book.body.id;
    const cancel = await request(app).post(`/visits/${vid}/cancel`).set("x-test-user", USER_A);
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe("cancelled");
    // cancelling again is a no-op 404
    expect((await request(app).post(`/visits/${vid}/cancel`).set("x-test-user", USER_B)).status).toBe(404);
  });
});

describe("saved searches + notifications", () => {
  test("saved-search CRUD (auth-scoped)", async () => {
    expect((await request(app).get("/saved-searches")).status).toBe(401);
    const create = await request(app).post("/saved-searches").set("x-test-user", USER_B)
      .send({ name: "Villas", type: "House", status: "For Sale", search: "villa" });
    expect(create.status).toBe(201);
    const id = create.body.id;
    const list = await request(app).get("/saved-searches").set("x-test-user", USER_B);
    expect(list.body.some((s) => s.id === id)).toBe(true);
    // another user doesn't see it
    const other = await request(app).get("/saved-searches").set("x-test-user", USER_A);
    expect(other.body.some((s) => s.id === id)).toBe(false);
    // and can't delete it
    expect((await request(app).delete(`/saved-searches/${id}`).set("x-test-user", USER_A)).status).toBe(404);
    expect((await request(app).delete(`/saved-searches/${id}`).set("x-test-user", USER_B)).status).toBe(200);
  });

  test("a matching new listing notifies the searcher (and a non-match does not)", async () => {
    // USER_B saves a search for houses for sale mentioning "villa"
    await request(app).post("/saved-searches").set("x-test-user", USER_B)
      .send({ type: "House", status: "For Sale", search: "villa" });

    // USER_A posts a matching listing
    const match = await request(app).post("/properties").set("x-test-user", USER_A)
      .send({ ...sampleListing, title: "Modern Villa with View", type: "House", status: "For Sale" });
    expect(match.status).toBe(201);

    // USER_A posts a non-matching listing (Land)
    await request(app).post("/properties").set("x-test-user", USER_A)
      .send({ ...sampleListing, title: "Open plot", type: "Land", status: "For Sale" });

    const notifs = await request(app).get("/notifications").set("x-test-user", USER_B);
    const matches = notifs.body.notifications.filter((n) => n.type === "listing_match" && n.data?.propertyId === match.body.id);
    expect(matches.length).toBe(1);
    // the non-matching Land listing produced no listing_match for USER_B
    expect(notifs.body.notifications.some((n) => n.type === "listing_match" && n.body === "Open plot")).toBe(false);
    // the searcher (USER_A, the owner) is never notified about their own listing
    const ownNotifs = await request(app).get("/notifications").set("x-test-user", USER_A);
    expect(ownNotifs.body.notifications.some((n) => n.data?.propertyId === match.body.id)).toBe(false);
  });

  test("a new message creates a notification for the recipient; mark-read clears unread", async () => {
    const listing = await request(app).post("/properties").set("x-test-user", USER_A).send({ ...sampleListing, title: "Notif Listing" });
    await request(app).post(`/messages/${listing.body.id}`).set("x-test-user", USER_B)
      .send({ text: "Interested!", receiver_id: USER_A, sender_name: "Ram" });

    let notifs = await request(app).get("/notifications").set("x-test-user", USER_A);
    expect(notifs.body.notifications.some((n) => n.type === "new_message")).toBe(true);
    expect(notifs.body.unread).toBeGreaterThan(0);

    expect((await request(app).post("/notifications/read").set("x-test-user", USER_A)).status).toBe(200);
    notifs = await request(app).get("/notifications").set("x-test-user", USER_A);
    expect(notifs.body.unread).toBe(0);
  });
});

describe("authorization audit fixes", () => {
  test("removed username→email resolve endpoint → 404", async () => {
    const res = await request(app).get("/auth/resolve?username=someone");
    expect(res.status).toBe(404);
  });

  test("/process only processes bases the caller presigned", async () => {
    const base = "properties/test-jest-base-1";
    await pool.query("INSERT INTO pending_uploads (base, clerk_user_id) VALUES ($1,$2) ON CONFLICT (base) DO NOTHING", [base, USER_A]);
    // USER_B cannot process USER_A's base
    const bad = await request(app).post("/properties/process").set("x-test-user", USER_B).send({ items: [{ base, origKey: base + "_orig" }] });
    expect(bad.body.processed).toBe(0);
    // USER_A can (and it consumes the binding)
    const ok = await request(app).post("/properties/process").set("x-test-user", USER_A).send({ items: [{ base, origKey: base + "_orig" }] });
    expect(ok.body.processed).toBe(1);
    await pool.query("DELETE FROM pending_uploads WHERE base = $1", [base]);
  });
});

describe("admin-only endpoints", () => {
  test("reconcile-owners requires auth (401) and admin (403)", async () => {
    expect((await request(app).post("/properties/reconcile-owners")).status).toBe(401);
    // USER_A is not in ADMIN_USER_IDS (unset in tests) → forbidden
    expect((await request(app).post("/properties/reconcile-owners").set("x-test-user", USER_A)).status).toBe(403);
  });
});

describe("trust & safety: block & report", () => {
  let pid;
  beforeAll(async () => {
    const create = await request(app).post("/properties").set("x-test-user", USER_A).send({ ...sampleListing, title: "Block Listing" });
    pid = create.body.id;
  });

  test("block requires auth (401)", async () => {
    expect((await request(app).post(`/users/${USER_B}/block`)).status).toBe(401);
  });

  test("cannot block yourself (400)", async () => {
    expect((await request(app).post(`/users/${USER_A}/block`).set("x-test-user", USER_A)).status).toBe(400);
  });

  test("blocking prevents messaging (403); unblock restores it", async () => {
    expect((await request(app).post(`/users/${USER_B}/block`).set("x-test-user", USER_A)).status).toBe(200);
    const blocked = await request(app).post(`/messages/${pid}`).set("x-test-user", USER_B).send({ text: "hi", receiver_id: USER_A });
    expect(blocked.status).toBe(403);

    const status = await request(app).get(`/users/${USER_B}/block`).set("x-test-user", USER_A);
    expect(status.body.blockedByMe).toBe(true);

    expect((await request(app).delete(`/users/${USER_B}/block`).set("x-test-user", USER_A)).status).toBe(200);
    const ok = await request(app).post(`/messages/${pid}`).set("x-test-user", USER_B).send({ text: "hi again", receiver_id: USER_A });
    expect(ok.status).toBe(201);
  });

  test("report stores a report", async () => {
    const res = await request(app).post(`/users/${USER_B}/report`).set("x-test-user", USER_A).send({ reason: "Spam", property_id: pid });
    expect(res.status).toBe(200);
    const { rows } = await pool.query("SELECT reason FROM reports WHERE reporter_id=$1 AND reported_id=$2", [USER_A, USER_B]);
    expect(rows.some((r) => r.reason === "Spam")).toBe(true);
  });
});

describe("proposals: visit & offer", () => {
  let pid, visitId, offerId;

  test("propose a visit → pending visit message", async () => {
    const create = await request(app).post("/properties").set("x-test-user", USER_A).send({ ...sampleListing, title: "Proposal Listing" });
    pid = create.body.id;
    const res = await request(app).post(`/messages/${pid}/proposal`).set("x-test-user", USER_B)
      .send({ kind: "visit", receiver_id: USER_A, value: new Date(Date.now() + 86400000).toISOString(), sender_name: "Ram" });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe("visit");
    expect(res.body.meta.status).toBe("pending");
    visitId = res.body.id;
  });

  test("invalid kind → 400", async () => {
    const res = await request(app).post(`/messages/${pid}/proposal`).set("x-test-user", USER_B).send({ kind: "wedding", receiver_id: USER_A, value: "x" });
    expect(res.status).toBe(400);
  });

  test("proposer cannot respond to their own proposal (404)", async () => {
    const res = await request(app).post(`/messages/proposal/${visitId}/respond`).set("x-test-user", USER_B).send({ status: "accepted" });
    expect(res.status).toBe(404);
  });

  test("recipient counters the visit → original countered, new pending back to proposer", async () => {
    const when2 = new Date(Date.now() + 172800000).toISOString();
    const res = await request(app).post(`/messages/proposal/${visitId}/counter`).set("x-test-user", USER_A).send({ value: when2, sender_name: "Amrit" });
    expect(res.status).toBe(201);
    expect(res.body.original.meta.status).toBe("countered");
    expect(res.body.proposal.type).toBe("visit");
    expect(res.body.proposal.receiver_id).toBe(USER_B); // counter goes back to the buyer
    expect(res.body.proposal.meta.status).toBe("pending");
  });

  test("propose an offer → pending offer with amount", async () => {
    const res = await request(app).post(`/messages/${pid}/proposal`).set("x-test-user", USER_B)
      .send({ kind: "offer", receiver_id: USER_A, value: 2300000, sender_name: "Ram" });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe("offer");
    expect(res.body.meta.amount).toBe(2300000);
    offerId = res.body.id;
  });

  test("offer with invalid amount → 400", async () => {
    const res = await request(app).post(`/messages/${pid}/proposal`).set("x-test-user", USER_B).send({ kind: "offer", receiver_id: USER_A, value: -5 });
    expect(res.status).toBe(400);
  });

  test("recipient accepts the offer → accepted", async () => {
    const res = await request(app).post(`/messages/proposal/${offerId}/respond`).set("x-test-user", USER_A).send({ status: "accepted" });
    expect(res.status).toBe(200);
    expect(res.body.meta.status).toBe("accepted");
  });
});

describe("conversations", () => {
  test("GET /messages (authed) → 200 array", async () => {
    const res = await request(app).get("/messages").set("x-test-user", USER_A);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("property CRUD + ownership", () => {
  let createdId;

  test("owner can create a listing → 201", async () => {
    const res = await request(app)
      .post("/properties")
      .set("x-test-user", USER_A)
      .send(sampleListing);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.clerk_user_id).toBe(USER_A);
    expect(res.body.owner_active).toBe(true); // owners are active by default
    expect(res.body).toHaveProperty("owner_image"); // owner image column present
    createdId = res.body.id;
  });

  test("listing appears in owner's /properties/mine", async () => {
    const res = await request(app).get("/properties/mine").set("x-test-user", USER_A);
    expect(res.status).toBe(200);
    expect(res.body.some((p) => p.id === createdId)).toBe(true);
  });

  test("non-owner cannot update it → 404", async () => {
    const res = await request(app)
      .put(`/properties/${createdId}`)
      .set("x-test-user", USER_B)
      .send({ ...sampleListing, title: "Hijacked" });
    expect(res.status).toBe(404);
  });

  test("non-owner cannot delete it → 404", async () => {
    const res = await request(app).delete(`/properties/${createdId}`).set("x-test-user", USER_B);
    expect(res.status).toBe(404);
  });

  test("owner can delete it → 200, then it's gone → 404", async () => {
    const del = await request(app).delete(`/properties/${createdId}`).set("x-test-user", USER_A);
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    const gone = await request(app).get(`/properties/${createdId}`);
    expect(gone.status).toBe(404);
  });
});

describe("input validation (400)", () => {
  const auth = (r) => r.set("x-test-user", USER_A);

  test("create missing required fields → 400", async () => {
    const res = await auth(request(app).post("/properties")).send({ description: "no title/type/etc" });
    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  test("create with invalid type/status → 400", async () => {
    const res = await auth(request(app).post("/properties")).send({
      ...sampleListing, type: "Spaceship", status: "For Barter",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type|status/i);
  });

  test("create with out-of-range beds → 400", async () => {
    const res = await auth(request(app).post("/properties")).send({ ...sampleListing, beds: 9999 });
    expect(res.status).toBe(400);
  });

  test("PUT with malformed uuid → 400", async () => {
    const res = await auth(request(app).put("/properties/not-a-uuid")).send(sampleListing);
    expect(res.status).toBe(400);
  });

  test("DELETE with malformed uuid → 400", async () => {
    const res = await auth(request(app).delete("/properties/not-a-uuid"));
    expect(res.status).toBe(400);
  });

  test("POST /saved with malformed uuid → 400", async () => {
    const res = await auth(request(app).post("/saved/not-a-uuid"));
    expect(res.status).toBe(400);
  });

  test("POST message with empty text → 400", async () => {
    const res = await auth(request(app).post("/messages/00000000-0000-0000-0000-000000000000")).send({ text: "  ", receiver_id: "someone" });
    expect(res.status).toBe(400);
  });

  test("POST message with malformed property uuid → 400", async () => {
    const res = await auth(request(app).post("/messages/not-a-uuid")).send({ text: "hi", receiver_id: "someone" });
    expect(res.status).toBe(400);
  });
});

describe("visibility: soft-hide flagged owners", () => {
  test("flagged owner's listing is hidden from the list but reachable by id", async () => {
    const create = await request(app).post("/properties").set("x-test-user", USER_A).send({ ...sampleListing, title: "Hidden Listing" });
    expect(create.status).toBe(201);
    const id = create.body.id;

    // visible while owner is active
    let list = await request(app).get("/properties");
    expect(list.body.some((p) => p.id === id)).toBe(true);

    // soft-delete: flag the owner inactive (data stays in the DB)
    await pool.query("UPDATE properties SET owner_active = false WHERE id = $1", [id]);

    // hidden from the public list…
    list = await request(app).get("/properties");
    expect(list.body.some((p) => p.id === id)).toBe(false);

    // …but still reachable by direct id (deep links show "unavailable" in the UI)
    const detail = await request(app).get(`/properties/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.owner_active).toBe(false);
  });
});

describe("messaging: two-way delivery", () => {
  let pid;

  test("owner + buyer both see the full thread (peer-scoped)", async () => {
    // USER_A owns a listing
    const create = await request(app).post("/properties").set("x-test-user", USER_A).send({ ...sampleListing, title: "Chat Listing" });
    pid = create.body.id;

    // buyer (USER_B) messages the owner (USER_A), stamping their identity
    const m1 = await request(app).post(`/messages/${pid}`).set("x-test-user", USER_B)
      .send({ text: "Is this available?", receiver_id: USER_A, sender_name: "Ram Buyer", sender_avatar: "RB" });
    expect(m1.status).toBe(201);

    // owner (USER_A) replies to the buyer (USER_B) — must be addressed to the buyer, not self
    const m2 = await request(app).post(`/messages/${pid}`).set("x-test-user", USER_A).send({ text: "Yes it is!", receiver_id: USER_B });
    expect(m2.status).toBe(201);

    // buyer sees BOTH messages (previously the owner's reply never arrived)
    const buyerThread = await request(app).get(`/messages/${pid}?peer=${USER_A}`).set("x-test-user", USER_B);
    expect(buyerThread.body.length).toBe(2);

    // owner sees BOTH messages
    const ownerThread = await request(app).get(`/messages/${pid}?peer=${USER_B}`).set("x-test-user", USER_A);
    expect(ownerThread.body.length).toBe(2);
  });

  test("owner cannot message themselves (400)", async () => {
    const res = await request(app).post(`/messages/${pid}`).set("x-test-user", USER_A).send({ text: "hi me", receiver_id: USER_A });
    expect(res.status).toBe(400);
  });

  test("owner's conversation shows ONE thread with the buyer's name", async () => {
    const convos = await request(app).get("/messages").set("x-test-user", USER_A);
    const rows = convos.body.filter((c) => c.property_id === pid);
    expect(rows.length).toBe(1);              // one thread, not two
    expect(rows[0].peer_id).toBe(USER_B);
    expect(rows[0].peer_name).toBe("Ram Buyer");
  });

  test("read receipts: unread count then mark-read", async () => {
    // USER_A has 1 unread (m1 from USER_B)
    let convos = await request(app).get("/messages").set("x-test-user", USER_A);
    expect(convos.body.find((c) => c.property_id === pid).unread).toBe(1);

    const read = await request(app).post(`/messages/${pid}/read?peer=${USER_B}`).set("x-test-user", USER_A);
    expect(read.status).toBe(200);
    expect(read.body.read).toBe(1);

    convos = await request(app).get("/messages").set("x-test-user", USER_A);
    expect(convos.body.find((c) => c.property_id === pid).unread).toBe(0);
  });

  test("image message: sends a photo without requiring text", async () => {
    const res = await request(app).post(`/messages/${pid}`).set("x-test-user", USER_B)
      .send({ receiver_id: USER_A, image: { url: "http://x/img.jpg", thumb: "http://x/thumb.jpg" } });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe("image");
    expect(res.body.meta.url).toBe("http://x/img.jpg");
  });
});
