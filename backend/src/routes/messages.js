const router = require("express").Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getAuth } = require("@clerk/express");
const { validateMessage, isUuid } = require("../validation");
const { sendPush } = require("../push");
const { areBlocked } = require("../blocks");

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
    const { userId } = getAuth(req);
    const { receiver_id, sender_name, sender_avatar, sender_image, image } = req.body;
    const isImage = image && typeof image.url === "string";
    // Text messages must pass validation; image messages just need a recipient.
    if (!isImage) {
      const errors = validateMessage(req.body);
      if (errors.length) return res.status(400).json({ error: errors.join("; "), errors });
    } else if (!receiver_id) {
      return res.status(400).json({ error: "receiver_id required" });
    }
    // Never let a message be addressed to its own sender (the old delivery bug).
    if (String(receiver_id) === String(userId)) {
      return res.status(400).json({ error: "You can't message yourself." });
    }
    if (await areBlocked(pool, userId, receiver_id)) {
      return res.status(403).json({ error: "Messaging is unavailable with this user." });
    }

    const type = isImage ? "image" : "text";
    const meta = isImage ? JSON.stringify({ url: image.url, thumb: image.thumb || image.url }) : null;
    const text = isImage ? (req.body.text || "📷 Photo") : req.body.text;

    const { rows } = await pool.query(
      `INSERT INTO messages (property_id, sender_id, receiver_id, text, type, meta, sender_name, sender_avatar, sender_image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.params.propertyId, userId, receiver_id, text, type, meta, sender_name || null, sender_avatar || null, sender_image || null]
    );
    // Real-time: push the new message to both participants' rooms.
    const io = req.app.get("io");
    if (io) io.to(String(receiver_id)).to(String(userId)).emit("message", rows[0]);
    // Push notification to the recipient (for when their app is closed).
    sendPush(receiver_id, {
      title: sender_name || "New message",
      body: isImage ? "📷 Photo" : (text.length > 120 ? text.slice(0, 117) + "…" : text),
      data: { propertyId: req.params.propertyId, peer: userId },
    });
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Structured proposals: a visit (when) or an offer (amount) you can accept,
//    decline, or counter (propose a new value back). ────────────────────────────
const PROPOSAL_FIELD = { visit: "when", offer: "amount" };
const PROPOSAL_TEXT  = { visit: "📅 Visit request", offer: "💰 Offer" };

function proposalValue(kind, value) {
  if (kind === "visit") return value && !isNaN(Date.parse(value)) ? value : null;
  if (kind === "offer") { const n = Number(value); return n > 0 ? n : null; }
  return null;
}

function createProposal(pool, { propertyId, senderId, receiverId, kind, value, extraMeta = {}, sender }) {
  const meta = { status: "pending", by: senderId, [PROPOSAL_FIELD[kind]]: value, ...extraMeta };
  return pool.query(
    `INSERT INTO messages (property_id, sender_id, receiver_id, text, type, meta, sender_name, sender_avatar, sender_image)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [propertyId, senderId, receiverId, PROPOSAL_TEXT[kind], kind, JSON.stringify(meta),
     sender?.sender_name || null, sender?.sender_avatar || null, sender?.sender_image || null]
  ).then((r) => r.rows[0]);
}

// POST /messages/:propertyId/proposal { kind, receiver_id, value, sender_* } — create a proposal.
router.post("/:propertyId/proposal", async (req, res) => {
  try {
    if (!isUuid(req.params.propertyId)) return res.status(400).json({ error: "Invalid property id" });
    const { userId } = getAuth(req);
    const { kind, receiver_id, value } = req.body;
    if (!PROPOSAL_FIELD[kind]) return res.status(400).json({ error: "Invalid kind" });
    if (!receiver_id || String(receiver_id) === String(userId)) return res.status(400).json({ error: "Invalid recipient" });
    const v = proposalValue(kind, value);
    if (v === null) return res.status(400).json({ error: kind === "visit" ? "Invalid date/time" : "Invalid amount" });
    if (await areBlocked(pool, userId, receiver_id)) return res.status(403).json({ error: "Unavailable with this user." });

    const row = await createProposal(pool, {
      propertyId: req.params.propertyId, senderId: userId, receiverId: receiver_id, kind, value: v, sender: req.body,
    });
    const io = req.app.get("io");
    if (io) io.to(String(receiver_id)).to(String(userId)).emit("message", row);
    sendPush(receiver_id, {
      title: req.body.sender_name || (kind === "visit" ? "Visit request" : "New offer"),
      body: kind === "visit" ? "Proposed a property visit" : "Made an offer",
      data: { propertyId: req.params.propertyId, peer: userId },
    });
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /messages/proposal/:id/respond { status: accepted|declined } — recipient responds.
router.post("/proposal/:id/respond", async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid id" });
    const { userId } = getAuth(req);
    const { status } = req.body;
    if (!["accepted", "declined"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    const { rows } = await pool.query(
      `UPDATE messages SET meta = jsonb_set(meta, '{status}', to_jsonb($1::text))
       WHERE id = $2 AND type IN ('visit','offer') AND receiver_id = $3 AND meta->>'status' = 'pending'
       RETURNING *`,
      [status, req.params.id, userId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found or not allowed" });
    const io = req.app.get("io");
    if (io) io.to(String(rows[0].sender_id)).to(String(rows[0].receiver_id)).emit("message-update", rows[0]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /messages/proposal/:id/counter { value, sender_* } — recipient marks the pending
// proposal "countered" and sends a fresh proposal (new time/amount) back to the proposer.
router.post("/proposal/:id/counter", async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid id" });
    const { userId } = getAuth(req);
    const orig = (await pool.query(
      `SELECT * FROM messages WHERE id = $1 AND type IN ('visit','offer') AND receiver_id = $2 AND meta->>'status' = 'pending'`,
      [req.params.id, userId]
    )).rows[0];
    if (!orig) return res.status(404).json({ error: "Not found or not allowed" });
    const kind = orig.type;
    const v = proposalValue(kind, req.body.value);
    if (v === null) return res.status(400).json({ error: kind === "visit" ? "Invalid date/time" : "Invalid amount" });

    const updatedOrig = (await pool.query(
      `UPDATE messages SET meta = jsonb_set(meta, '{status}', to_jsonb('countered'::text)) WHERE id = $1 RETURNING *`,
      [orig.id]
    )).rows[0];
    const created = await createProposal(pool, {
      propertyId: orig.property_id, senderId: userId, receiverId: orig.sender_id, kind, value: v,
      extraMeta: { counter_of: orig.id }, sender: req.body,
    });
    const io = req.app.get("io");
    if (io) {
      io.to(String(orig.sender_id)).to(String(userId)).emit("message-update", updatedOrig);
      io.to(String(orig.sender_id)).to(String(userId)).emit("message", created);
    }
    sendPush(orig.sender_id, {
      title: req.body.sender_name || "Counter proposal",
      body: kind === "visit" ? "Proposed another time" : "Countered your offer",
      data: { propertyId: orig.property_id, peer: userId },
    });
    res.status(201).json({ original: updatedOrig, proposal: created });
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
