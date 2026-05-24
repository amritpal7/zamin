require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { clerkMiddleware } = require("@clerk/express");

const pool = require("./db");
const { UPLOAD_DIR } = require("./upload");
const { ensureBucket } = require("./storage");
const propertiesRouter = require("./routes/properties");
const savedRouter = require("./routes/saved");
const messagesRouter = require("./routes/messages");
const authRouter = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json());

// Clerk attaches auth state to every request.
// Routes can then call requireAuth() to enforce login.
app.use(clerkMiddleware());

// ── Routes ──────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok", service: "zamin-api" }));

// Uploaded property images (reached via nginx at /api/uploads/...)
app.use("/uploads", express.static(UPLOAD_DIR));

app.use("/properties", propertiesRouter);
app.use("/saved", savedRouter);
app.use("/messages", messagesRouter);
app.use("/auth", authRouter);

// ── One-time idempotent migration (handles existing DBs) ─────
async function migrate() {
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}'`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS thumbnails TEXT[] DEFAULT '{}'`);
  // Backfill stock photos on the seed rows so the home screen has imagery
  const stock = {
    "Modern Villa with Pool": [
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
    ],
    "Luxury Apartment — Sea View": [
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80",
    ],
    "Heritage Farmhouse": [
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80",
      "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=800&q=80",
    ],
    "Studio — Tech Park Zone": [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",
    ],
    "Agricultural Land — 5 Acres": [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80",
    ],
    "Commercial Plot — Prime Location": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80",
    ],
  };
  for (const [title, urls] of Object.entries(stock)) {
    await pool.query(
      `UPDATE properties SET images = $1 WHERE title = $2 AND (images IS NULL OR images = '{}')`,
      [urls, title]
    );
  }
  console.log("✅ DB migration complete (images column ready)");
}

// ── 404 / error handlers ────────────────────────────────────
app.use((_, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`🚀 Zamin API running on port ${PORT}`);
  migrate().catch(err => console.error("Migration failed:", err.message));
  ensureBucket()
    .then(() => console.log("✅ Object storage bucket ready"))
    .catch(err => console.error("Bucket init failed:", err.message));
});
