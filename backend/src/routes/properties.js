const router = require("express").Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getAuth } = require("@clerk/express");

// GET /properties — list all (public)
router.get("/", async (req, res) => {
  try {
    const { type, status, search } = req.query;
    let query = "SELECT * FROM properties WHERE 1=1";
    const params = [];

    if (type && type !== "All") {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }
    if (status && status !== "All") {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (title ILIKE $${params.length} OR location ILIKE $${params.length})`;
    }

    query += " ORDER BY created_at DESC";
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /properties/:id — single property (public)
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM properties WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /properties — create listing (auth required)
router.post("/", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { title, description, type, status, price, area, beds, baths, location, latitude, longitude, tags, img, color, owner_name, owner_phone, owner_avatar } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO properties
        (clerk_user_id, owner_name, owner_phone, owner_avatar, title, description, type, status, price, area, beds, baths, location, latitude, longitude, tags, img, color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [userId, owner_name, owner_phone, owner_avatar, title, description, type, status, price, area, beds, baths, location, latitude, longitude, tags, img || "🏠", color || "#f0a500"]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /properties/:id — only owner can delete
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { rowCount } = await pool.query(
      "DELETE FROM properties WHERE id = $1 AND clerk_user_id = $2",
      [req.params.id, userId]
    );
    if (!rowCount) return res.status(404).json({ error: "Not found or not owner" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
