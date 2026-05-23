const router = require("express").Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getAuth } = require("@clerk/express");

// All saved routes require auth
router.use(requireAuth);

// GET /saved — my saved properties
router.get("/", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { rows } = await pool.query(
      `SELECT p.* FROM properties p
       JOIN saved_properties s ON p.id = s.property_id
       WHERE s.clerk_user_id = $1
       ORDER BY s.created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /saved/:propertyId — save a property
router.post("/:propertyId", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    await pool.query(
      "INSERT INTO saved_properties (clerk_user_id, property_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, req.params.propertyId]
    );
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /saved/:propertyId — unsave
router.delete("/:propertyId", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    await pool.query(
      "DELETE FROM saved_properties WHERE clerk_user_id = $1 AND property_id = $2",
      [userId, req.params.propertyId]
    );
    res.json({ saved: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
