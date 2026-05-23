const router = require("express").Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getAuth } = require("@clerk/express");

router.use(requireAuth);

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
