const router = require("express").Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getAuth } = require("@clerk/express");
const rateLimit = require("express-rate-limit");
const sharp = require("sharp");
const { GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { s3, BUCKET } = require("../storage");
const { setProfileImage, reconcileOwner, deleteClerkUser, getUser } = require("../clerkUsers");
const { purgeUserData, deleteOwnedMedia } = require("../accountDeletion");
const { forgetSenderIdentity } = require("../messaging");

router.use(requireAuth);

// POST /users/me/photo { base } — set the caller's profile photo. The client first
// uploads the raw image through the normal presign flow (POST /properties/presign,
// PUT to storage) and then calls this instead of /properties/process. We consume the
// caller's pending_uploads binding (so only an object THEY presigned can be used),
// re-encode it with sharp (strips EXIF/GPS, rejects non-images, caps size), forward it
// to Clerk with the secret key, then propagate the new URL to their listings.
const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
const AVATAR_FORMATS = new Set(["jpeg", "png", "webp", "heif"]);
const SHARP_OPTS = { limitInputPixels: 25e6, sequentialRead: true }; // decompression-bomb cap
// Per-user limit: each call does 2 Clerk Backend API requests + a sharp decode; Clerk's limit is
// app-wide, so one looping account must not exhaust it for everyone.
const photoLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => getAuth(req).userId || req.ip,
  message: { error: "Too many photo changes. Please try again in a few minutes." },
});
router.post("/me/photo", photoLimiter, async (req, res) => {
  const { userId } = getAuth(req);
  const base = String(req.body?.base || "");
  if (!/^properties\/[A-Za-z0-9-]+$/.test(base)) return res.status(400).json({ error: "Invalid upload" });
  const origKey = `${base}_orig`;
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM pending_uploads WHERE base = $1 AND clerk_user_id = $2", [base, userId]
    );
    if (!rowCount) return res.status(403).json({ error: "Upload not found" });

    let buf;
    try {
      const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: origKey }));
      // Fail closed if the size is unknown, and re-check after reading.
      if (typeof obj.ContentLength !== "number" || obj.ContentLength > MAX_AVATAR_BYTES) {
        return res.status(413).json({ error: "Photo is too large (max 10 MB)." });
      }
      buf = Buffer.from(await obj.Body.transformToByteArray());
      if (buf.length > MAX_AVATAR_BYTES) return res.status(413).json({ error: "Photo is too large (max 10 MB)." });
    } catch {
      return res.status(400).json({ error: "Photo upload didn't arrive. Please try again." });
    } finally {
      s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: origKey })).catch(() => {});
    }

    let jpeg;
    try {
      const meta = await sharp(buf, SHARP_OPTS).metadata();
      if (!AVATAR_FORMATS.has(meta.format)) throw new Error(`format ${meta.format}`); // no SVG/PDF/TIFF
      jpeg = await sharp(buf, SHARP_OPTS).rotate()
        .resize(512, 512, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
    } catch {
      return res.status(400).json({ error: "That file isn't a supported image." });
    }

    const imageUrl = await setProfileImage(userId, jpeg);
    forgetSenderIdentity(userId);
    await reconcileOwner(pool, userId).catch((e) => console.error("[me/photo] reconcile", e.message));
    res.json({ imageUrl });
  } catch (err) {
    console.error("[me/photo]", err.message);
    res.status(502).json({ error: "Could not update photo. Please try again." });
  }
});

// DELETE /users/me — permanently delete the caller's account and personal data (Play Store
// requirement). A durable account_deletions marker is written first; one transaction then purges
// every user-keyed row and deletes the Clerk user INSIDE it. If the Clerk call fails we re-check:
// if Clerk actually deleted the user (timeout after success) we COMMIT; otherwise roll back. If the
// COMMIT itself fails after Clerk succeeded, the maintenance sweep finishes the purge from the marker.
// Storage cleanup touches ONLY objects recorded as owned by this user (media_objects).
const deleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => getAuth(req).userId || req.ip,
  message: { error: "Too many attempts. Please try again later." },
});
const deleteIpLimiter = rateLimit({ // throwaway accounts are free — also cap per IP
  windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});
