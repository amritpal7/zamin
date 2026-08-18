const router = require("express").Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getAuth } = require("@clerk/express");

router.use(requireAuth);

// POST /push/register { token } — associate an Expo push token with the current user.
router.post("/register", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token required" });
    await pool.query(
      `INSERT INTO push_tokens (token, clerk_user_id, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (token) DO UPDATE SET clerk_user_id = $2, updated_at = NOW()`,
      [token, userId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /push/unregister { token } — remove one of MY tokens (e.g. on sign-out).
router.post("/unregister", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { token } = req.body;
    if (token) await pool.query("DELETE FROM push_tokens WHERE token = $1 AND clerk_user_id = $2", [token, userId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
