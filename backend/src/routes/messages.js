const router = require("express").Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getAuth } = require("@clerk/express");
const { validateMessage, isUuid } = require("../validation");

router.use(requireAuth);

// GET /messages — list the current user's conversations (one row per property
// they've chatted about), most-recent first. Registered before /:propertyId.
router.get("/", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (m.property_id)
         m.property_id,
         p.title, p.owner_name, p.owner_avatar, p.color, p.img,
         p.owner_active,
         p.clerk_user_id AS owner_id,
         m.text       AS last_text,
         m.created_at AS last_time,
         m.sender_id  AS last_sender_id
       FROM messages m
       JOIN properties p ON p.id = m.property_id
       WHERE m.sender_id = $1 OR m.receiver_id = $1
       ORDER BY m.property_id, m.created_at DESC`,
      [userId]
    );
    rows.sort((a, b) => new Date(b.last_time) - new Date(a.last_time));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /messages/:propertyId — conversation for a property
router.get("/:propertyId", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { rows } = await pool.query(
      `SELECT * FROM messages
       WHERE property_id = $1
         AND (sender_id = $2 OR receiver_id = $2)
       ORDER BY created_at ASC`,
      [req.params.propertyId, userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /messages/:propertyId — send a message
router.post("/:propertyId", async (req, res) => {
  try {
    if (!isUuid(req.params.propertyId)) return res.status(400).json({ error: "Invalid property id" });
    const errors = validateMessage(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join("; "), errors });
    const { userId } = getAuth(req);
    const { text, receiver_id } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO messages (property_id, sender_id, receiver_id, text)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.propertyId, userId, receiver_id, text]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
