const router = require("express").Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getAuth } = require("@clerk/express");

router.use(requireAuth);

// GET /notifications — my notifications (newest first) + unread count.
router.get("/", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { rows } = await pool.query(
      "SELECT * FROM notifications WHERE clerk_user_id = $1 ORDER BY created_at DESC LIMIT 100",
      [userId]
    );
    const unread = rows.filter((r) => !r.read_at).length;
    res.json({ notifications: rows, unread });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /notifications/read — mark all my notifications as read.
router.post("/read", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { rowCount } = await pool.query(
      "UPDATE notifications SET read_at = NOW() WHERE clerk_user_id = $1 AND read_at IS NULL",
      [userId]
    );
    res.json({ read: rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
