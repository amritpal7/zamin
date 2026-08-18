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

module.exports = router;
