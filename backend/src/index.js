require("dotenv").config();
const app = require("./app");
const pool = require("./db");
const { ensureBucket } = require("./storage");

const PORT = process.env.PORT || 4000;

// ── One-time idempotent migration (handles existing DBs) ─────
async function migrate() {
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}'`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS thumbnails TEXT[] DEFAULT '{}'`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_active BOOLEAN DEFAULT true`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_image TEXT`);

  // messages: denormalized sender identity so the inbox/chat can show who wrote.
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255)`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_avatar VARCHAR(10)`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_image TEXT`);

  // One-time repair of the old "reply addressed to self" bug: re-address any
  // self-message (sender = receiver) to the other participant on that property,
  // so the history is preserved AND finally delivered. No-ops once clean.
  await pool.query(`
    WITH parties AS (
      SELECT property_id, sender_id AS uid FROM messages
      UNION
      SELECT property_id, receiver_id AS uid FROM messages
    ),
    fix AS (
      SELECT m.id,
             (SELECT pa.uid FROM parties pa
              WHERE pa.property_id = m.property_id AND pa.uid <> m.sender_id
              LIMIT 1) AS peer
      FROM messages m
      WHERE m.sender_id = m.receiver_id
    )
    UPDATE messages m SET receiver_id = fix.peer
    FROM fix WHERE m.id = fix.id AND fix.peer IS NOT NULL
  `);
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

app.listen(PORT, () => {
  console.log(`🚀 Zamin API running on port ${PORT}`);
  migrate().catch(err => console.error("Migration failed:", err.message));
  ensureBucket()
    .then(() => console.log("✅ Object storage bucket ready"))
    .catch(err => console.error("Bucket init failed:", err.message));
});
