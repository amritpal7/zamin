const router = require("express").Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getAuth } = require("@clerk/express");
const crypto = require("crypto");
const { upload } = require("../upload");
const { putObject, presignPut } = require("../storage");
const { thumbnailQueue } = require("../queue");
const { validateProperty, isUuid } = require("../validation");
const { reconcileOwners } = require("../clerkUsers");
const { notifyListingMatch } = require("../notify");

const MAX_IMAGES = 8;
const MAX_IMAGE_MB = 8;
const PUBLIC_BASE = process.env.S3_PUBLIC_BASE || "/media";

function enqueueThumb(id, base, origKey) {
  return thumbnailQueue.add(
    "process",
    { id, origKey, base },
    { attempts: 3, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: true, removeOnFail: 50 }
  );
}

// POST /properties/presign — hand the client short-lived signed URLs so it can
// upload images STRAIGHT to object storage (bytes never touch the API).
// Body: { count } (1..MAX_IMAGES). Returns { files: [{ uploadUrl, base, origKey, url, thumb }] }.
router.post("/presign", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const count = Math.min(Math.max(parseInt(req.body?.count, 10) || 0, 1), MAX_IMAGES);
    const files = [];
    for (let i = 0; i < count; i++) {
      const id = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}-${i}`;
      const base = `properties/${id}`;
      const origKey = `${base}_orig`;
      const uploadUrl = await presignPut(origKey);
      // Bind this base to the requesting user so only they can /process it.
      await pool.query(
        "INSERT INTO pending_uploads (base, clerk_user_id) VALUES ($1, $2) ON CONFLICT (base) DO NOTHING",
        [base, userId]
      );
      files.push({
        uploadUrl, base, origKey,
        url: `${PUBLIC_BASE}/${base}.jpg`,
        thumb: `${PUBLIC_BASE}/${base}_thumb.jpg`,
      });
    }
    res.json({ files });
  } catch (e) {
    res.status(500).json({ error: "Could not start upload. Please try again." });
  }
});

// POST /properties/process — client calls this after it has PUT the originals.
// Enqueues background resize+thumbnail jobs. Body: { items: [{ base, origKey }] }.
router.post("/process", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, MAX_IMAGES) : [];
    let processed = 0;
    for (const it of items) {
      if (!it?.base || !it?.origKey) continue;
      // Only process a base this user actually presigned (prevents overwriting
      // someone else's listing images). Consume the binding.
      const { rowCount } = await pool.query(
        "DELETE FROM pending_uploads WHERE base = $1 AND clerk_user_id = $2",
        [it.base, userId]
      );
      if (!rowCount) continue;
      const id = it.base.split("/").pop();
      await enqueueThumb(id, it.base, it.origKey);
      processed++;
    }
    res.json({ ok: true, processed });
  } catch (e) {
    res.status(500).json({ error: "Could not process images. Please try again." });
  }
});

// POST /properties/upload — legacy multipart path (bytes through API). Kept as a
// fallback; the app now uses presign + direct upload above.
router.post("/upload", requireAuth, (req, res) => {
  upload.array("images", MAX_IMAGES)(req, res, async (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE")
        return res.status(413).json({ error: `Each photo must be under ${MAX_IMAGE_MB} MB.` });
      if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE")
        return res.status(400).json({ error: `You can upload up to ${MAX_IMAGES} photos at a time.` });
      return res.status(400).json({ error: err.message || "Upload failed. Please try again." });
    }
    try {
      const files = [];
      for (const f of (req.files || [])) {
        const id = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;
        const base = `properties/${id}`;
        const origKey = `${base}_orig`;
        await putObject(origKey, f.buffer, f.mimetype || "image/jpeg");
        await enqueueThumb(id, base, origKey);
        files.push({ url: `${PUBLIC_BASE}/${base}.jpg`, thumb: `${PUBLIC_BASE}/${base}_thumb.jpg` });
      }
      res.json({ files });
    } catch (e) {
      res.status(500).json({ error: "Upload failed. Please try again." });
    }
  });
});

// POST /properties/reconcile-owners — check each owner against Clerk and update
// owner_active. Admin-only: it fans out a Clerk request per owner, so it must not
// be triggerable by any user. The worker also runs this on a schedule.
const ADMIN_IDS = (process.env.ADMIN_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
router.post("/reconcile-owners", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!ADMIN_IDS.includes(userId)) return res.status(403).json({ error: "Admins only" });
    const result = await reconcileOwners(pool);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /properties — list all (public)
router.get("/", async (req, res) => {
  try {
    const { type, status, search } = req.query;
    // Hide listings from flagged/deleted owners (owner_active = false). Data is
    // retained in the DB — this is a soft-hide, not a delete. NULL/true stay visible.
    let query = "SELECT * FROM properties WHERE owner_active IS DISTINCT FROM false";
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

// GET /properties/mine — current user's listings (auth required)
// Must be registered before /:id to avoid route shadowing
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { rows } = await pool.query(
      "SELECT * FROM properties WHERE clerk_user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /properties/:id — update listing (owner only)
router.put("/:id", requireAuth, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid property id" });
    const errors = validateProperty(req.body, { forUpdate: true });
    if (errors.length) return res.status(400).json({ error: errors.join("; "), errors });
    const { userId } = getAuth(req);
    const { title, description, type, status, price, area, beds, baths, location, tags, img, color, owner_phone, images, thumbnails } = req.body;
    const { rows } = await pool.query(
      `UPDATE properties
       SET title=$1, description=$2, type=$3, status=$4, price=$5, area=$6,
           beds=$7, baths=$8, location=$9, tags=$10, img=$11, color=$12,
           owner_phone=$13, images=$14, thumbnails=$15, updated_at=NOW()
       WHERE id=$16 AND clerk_user_id=$17
       RETURNING *`,
      [title, description, type, status, price, area,
       beds || null, baths || null, location, tags || null, img || "🏠", color || "#f0a500",
       owner_phone || null, images || [], thumbnails || [],
       req.params.id, userId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found or not owner" });
    res.json(rows[0]);
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
    const errors = validateProperty(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join("; "), errors });
    const { userId } = getAuth(req);
    const { title, description, type, status, price, area, beds, baths, location, latitude, longitude, tags, img, color, owner_name, owner_phone, owner_avatar, owner_image, images, thumbnails } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO properties
        (clerk_user_id, owner_name, owner_phone, owner_avatar, owner_image, title, description, type, status, price, area, beds, baths, location, latitude, longitude, tags, img, color, images, thumbnails)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *`,
      [userId, owner_name, owner_phone, owner_avatar, owner_image || null, title, description, type, status, price, area, beds, baths, location, latitude, longitude, tags, img || "🏠", color || "#f0a500", images || [], thumbnails || []]
    );
    // Notify users whose saved search matches this new listing (best-effort; never fails create).
    try { await notifyListingMatch(pool, rows[0]); } catch (e) { console.error("saved-search notify failed:", e.message); }
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /properties/:id — only owner can delete
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid property id" });
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
