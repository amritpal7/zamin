const router = require("express").Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getAuth } = require("@clerk/express");
const { isUuid } = require("../validation");

router.use(requireAuth);

const TYPES = ["All", "House", "Apartment", "Land", "Commercial"];
const STATUSES = ["All", "For Sale", "For Rent"];

// POST /saved-searches { name?, type, status, search } — save a search.
router.post("/", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const type = TYPES.includes(req.body?.type) ? req.body.type : "All";
    const status = STATUSES.includes(req.body?.status) ? req.body.status : "All";
    const search = typeof req.body?.search === "string" ? req.body.search.slice(0, 255) : "";
    const name = typeof req.body?.name === "string" ? req.body.name.slice(0, 120) : null;
    const { rows } = await pool.query(
      `INSERT INTO saved_searches (clerk_user_id, name, type, status, search)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, name, type, status, search]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /saved-searches — my saved searches.
router.get("/", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { rows } = await pool.query(
      "SELECT * FROM saved_searches WHERE clerk_user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /saved-searches/:id — delete one of mine.
router.delete("/:id", async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid id" });
    const { userId } = getAuth(req);
    const { rowCount } = await pool.query(
      "DELETE FROM saved_searches WHERE id = $1 AND clerk_user_id = $2",
      [req.params.id, userId]
    );
    if (!rowCount) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
