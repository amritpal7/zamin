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
