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
});
