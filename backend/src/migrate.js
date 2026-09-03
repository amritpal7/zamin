// Idempotent schema migration + one-time data repairs. Safe to run on every boot
// and from tests/CI (all statements are IF NOT EXISTS / ON CONFLICT / no-op-when-clean).
// Assumes the base tables from db/init.sql exist.
async function migrate(pool) {
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}'`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS thumbnails TEXT[] DEFAULT '{}'`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_active BOOLEAN DEFAULT true`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_image TEXT`);
  // Trust badge: owner-level, server-authoritative (synced from Clerk verification).
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false`);

  // messages: denormalized sender identity so the inbox/chat can show who wrote.
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255)`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_avatar VARCHAR(10)`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_image TEXT`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ`);
  // Structured messages (visit / offer / image): type + JSON meta.
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'text'`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS meta JSONB`);

  // Expo push tokens (one user can have several devices).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      token         VARCHAR(255) PRIMARY KEY,
      clerk_user_id VARCHAR(255) NOT NULL,
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(clerk_user_id)`);

  // Saved searches + a notifications store (new-message + saved-search matches).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS saved_searches (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      clerk_user_id VARCHAR(255) NOT NULL,
      name          VARCHAR(120),
      type          VARCHAR(50) DEFAULT 'All',
      status        VARCHAR(50) DEFAULT 'All',
      search        VARCHAR(255) DEFAULT '',
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(clerk_user_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      clerk_user_id VARCHAR(255) NOT NULL,
      type          VARCHAR(30) NOT NULL,
      title         VARCHAR(255),
      body          TEXT,
      data          JSONB,
      read_at       TIMESTAMPTZ,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(clerk_user_id, created_at DESC)`);

  // Binds a presigned upload `base` to the user who requested it, so /process
  // can only be triggered for keys that caller actually presigned (prevents
  // overwriting another user's listing images).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pending_uploads (
      base          VARCHAR(255) PRIMARY KEY,
      clerk_user_id VARCHAR(255) NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )`);

  // Trust & safety: blocks + reports.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blocks (
      blocker_id VARCHAR(255) NOT NULL,
      blocked_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (blocker_id, blocked_id)
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      reporter_id VARCHAR(255) NOT NULL,
      reported_id VARCHAR(255) NOT NULL,
      property_id UUID,
      reason      VARCHAR(100),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`);

  // One-time repair of the old "reply addressed to self" bug: re-address any
  // self-message (sender = receiver) to the other participant on that property.
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

  // Backfill stock photos on the seed rows so the home screen has imagery.
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
}

module.exports = { migrate };
