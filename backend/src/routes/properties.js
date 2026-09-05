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
const { computePhotoTrust } = require("../photoTrust");
const { computeInsights, MIN_SAMPLE } = require("../insights");
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

// POST /properties/:id/report { reason } — flag a listing for moderation. Auto-hides the
// listing once REPORTS_TO_HIDE distinct users have reported it (soft-hide; restorable by admin).
const REPORTS_TO_HIDE = 3;
router.post("/:id/report", requireAuth, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid property id" });
    const { userId } = getAuth(req);
    const { rows: pr } = await pool.query("SELECT clerk_user_id FROM properties WHERE id = $1", [req.params.id]);
    if (!pr[0]) return res.status(404).json({ error: "Not found" });
    if (pr[0].clerk_user_id === userId) return res.status(400).json({ error: "You can't report your own listing." });
    // One report per (reporter, property): dedupe so a single user can't force a hide.
    const dup = await pool.query(
      "SELECT 1 FROM reports WHERE reporter_id = $1 AND property_id = $2 LIMIT 1",
      [userId, req.params.id]
    );
    if (!dup.rows.length) {
      await pool.query(
        "INSERT INTO reports (reporter_id, reported_id, property_id, reason) VALUES ($1, $2, $3, $4)",
        [userId, pr[0].clerk_user_id, req.params.id, (req.body?.reason || "unspecified").slice(0, 100)]
      );
    }
    const { rows: cnt } = await pool.query(
      "SELECT COUNT(DISTINCT reporter_id)::int AS n FROM reports WHERE property_id = $1", [req.params.id]
    );
    let hidden = false;
    if (cnt[0].n >= REPORTS_TO_HIDE) {
      await pool.query("UPDATE properties SET flagged = true WHERE id = $1", [req.params.id]);
      hidden = true;
    }
    res.json({ reported: true, reportCount: cnt[0].n, hidden });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /properties/moderation — admin-only queue of reported listings (report counts + reasons).
router.get("/moderation", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!ADMIN_IDS.includes(userId)) return res.status(403).json({ error: "Admins only" });
    const { rows } = await pool.query(
      `SELECT p.id, p.title, p.clerk_user_id AS owner_id, p.owner_name, p.flagged,
              COUNT(DISTINCT r.reporter_id)::int AS reporters,
              ARRAY_AGG(DISTINCT r.reason) AS reasons
         FROM reports r JOIN properties p ON p.id = r.property_id
        GROUP BY p.id
        ORDER BY reporters DESC, p.flagged DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /properties/:id/moderate { action: "hide" | "restore" } — admin flag/unflag a listing.
router.post("/:id/moderate", requireAuth, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid property id" });
    const { userId } = getAuth(req);
    if (!ADMIN_IDS.includes(userId)) return res.status(403).json({ error: "Admins only" });
    const flagged = req.body?.action === "hide";
    const { rowCount } = await pool.query("UPDATE properties SET flagged = $1 WHERE id = $2", [flagged, req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Not found" });
    res.json({ id: req.params.id, flagged });
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

    // Soft-hide: deleted/flagged owners (owner_active) and moderation-flagged listings (flagged).
    let where = "owner_active IS DISTINCT FROM false AND flagged IS DISTINCT FROM true";
    if (hasGeo) where += " AND latitude IS NOT NULL AND longitude IS NOT NULL";
    if (type && type !== "All")   { params.push(type);   where += ` AND type = $${params.length}`; }
    if (status && status !== "All") { params.push(status); where += ` AND status = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (title ILIKE $${params.length} OR location ILIKE $${params.length})`;
    }

    // Build the filtered base query (a plain WHERE, or a geo subquery with distance_km).
    // `base` is wrapped for both COUNT (total) and the paginated page fetch.
    let base, order;
    if (hasGeo) {
      const rad = Math.min(Math.max(parseFloat(radius) || 25, 1), 500);
      params.push(rad);
      // LEAST(1, …) clamps the acos argument so float error can't produce NaN.
      base = `SELECT * FROM (
        SELECT *, (6371 * acos(LEAST(1,
          cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2))
          + sin(radians($1)) * sin(radians(latitude))))) AS distance_km
        FROM properties WHERE ${where}
      ) t WHERE distance_km <= $${params.length}`;
      order = "ORDER BY distance_km ASC";
    } else {
      base = `SELECT * FROM properties WHERE ${where}`;
      order = "ORDER BY created_at DESC";
    }

    // Pagination: limit 1..100 (default 24), offset >= 0.
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const totalRes = await pool.query(`SELECT COUNT(*)::int AS n FROM (${base}) c`, params);
    const total = totalRes.rows[0].n;

    const pageParams = [...params, limit, offset];
    const { rows } = await pool.query(
      `${base} ${order} LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`, pageParams
    );

    // Enforce per-listing location privacy before anything leaves the server. The
    // owner (viewerId) always sees their own exact coords. getAuth is safe on this
    // public route — it returns null userId when unauthenticated.
    const { userId } = getAuth(req);
    res.json({
      items: rows.map((r) => redactLocation(r, userId)),
      total, limit, offset,
      hasMore: offset + rows.length < total,
    });
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
    const { title, description, type, status, price, area, beds, baths, location, tags, img, color, owner_phone, images, thumbnails, location_visibility, photo_geo, latitude, longitude, parcel } = req.body;
    // null → keep the existing visibility (COALESCE); a valid enum → update it.
    const visibility = LOCATION_VISIBILITIES.includes(location_visibility) ? location_visibility : null;
    // Array → set (JSON); undefined → keep existing. Send [] to clear the boundary.
    const parcelJson = Array.isArray(parcel) ? JSON.stringify(parcel) : null;

    // Recompute on-site trust from the existing per-photo geo (for retained photos) merged
    // with any newly-captured geo, scoped to the photos still on the listing. Ownership is
    // enforced by the UPDATE's WHERE, but we must confirm the row exists + read its state first.
    const cur = await pool.query("SELECT photo_geo, latitude, longitude FROM properties WHERE id=$1 AND clerk_user_id=$2", [req.params.id, userId]);
    if (!cur.rows[0]) return res.status(404).json({ error: "Not found or not owner" });
    // Owner can move the pin from the editor (manual pin wins); else keep the stored one.
    const pinLat = Number.isFinite(Number(latitude))  ? Number(latitude)  : cur.rows[0].latitude;
    const pinLng = Number.isFinite(Number(longitude)) ? Number(longitude) : cur.rows[0].longitude;
    const trust = computePhotoTrust({
      existing: Array.isArray(cur.rows[0].photo_geo) ? cur.rows[0].photo_geo : [],
      incoming: Array.isArray(photo_geo) ? photo_geo : [],
      images: images || [],
      lat: pinLat, lng: pinLng,
    });

    const { rows } = await pool.query(
      `UPDATE properties
       SET title=$1, description=$2, type=$3, status=$4, price=$5, area=$6,
           beds=$7, baths=$8, location=$9, tags=$10, img=$11, color=$12,
           owner_phone=$13, images=$14, thumbnails=$15,
           location_visibility=COALESCE($16, location_visibility),
           photo_geo=$17, on_site_verified=$18, latitude=$19, longitude=$20,
           parcel=COALESCE($23::jsonb, parcel), updated_at=NOW()
       WHERE id=$21 AND clerk_user_id=$22
       RETURNING *`,
      [title, description, type, status, price, area,
       beds || null, baths || null, location, tags || null, img || "🏠", color || "#f0a500",
       owner_phone || null, images || [], thumbnails || [], visibility,
       JSON.stringify(trust.photo_geo), trust.on_site_verified, trust.latitude, trust.longitude,
       req.params.id, userId, parcelJson]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found or not owner" });
    res.json(redactLocation(rows[0], userId));
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

// GET /properties/:id/insights — price context for a listing: its ₹/sqft vs the
// median ₹/sqft of comparable listings (same type + status) in its locality (falls
// back to city if the locality sample is too small). Public; no coordinates exposed.
router.get("/:id/insights", async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid property id" });
    const { rows } = await pool.query("SELECT * FROM properties WHERE id = $1", [req.params.id]);
    const listing = rows[0];
    if (!listing) return res.status(404).json({ error: "Not found" });

    // "Bandra West, Mumbai" → locality "Bandra West", city "Mumbai".
    const parts = String(listing.location || "").split(",").map((s) => s.trim()).filter(Boolean);
    const locality = parts[0] || null;
    const city = parts.length > 1 ? parts[parts.length - 1] : null;

    const comparablesFor = async (term) => {
      if (!term) return [];
      const { rows: c } = await pool.query(
        `SELECT price, area FROM properties
         WHERE id <> $1 AND type = $2 AND status = $3
           AND owner_active IS DISTINCT FROM false
           AND location ILIKE $4`,
        [listing.id, listing.type, listing.status, `%${term}%`]
      );
      return c;
    };

    // Prefer locality; broaden to city only if locality is too sparse.
    let areaLabel = locality;
    let comps = await comparablesFor(locality);
    if (comps.length < MIN_SAMPLE && city && city !== locality) {
      const cityComps = await comparablesFor(city);
      if (cityComps.length > comps.length) { comps = cityComps; areaLabel = city; }
    }

    res.json(computeInsights(listing, comps, areaLabel));
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
    const { title, description, type, status, price, area, beds, baths, location, latitude, longitude, tags, img, color, owner_name, owner_phone, owner_avatar, owner_image, images, thumbnails, location_visibility, photo_geo, parcel } = req.body;

    // On-site photo verification (server-authoritative): compute per-photo on_site from the
    // capture GPS, auto-pin the listing from the first on-site capture when no pin was sent,
    // and derive the listing-level badge. Never trust an on_site flag from the client.
    const trust = computePhotoTrust({
      incoming: Array.isArray(photo_geo) ? photo_geo : [],
      images: images || [],
      lat: latitude, lng: longitude,
    });

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
        (clerk_user_id, owner_name, owner_phone, owner_avatar, owner_image, title, description, type, status, price, area, beds, baths, location, latitude, longitude, tags, img, color, images, thumbnails, verified, location_visibility, photo_geo, on_site_verified, parcel)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       RETURNING *`,
      [userId, owner_name, owner_phone, owner_avatar, owner_image || null, title, description, type, status, price, area, beds, baths, location, trust.latitude, trust.longitude, tags, img || "🏠", color || "#f0a500", images || [], thumbnails || [], verified, visibility, JSON.stringify(trust.photo_geo), trust.on_site_verified, Array.isArray(parcel) ? JSON.stringify(parcel) : null]
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
