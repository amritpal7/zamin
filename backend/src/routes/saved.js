const router = require("express").Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getAuth } = require("@clerk/express");
const { isUuid } = require("../validation");
const { publicListing } = require("../listingView");

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
         AND p.owner_active IS DISTINCT FROM false
         AND p.flagged IS DISTINCT FROM true AND p.owner_banned IS NOT TRUE
       ORDER BY s.created_at DESC`,
      [userId]
    );
    // Same privacy view as the public feed (location precision + no owner phone).
    res.json(rows.map((r) => publicListing(r, userId)));
  } catch (err) {
    console.error("[saved]", err.message || err.code || String(err));
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// POST /saved/:propertyId — save a property
router.post("/:propertyId", async (req, res) => {
  try {
    if (!isUuid(req.params.propertyId)) return res.status(400).json({ error: "Invalid property id" });
    const { userId } = getAuth(req);
    await pool.query(
      "INSERT INTO saved_properties (clerk_user_id, property_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, req.params.propertyId]
    );
    res.json({ saved: true });
  } catch (err) {
    console.error("[saved]", err.message || err.code || String(err));
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// DELETE /saved/:propertyId — unsave
router.delete("/:propertyId", async (req, res) => {
  try {
    if (!isUuid(req.params.propertyId)) return res.status(400).json({ error: "Invalid property id" });
    const { userId } = getAuth(req);
    await pool.query(
      "DELETE FROM saved_properties WHERE clerk_user_id = $1 AND property_id = $2",
      [userId, req.params.propertyId]
    );
    res.json({ saved: false });
  } catch (err) {
    console.error("[saved]", err.message || err.code || String(err));
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

module.exports = router;
