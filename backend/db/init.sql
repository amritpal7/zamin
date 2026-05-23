-- ─── Zamin DB Schema ────────────────────────────────────────
-- Auto-runs on first postgres container start.
-- Clerk handles users — we just store their clerk_id as FK.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id VARCHAR(255) NOT NULL,       -- Clerk user ID of owner
  owner_name   VARCHAR(255) NOT NULL,
  owner_phone  VARCHAR(50),
  owner_avatar VARCHAR(10),
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  type         VARCHAR(50) NOT NULL,          -- House | Apartment | Land | Commercial
  status       VARCHAR(50) NOT NULL,          -- For Sale | For Rent
  price        VARCHAR(100) NOT NULL,
  area         VARCHAR(100),
  beds         INTEGER,
  baths        INTEGER,
  location     VARCHAR(255) NOT NULL,
  latitude     DECIMAL(10, 7),
  longitude    DECIMAL(10, 7),
  tags         TEXT[],
  img          VARCHAR(10) DEFAULT '🏠',
  color        VARCHAR(20) DEFAULT '#f0a500',
  verified     BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Saved properties (user bookmarks)
CREATE TABLE IF NOT EXISTS saved_properties (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id VARCHAR(255) NOT NULL,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clerk_user_id, property_id)
);

-- Chat messages
CREATE TABLE IF NOT EXISTS messages (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id  UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  sender_id    VARCHAR(255) NOT NULL,  -- Clerk user ID
  receiver_id  VARCHAR(255) NOT NULL,  -- Clerk user ID of property owner
  text         TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_properties_type   ON properties(type);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_owner  ON properties(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_property ON messages(property_id);
CREATE INDEX IF NOT EXISTS idx_saved_user        ON saved_properties(clerk_user_id);

-- ─── Seed data ───────────────────────────────────────────────
INSERT INTO properties (clerk_user_id, owner_name, owner_phone, owner_avatar, title, description, type, status, price, area, beds, baths, location, latitude, longitude, tags, img, color, verified)
VALUES
  ('seed_user_1', 'Rahul Sharma', '+91 98765 43210', 'RS', 'Modern Villa with Pool', 'Stunning contemporary villa in the heart of Bandra West. Infinity pool, landscaped garden, modular kitchen, and smart home automation.', 'House', 'For Sale', '₹2.4 Cr', '3,200 sq ft', 4, 3, 'Bandra West, Mumbai', 19.0596, 72.8295, ARRAY['Pool','Garden','Parking'], '🏡', '#f0a500', true),
  ('seed_user_2', 'Meera Patil', '+91 87654 32109', 'MP', 'Agricultural Land — 5 Acres', 'Prime agricultural land with year-round water source, black cotton soil, direct highway access. Ideal for farming or investment.', 'Land', 'For Sale', '₹85 L', '5 Acres', NULL, NULL, 'Pune-Nashik Hwy, Pune', 18.5204, 73.8567, ARRAY['Fertile Soil','Water Source','Road Access'], '🌾', '#00d084', true),
  ('seed_user_3', 'Aditya Mehta', '+91 76543 21098', 'AM', 'Luxury Apartment — Sea View', 'Premium sea-facing apartment on the 22nd floor. Breathtaking views of Marine Drive, world-class amenities.', 'Apartment', 'For Rent', '₹1.8 Cr', '1,450 sq ft', 3, 2, 'Marine Lines, Mumbai', 18.9438, 72.8231, ARRAY['Sea View','Gym','Security'], '🏢', '#4da6ff', false),
  ('seed_user_4', 'Priya Nair', '+91 65432 10987', 'PN', 'Commercial Plot — Prime Location', 'Prime corner plot in Koramangala commercial hub. Approved for G+4 floors. Excellent ROI potential.', 'Land', 'For Sale', '₹3.2 Cr', '2,800 sq ft', NULL, NULL, 'Koramangala, Bengaluru', 12.9352, 77.6245, ARRAY['Corner Plot','Commercial','Metro Near'], '📍', '#ff6b35', true),
  ('seed_user_5', 'Suresh Kulkarni', '+91 54321 09876', 'SK', 'Heritage Farmhouse', 'Charming heritage farmhouse surrounded by mango orchards. Perfect weekend getaway. Includes barn, well, and 1-acre land.', 'House', 'For Sale', '₹95 L', '4,500 sq ft', 5, 4, 'Alibaug, Maharashtra', 18.6414, 72.8722, ARRAY['Mango Orchard','Well','Barn'], '🏚️', '#9b59b6', true),
  ('seed_user_6', 'Kavya Reddy', '+91 43210 98765', 'KR', 'Studio — Tech Park Zone', 'Fully furnished studio minutes from ITPL. Ideal for IT professionals. All utilities and high-speed internet included.', 'Apartment', 'For Rent', '₹22K/mo', '520 sq ft', 1, 1, 'Whitefield, Bengaluru', 12.9698, 77.7500, ARRAY['Furnished','Wi-Fi','Laundry'], '🛋️', '#f0a500', false)
ON CONFLICT DO NOTHING;
