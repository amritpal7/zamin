// Moderation for admins (Clerk user ids in ADMIN_USER_IDS, comma-separated).
//   GET  /admin/status                 → { admin } for any signed-in user (client shows the menu row)
//   GET  /admin/reports                → { listings: [...], users: [...] } open report queues
//   POST /admin/listings/:id { action: "hide" | "restore" | "dismiss" }
//   POST /admin/users/:id    { action: "dismiss" | "ban" | "unban" }
// "ban" blocks the account from signing in (Clerk) and hides all its listings; "unban" reverses both.
const router = require("express").Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getAuth } = require("@clerk/express");
const { isUuid } = require("../validation");
const { getUser } = require("../clerkUsers");
const { markBanned, clearBanned } = require("../revocation");

const ADMIN_IDS = () => (process.env.ADMIN_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
const isAdmin = (userId) => !!userId && ADMIN_IDS().includes(userId);

router.use(requireAuth);

router.get("/status", (req, res) => res.json({ admin: isAdmin(getAuth(req).userId) }));

router.use((req, res, next) => (isAdmin(getAuth(req).userId) ? next() : res.status(403).json({ error: "Admins only" })));

const fail = (res, err) => {
  console.error("[admin]", err.message || err.code || String(err));
  res.status(500).json({ error: "Something went wrong. Please try again." });
};

router.get("/reports", async (_req, res) => {
  try {
    const { rows: listings } = await pool.query(
      `SELECT p.id, p.title, p.location, p.clerk_user_id AS owner_id, p.owner_name, p.owner_username,
              p.flagged, p.owner_banned, p.images[1] AS image, p.thumbnails[1] AS thumb,
              COUNT(DISTINCT r.reporter_id)::int AS reporters,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT r.reason), NULL) AS reasons,
              MAX(r.created_at) AS last_reported_at
         FROM reports r JOIN properties p ON p.id = r.property_id
        GROUP BY p.id
        ORDER BY p.flagged DESC, reporters DESC, last_reported_at DESC
        LIMIT 200`
    );
    const { rows: userRows } = await pool.query(
      `SELECT reported_id AS user_id,
              COUNT(DISTINCT reporter_id)::int AS reporters,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT reason), NULL) AS reasons,
              MAX(created_at) AS last_reported_at
         FROM reports WHERE property_id IS NULL
        GROUP BY reported_id
        ORDER BY reporters DESC, last_reported_at DESC
        LIMIT 100`
    );
    // Display names come from Clerk (users live there, not in Postgres) — 10 lookups at a time.
    const users = [];
    for (let i = 0; i < userRows.length; i += 10) {
      users.push(...await Promise.all(userRows.slice(i, i + 10).map(async (r) => {
        const u = await getUser(r.user_id);
        return { ...r, name: u.name || null, username: u.username || null, exists: u.exists, banned: !!u.banned };
      })));
    }
    res.json({ listings, users });
  } catch (err) { fail(res, err); }
});

router.post("/listings/:id", async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid listing id" });
    const action = req.body?.action;
    if (!["hide", "restore", "dismiss"].includes(action)) return res.status(400).json({ error: "Invalid action" });
    if (action === "dismiss") {
      // Reports were unfounded: clear them and make sure the listing is visible.
      await pool.query("DELETE FROM reports WHERE property_id = $1", [req.params.id]);
      await pool.query("UPDATE properties SET flagged = false WHERE id = $1", [req.params.id]);
      console.log("[moderation]", JSON.stringify({ actor: getAuth(req).userId, action, listing: req.params.id }));
      return res.json({ id: req.params.id, flagged: false, dismissed: true });
    }
    const flagged = action === "hide";
    const { rowCount } = await pool.query("UPDATE properties SET flagged = $1 WHERE id = $2", [flagged, req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Not found" });
    console.log("[moderation]", JSON.stringify({ actor: getAuth(req).userId, action, listing: req.params.id }));
    res.json({ id: req.params.id, flagged });
  } catch (err) { fail(res, err); }
});

const CLERK_USER_ID = /^user_[A-Za-z0-9]+$/;
async function clerkBan(userId, ban) {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("Clerk not configured");
  const r = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}/${ban ? "ban" : "unban"}`, {
    method: "POST", headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw Object.assign(new Error(`Clerk ${ban ? "ban" : "unban"} ${r.status}`), { status: r.status });
}

router.post("/users/:id", async (req, res) => {
  try {
    const target = req.params.id;
    const action = req.body?.action;
    if (!["dismiss", "ban", "unban"].includes(action)) return res.status(400).json({ error: "Invalid action" });
    if (!/^(?:user_[A-Za-z0-9]+|seed_user_\d+)$/.test(target || "")) return res.status(400).json({ error: "Invalid user id" });
    const actor = getAuth(req).userId;
    if (action === "dismiss") {
      await pool.query("DELETE FROM reports WHERE reported_id = $1 AND property_id IS NULL", [target]);
      console.log("[moderation]", JSON.stringify({ actor, action, target }));
      return res.json({ user_id: target, dismissed: true });
    }
    if (!CLERK_USER_ID.test(target)) return res.status(400).json({ error: "Invalid user id" });
    if (isAdmin(target)) return res.status(400).json({ error: "Admins can't be banned here." });
    const ban = action === "ban";
    try {
      await clerkBan(target, ban);
    } catch (e) {
      if (e.status === 404) return res.status(404).json({ error: "User not found." });
      throw e;
    }
    // Separate column from per-listing `flagged`: unban must not un-hide listings hidden for their own reasons.
    await pool.query("UPDATE properties SET owner_banned = $1 WHERE clerk_user_id = $2", [ban, target]);
    if (ban) {
      await markBanned(target);                                   // reject still-valid JWTs now
      try { req.app.get("io")?.in(String(target)).disconnectSockets(true); } catch {}
    } else {
      await clearBanned(target);
    }
    console.log("[moderation]", JSON.stringify({ actor, action, target }));
    res.json({ user_id: target, banned: ban });
  } catch (err) { fail(res, err); }
});

module.exports = router;
module.exports.isAdmin = isAdmin;
