const router = require("express").Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getAuth } = require("@clerk/express");
const { validateMessage, isUuid } = require("../validation");
const { sendPush } = require("../push");

router.use(requireAuth);

// GET /messages — list the current user's conversations (one row per property
// they've chatted about), most-recent first. Registered before /:propertyId.
router.get("/", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    // A conversation is between me and one other person (peer) about a property.
    // Group by (property, peer) so an owner gets a separate thread per buyer.
    const { rows } = await pool.query(
      `WITH convo AS (
         SELECT
           m.property_id,
           CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS peer_id,
           m.text       AS last_text,
           m.created_at AS last_time,
           m.sender_id  AS last_sender_id
         FROM messages m
         WHERE m.sender_id = $1 OR m.receiver_id = $1
       )
       SELECT DISTINCT ON (c.property_id, c.peer_id)
         c.property_id, c.peer_id, c.last_text, c.last_time, c.last_sender_id,
         p.title, p.owner_name, p.owner_avatar, p.color, p.img,
         p.owner_active, p.owner_image,
         p.clerk_user_id AS owner_id,
         -- The person I'm chatting with: owner info if the peer is the owner,
         -- otherwise the buyer's identity stamped on their messages.
         COALESCE(CASE WHEN c.peer_id = p.clerk_user_id THEN p.owner_name END,
                  (SELECT mm.sender_name  FROM messages mm WHERE mm.property_id = c.property_id AND mm.sender_id = c.peer_id AND mm.sender_name  IS NOT NULL ORDER BY mm.created_at DESC LIMIT 1),
                  'User') AS peer_name,
         COALESCE(CASE WHEN c.peer_id = p.clerk_user_id THEN p.owner_avatar END,
                  (SELECT mm.sender_avatar FROM messages mm WHERE mm.property_id = c.property_id AND mm.sender_id = c.peer_id AND mm.sender_avatar IS NOT NULL ORDER BY mm.created_at DESC LIMIT 1)) AS peer_avatar,
         COALESCE(CASE WHEN c.peer_id = p.clerk_user_id THEN p.owner_image END,
                  (SELECT mm.sender_image FROM messages mm WHERE mm.property_id = c.property_id AND mm.sender_id = c.peer_id AND mm.sender_image IS NOT NULL ORDER BY mm.created_at DESC LIMIT 1)) AS peer_image,
         (SELECT count(*)::int FROM messages um
           WHERE um.property_id = c.property_id AND um.sender_id = c.peer_id
             AND um.receiver_id = $1 AND um.read_at IS NULL) AS unread
       FROM convo c
       JOIN properties p ON p.id = c.property_id
       ORDER BY c.property_id, c.peer_id, c.last_time DESC`,
      [userId]
    );
    rows.sort((a, b) => new Date(b.last_time) - new Date(a.last_time));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /messages/:propertyId — a conversation. With ?peer=<clerkId> it returns the
// exact two-person thread (me <-> peer); without it, everything I'm part of on
// this property (back-compat).
router.get("/:propertyId", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { peer } = req.query;
    const { rows } = peer
      ? await pool.query(
          `SELECT * FROM messages
           WHERE property_id = $1
             AND ((sender_id = $2 AND receiver_id = $3) OR (sender_id = $3 AND receiver_id = $2))
           ORDER BY created_at ASC`,
          [req.params.propertyId, userId, peer]
        )
      : await pool.query(
          `SELECT * FROM messages
           WHERE property_id = $1 AND (sender_id = $2 OR receiver_id = $2)
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
    const { text, receiver_id, sender_name, sender_avatar, sender_image } = req.body;
    // Never let a message be addressed to its own sender (the old delivery bug).
    if (String(receiver_id) === String(userId)) {
      return res.status(400).json({ error: "You can't message yourself." });
    }

    const { rows } = await pool.query(
      `INSERT INTO messages (property_id, sender_id, receiver_id, text, sender_name, sender_avatar, sender_image)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.propertyId, userId, receiver_id, text, sender_name || null, sender_avatar || null, sender_image || null]
    );
    // Real-time: push the new message to both participants' rooms.
    const io = req.app.get("io");
    if (io) io.to(String(receiver_id)).to(String(userId)).emit("message", rows[0]);
    // Push notification to the recipient (for when their app is closed).
    sendPush(receiver_id, {
      title: sender_name || "New message",
      body: text.length > 120 ? text.slice(0, 117) + "…" : text,
      data: { propertyId: req.params.propertyId, peer: userId },
    });
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /messages/:propertyId/read?peer=<id> — mark messages FROM peer TO me as read.
router.post("/:propertyId/read", async (req, res) => {
  try {
    if (!isUuid(req.params.propertyId)) return res.status(400).json({ error: "Invalid property id" });
    const { userId } = getAuth(req);
    const { peer } = req.query;
    if (!peer) return res.status(400).json({ error: "peer is required" });
    const { rowCount } = await pool.query(
      `UPDATE messages SET read_at = NOW()
       WHERE property_id = $1 AND sender_id = $2 AND receiver_id = $3 AND read_at IS NULL`,
      [req.params.propertyId, peer, userId]
    );
    // Notify the peer so their sent messages flip to "seen" (✓✓) in real time.
    const io = req.app.get("io");
    if (io && rowCount) io.to(String(peer)).emit("read", { propertyId: req.params.propertyId, by: userId });
    res.json({ read: rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
