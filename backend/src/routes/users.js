const router = require("express").Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getAuth } = require("@clerk/express");

router.use(requireAuth);

// POST /users/:userId/block — block a user (I no longer exchange messages with them).
router.post("/:userId/block", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const target = req.params.userId;
    if (!target || target === userId) return res.status(400).json({ error: "Invalid user" });
    await pool.query(
      "INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, target]
    );
    res.json({ blocked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /users/:userId/block — unblock.
router.delete("/:userId/block", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    await pool.query("DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2", [userId, req.params.userId]);
    res.json({ blocked: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users/:userId/block — is this relationship blocked, and which way?
router.get("/:userId/block", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const target = req.params.userId;
    const { rows } = await pool.query(
      "SELECT blocker_id FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)",
      [userId, target]
    );
    res.json({
      blockedByMe: rows.some((r) => r.blocker_id === userId),
      blockedMe:   rows.some((r) => r.blocker_id === target),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /users/:userId/report { reason, property_id } — file a report for moderation.
router.post("/:userId/report", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const target = req.params.userId;
    if (!target || target === userId) return res.status(400).json({ error: "Invalid user" });
    const { reason, property_id } = req.body;
    await pool.query(
      "INSERT INTO reports (reporter_id, reported_id, property_id, reason) VALUES ($1, $2, $3, $4)",
      [userId, target, property_id || null, (reason || "unspecified").slice(0, 100)]
    );
    res.json({ reported: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users/:userId/reviews — owner's rating summary + recent reviews + my own review.
router.get("/:userId/reviews", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const owner = req.params.userId;
    const { rows } = await pool.query(
      "SELECT reviewer_id, reviewer_name, reviewer_avatar, rating, text, updated_at FROM reviews WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT 50",
      [owner]
    );
    const count = rows.length;
    const average = count ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : null;
    // Has the caller had a confirmed visit with this owner? (→ eligible to review)
    const { rows: v } = await pool.query(
      "SELECT 1 FROM visits WHERE owner_id = $1 AND requester_id = $2 AND status = 'confirmed' LIMIT 1",
      [owner, userId]
    );
    res.json({
      average, count,
      canReview: owner !== userId && v.length > 0,
      myReview: rows.find((r) => r.reviewer_id === userId) || null,
      reviews: rows.map(({ reviewer_id, ...r }) => r), // don't leak reviewer clerk ids
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /users/:userId/reviews { rating, text, reviewer_name, reviewer_avatar } — rate an
// owner. Gated: can't review yourself, and only after a CONFIRMED visit with them.
router.post("/:userId/reviews", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const owner = req.params.userId;
    if (!owner || owner === userId) return res.status(400).json({ error: "You can't review yourself." });
    const rating = parseInt(req.body?.rating, 10);
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: "rating must be 1–5" });
    const { rows: v } = await pool.query(
      "SELECT 1 FROM visits WHERE owner_id = $1 AND requester_id = $2 AND status = 'confirmed' LIMIT 1",
      [owner, userId]
    );
    if (!v.length) return res.status(403).json({ error: "You can review an owner only after a confirmed visit." });
    const text = (req.body?.text || "").slice(0, 1000) || null;
    const { rows } = await pool.query(
      `INSERT INTO reviews (owner_id, reviewer_id, reviewer_name, reviewer_avatar, rating, text)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (owner_id, reviewer_id)
       DO UPDATE SET rating = $5, text = $6, reviewer_name = $3, reviewer_avatar = $4, updated_at = NOW()
       RETURNING rating, text, updated_at`,
      [owner, userId, (req.body?.reviewer_name || "User").slice(0, 255), (req.body?.reviewer_avatar || "U").slice(0, 10), rating, text]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