router.delete("/me", deleteIpLimiter, deleteLimiter, async (req, res) => {
  const { userId } = getAuth(req);
  if (req.body?.confirm !== "DELETE") return res.status(400).json({ error: "Confirmation required." });
  await pool.query(
    `INSERT INTO account_deletions (clerk_user_id) VALUES ($1)
     ON CONFLICT (clerk_user_id) DO UPDATE SET requested_at = NOW()`, [userId]
  );
  const client = await pool.connect();
  let bases = [];
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    bases = await purgeUserData(client, userId);
    try {
      await deleteClerkUser(userId);
    } catch (clerkErr) {
      const u = await getUser(userId);            // did Clerk delete it anyway (e.g. timed out after)?
      if (!(u.reliable && !u.exists)) throw clerkErr;
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    // Genuine failure (Clerk user still exists) → clear the marker so the sweep doesn't act.
    const u = await getUser(userId).catch(() => ({ reliable: false }));
    if (u.reliable && u.exists) await pool.query("DELETE FROM account_deletions WHERE clerk_user_id = $1", [userId]).catch(() => {});
    console.error("[delete me]", err.message);
    return res.status(502).json({ error: "Could not delete your account. Please try again." });
  } finally {
    client.release();
  }
  await pool.query("DELETE FROM account_deletions WHERE clerk_user_id = $1", [userId]).catch(() => {});
  forgetSenderIdentity(userId);
  deleteOwnedMedia(bases);
  // Drop any live realtime connection for this (now deleted) user.
  try { req.app.get("io")?.in(String(userId)).disconnectSockets(true); } catch { /* best effort */ }
  res.json({ deleted: true });
});

// POST /users/:userId/block — block a user (I no longer exchange messages with them).
router.post("/:userId/block", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const target = req.params.userId;
    if (!target || target === userId) return res.status(400).json({ error: "Invalid user" });
    await pool.query(
      "INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, target]
    );
    res.json({ blocked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /users/:userId/block — unblock.
router.delete("/:userId/block", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    await pool.query("DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2", [userId, req.params.userId]);
    res.json({ blocked: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users/:userId/block — is this relationship blocked, and which way?
router.get("/:userId/block", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const target = req.params.userId;
    const { rows } = await pool.query(
      "SELECT blocker_id FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)",
      [userId, target]
    );
    res.json({
      blockedByMe: rows.some((r) => r.blocker_id === userId),
      blockedMe:   rows.some((r) => r.blocker_id === target),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /users/:userId/report { reason, property_id } — file a report for moderation.
router.post("/:userId/report", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const target = req.params.userId;
    if (!target || target === userId) return res.status(400).json({ error: "Invalid user" });
    const { reason, property_id } = req.body;
    await pool.query(
      "INSERT INTO reports (reporter_id, reported_id, property_id, reason) VALUES ($1, $2, $3, $4)",
      [userId, target, property_id || null, (reason || "unspecified").slice(0, 100)]
    );
    res.json({ reported: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users/:userId/reviews — owner's rating summary + recent reviews + my own review.
router.get("/:userId/reviews", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const owner = req.params.userId;
    const { rows } = await pool.query(
      "SELECT reviewer_id, reviewer_name, reviewer_avatar, rating, text, updated_at FROM reviews WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT 50",
      [owner]
    );
    const count = rows.length;
    const average = count ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : null;
    // Has the caller had a confirmed visit with this owner? (→ eligible to review)
    const { rows: v } = await pool.query(
      "SELECT 1 FROM visits WHERE owner_id = $1 AND requester_id = $2 AND status = 'confirmed' LIMIT 1",
      [owner, userId]
    );
    res.json({
      average, count,
      canReview: owner !== userId && v.length > 0,
      myReview: rows.find((r) => r.reviewer_id === userId) || null,
      reviews: rows.map(({ reviewer_id, ...r }) => r), // don't leak reviewer clerk ids
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /users/:userId/reviews { rating, text, reviewer_name, reviewer_avatar } — rate an
// owner. Gated: can't review yourself, and only after a CONFIRMED visit with them.
router.post("/:userId/reviews", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const owner = req.params.userId;
    if (!owner || owner === userId) return res.status(400).json({ error: "You can't review yourself." });
    const rating = parseInt(req.body?.rating, 10);
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: "rating must be 1–5" });
    const { rows: v } = await pool.query(
      "SELECT 1 FROM visits WHERE owner_id = $1 AND requester_id = $2 AND status = 'confirmed' LIMIT 1",
      [owner, userId]
    );
    if (!v.length) return res.status(403).json({ error: "You can review an owner only after a confirmed visit." });
    const text = (req.body?.text || "").slice(0, 1000) || null;
    const { rows } = await pool.query(
      `INSERT INTO reviews (owner_id, reviewer_id, reviewer_name, reviewer_avatar, rating, text)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (owner_id, reviewer_id)
       DO UPDATE SET rating = $5, text = $6, reviewer_name = $3, reviewer_avatar = $4, updated_at = NOW()
       RETURNING rating, text, updated_at`,
      [owner, userId, (req.body?.reviewer_name || "User").slice(0, 255), (req.body?.reviewer_avatar || "U").slice(0, 10), rating, text]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
