const router = require("express").Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getAuth } = require("@clerk/express");
const { isUuid } = require("../validation");
const { areBlocked } = require("../blocks");
const { createNotification } = require("../notify");
const { sendPush } = require("../push");

const STATUSES = ["pending", "confirmed", "declined", "cancelled"];

// Notify one party of a visit change (best-effort; never fails the request).
async function notify(userId, { title, body, visit }) {
  try {
    await createNotification(pool, userId, {
      type: "visit", title, body,
      data: { visitId: visit.id, propertyId: visit.property_id, kind: "visit" },
    });
    sendPush(userId, { title, body, data: { propertyId: visit.property_id, kind: "visit" } });
  } catch (e) { console.error("visit notify failed:", e.message); }
}

// POST /visits { property_id, slot, note } — requester books a viewing slot.
router.post("/", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { property_id, slot, note } = req.body || {};
    if (!isUuid(property_id)) return res.status(400).json({ error: "Invalid property id" });

    const when = Date.parse(slot);
    if (isNaN(when)) return res.status(400).json({ error: "Invalid date/time" });
    if (when < Date.now()) return res.status(400).json({ error: "Pick a time in the future" });
    if (note != null && (typeof note !== "string" || note.length > 500))
      return res.status(400).json({ error: "Note too long" });

    const { rows: props } = await pool.query("SELECT clerk_user_id FROM properties WHERE id = $1", [property_id]);
    if (!props[0]) return res.status(404).json({ error: "Property not found" });
    const ownerId = props[0].clerk_user_id;
    if (ownerId === userId) return res.status(400).json({ error: "You can't book a visit to your own listing" });
    if (await areBlocked(pool, userId, ownerId)) return res.status(403).json({ error: "Unavailable with this user." });

    const { rows } = await pool.query(
      `INSERT INTO visits (property_id, requester_id, owner_id, slot, note)
       VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), $5) RETURNING *`,
      [property_id, userId, ownerId, when, note || null]
    );
    const visit = rows[0];
    await notify(ownerId, { title: "New visit request", body: "Someone requested to view your listing", visit });
    res.status(201).json(visit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /visits — every visit where I'm the requester or the owner, with a `role`
// and the listing's title/img/thumbnail. Upcoming first, then past.
router.get("/", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { rows } = await pool.query(
      `SELECT v.*,
              p.title AS property_title, p.img AS property_img, p.thumbnails AS property_thumbnails,
              CASE WHEN v.owner_id = $1 THEN 'owner' ELSE 'requester' END AS role
         FROM visits v
         JOIN properties p ON p.id = v.property_id
        WHERE v.requester_id = $1 OR v.owner_id = $1
        ORDER BY (v.slot >= NOW()) DESC, v.slot ASC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /visits/:id/respond { status: confirmed|declined } — owner responds to a
// pending request.
router.post("/:id/respond", requireAuth, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid visit id" });
    const { userId } = getAuth(req);
    const { status } = req.body || {};
    if (status !== "confirmed" && status !== "declined")
      return res.status(400).json({ error: "status must be confirmed or declined" });

    const { rows } = await pool.query(
      `UPDATE visits SET status = $1, updated_at = NOW()
        WHERE id = $2 AND owner_id = $3 AND status = 'pending'
        RETURNING *`,
      [status, req.params.id, userId]
    );
    if (!rows[0]) return res.status(404).json({ error: "No pending request to respond to" });
    const visit = rows[0];
    await notify(visit.requester_id, {
      title: status === "confirmed" ? "Visit confirmed" : "Visit declined",
      body: status === "confirmed" ? "The owner confirmed your viewing" : "The owner can't make that time",
      visit,
    });
    res.json(visit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /visits/:id/cancel — either participant cancels (unless already cancelled).
router.post("/:id/cancel", requireAuth, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid visit id" });
    const { userId } = getAuth(req);
    const { rows } = await pool.query(
      `UPDATE visits SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1 AND (requester_id = $2 OR owner_id = $2) AND status <> 'cancelled'
        RETURNING *`,
      [req.params.id, userId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found or already cancelled" });
    const visit = rows[0];
    const other = visit.requester_id === userId ? visit.owner_id : visit.requester_id;
    await notify(other, { title: "Visit cancelled", body: "A scheduled visit was cancelled", visit });
    res.json(visit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
