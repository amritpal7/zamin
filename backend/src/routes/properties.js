const router = require("express").Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getAuth } = require("@clerk/express");
const crypto = require("crypto");
const { upload } = require("../upload");
const { putObject, presignPut } = require("../storage");
const { thumbnailQueue } = require("../queue");
const { validateProperty, isUuid, LOCATION_VISIBILITIES } = require("../validation");
const { reconcileOwner, reconcileOwners, getUser, setLocationDefault } = require("../clerkUsers");
const { redactLocation } = require("../locationPrivacy");
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

// POST /properties/reconcile-me — reconcile ONLY the authenticated user's own
// listings from Clerk (one API call). Lets a user propagate a just-changed account
// state (e.g. email verified → trust badge) to their listings immediately, instead
// of waiting for the scheduled sweep. Safe self-serve: only touches the caller's rows.
router.post("/reconcile-me", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const result = await reconcileOwner(pool, userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /properties — list all (public). Optional geo: ?lat&lng[&radius=km] returns
// listings within radius (Haversine, no PostGIS) sorted by distance, with distance_km.
router.get("/", async (req, res) => {
  try {
    const { type, status, search, lat, lng, radius } = req.query;
    const glat = parseFloat(lat), glng = parseFloat(lng);
    const hasGeo = Number.isFinite(glat) && Number.isFinite(glng);

    const params = [];
    if (hasGeo) params.push(glat, glng); // $1, $2

    // Hide listings from flagged/deleted owners (soft-hide; data retained).
    let where = "owner_active IS DISTINCT FROM false";
    if (hasGeo) where += " AND latitude IS NOT NULL AND longitude IS NOT NULL";
    if (type && type !== "All")   { params.push(type);   where += ` AND type = $${params.length}`; }
    if (status && status !== "All") { params.push(status); where += ` AND status = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (title ILIKE $${params.length} OR location ILIKE $${params.length})`;
    }

    let query;
    if (hasGeo) {
      const rad = Math.min(Math.max(parseFloat(radius) || 25, 1), 500);
      params.push(rad);
      // LEAST(1, …) clamps the acos argument so float error can't produce NaN.
      query = `SELECT * FROM (
        SELECT *, (6371 * acos(LEAST(1,
          cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2))
          + sin(radians($1)) * sin(radians(latitude))))) AS distance_km
        FROM properties WHERE ${where}
      ) t WHERE distance_km <= $${params.length} ORDER BY distance_km ASC`;
    } else {
      query = `SELECT * FROM properties WHERE ${where} ORDER BY created_at DESC`;
    }

    const { rows } = await pool.query(query, params);
    // Enforce per-listing location privacy before anything leaves the server. The
    // owner (viewerId) always sees their own exact coords. getAuth is safe on this
    // public route — it returns null userId when unauthenticated.
    const { userId } = getAuth(req);
    res.json(rows.map((r) => redactLocation(r, userId)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /properties/location-visibility — set the owner's location privacy in bulk:
// updates ALL their listings and stores the default in Clerk for future listings.
router.put("/location-visibility", requireAuth, async (req, res) => {
  try {
    const { visibility } = req.body || {};
    if (!LOCATION_VISIBILITIES.includes(visibility))
      return res.status(400).json({ error: `visibility must be one of: ${LOCATION_VISIBILITIES.join(", ")}` });
    const { userId } = getAuth(req);
    const { rowCount } = await pool.query(
      "UPDATE properties SET location_visibility = $1, updated_at = NOW() WHERE clerk_user_id = $2",
      [visibility, userId]
    );
    // Best-effort: persist the default for new listings (never fails the bulk update).
    let defaultSaved = false;
    try { defaultSaved = await setLocationDefault(userId, visibility); } catch { /* keep false */ }
    res.json({ updated: rowCount, default: visibility, defaultSaved });
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
    const { title, description, type, status, price, area, beds, baths, location, tags, img, color, owner_phone, images, thumbnails, location_visibility } = req.body;
    // null → keep the existing visibility (COALESCE); a valid enum → update it.
    const visibility = LOCATION_VISIBILITIES.includes(location_visibility) ? location_visibility : null;
    const { rows } = await pool.query(
      `UPDATE properties
       SET title=$1, description=$2, type=$3, status=$4, price=$5, area=$6,
           beds=$7, baths=$8, location=$9, tags=$10, img=$11, color=$12,
           owner_phone=$13, images=$14, thumbnails=$15,
           location_visibility=COALESCE($16, location_visibility), updated_at=NOW()
       WHERE id=$17 AND clerk_user_id=$18
       RETURNING *`,
      [title, description, type, status, price, area,
       beds || null, baths || null, location, tags || null, img || "🏠", color || "#f0a500",
       owner_phone || null, images || [], thumbnails || [], visibility,
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
    const { userId } = getAuth(req);
    res.json(redactLocation(rows[0], userId));
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
    const { title, description, type, status, price, area, beds, baths, location, latitude, longitude, tags, img, color, owner_name, owner_phone, owner_avatar, owner_image, images, thumbnails, location_visibility } = req.body;

    // The trust badge is server-authoritative: derive it from the owner's Clerk
    // account (verified email/phone), never from the client — a client must not be
    // able to self-assign a "verified" badge. Falls back to false if Clerk is
    // unreachable; the scheduled reconcile heals it. Same call also yields the owner's
    // default location visibility (used when the listing doesn't specify one).
    let verified = false, ownerDefault = null;
    try { const u = await getUser(userId); verified = u.verified === true; ownerDefault = u.locationDefault; } catch { /* keep defaults */ }
    const visibility = LOCATION_VISIBILITIES.includes(location_visibility)
      ? location_visibility
      : (LOCATION_VISIBILITIES.includes(ownerDefault) ? ownerDefault : "exact");

    const { rows } = await pool.query(
      `INSERT INTO properties
        (clerk_user_id, owner_name, owner_phone, owner_avatar, owner_image, title, description, type, status, price, area, beds, baths, location, latitude, longitude, tags, img, color, images, thumbnails, verified, location_visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       RETURNING *`,
      [userId, owner_name, owner_phone, owner_avatar, owner_image || null, title, description, type, status, price, area, beds, baths, location, latitude, longitude, tags, img || "🏠", color || "#f0a500", images || [], thumbnails || [], verified, visibility]
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
