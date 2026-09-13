/* Publishes a few demo properties under TWO REAL accounts (@amrit5377, @meera_estates) so
 * their "My Listings" isn't empty and the @username disambiguation is visible in the app.
 * Direct INSERT (bypasses auth) — run in-network:  node scripts/seed-owner-demo.js
 * Idempotent: rows are tagged 'owner-demo-seed' and cleared + reinserted each run.
 */
const pool = require("../src/db");

const OWNERS = [
  { id: "user_3HSX1ONzbwIfRpJzaUGqQBtyoZK", name: "Amrit Singh",  username: "amrit5377",     avatar: "AS", phone: "+91 90000 53377" },
  { id: "user_3Is5MRGfP5kY68PbcR4nNjY57TW", name: "Meera Patil",  username: "meera_estates", avatar: "MP", phone: "+91 90000 60011" },
];

const IMG = {
  Apartment: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80"],
  House:     ["https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80"],
  Land:      ["https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80"],
};
const EMOJI = { Apartment: "🏢", House: "🏡", Land: "🌾" };

// 3 listings per owner (varied types + cities).
const LISTINGS = [
  { type: "Apartment", status: "For Sale", price: "₹1.2 Cr", area: "1,250 sq ft", beds: 3, baths: 2, location: "Baner, Pune",       lat: 18.559, lng: 73.776 },
  { type: "House",     status: "For Sale", price: "₹2.8 Cr", area: "2,400 sq ft", beds: 4, baths: 3, location: "Whitefield, Bengaluru", lat: 12.969, lng: 77.749 },
  { type: "Land",      status: "For Sale", price: "₹95 L",   area: "3 Acres",     beds: null, baths: null, location: "Mulshi, Pune",  lat: 18.53,  lng: 73.49 },
];

const jitter = () => (Math.random() - 0.5) * 0.02;

(async () => {
  console.log("Clearing previous owner-demo-seed rows…");
  await pool.query("DELETE FROM properties WHERE 'owner-demo-seed' = ANY(tags)");

  let n = 0;
  for (const o of OWNERS) {
    for (let i = 0; i < LISTINGS.length; i++) {
      const L = LISTINGS[i];
      const title = `${["Modern", "Spacious", "Premium"][i % 3]} ${L.type} in ${L.location.split(",")[0]}`;
      await pool.query(
        `INSERT INTO properties
          (clerk_user_id, owner_name, owner_phone, owner_avatar, owner_username, title, description, type, status, price, area, beds, baths, location, latitude, longitude, tags, img, color, images, thumbnails, verified, location_visibility)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [o.id, o.name, o.phone, o.avatar, o.username, title,
         `Direct from owner (@${o.username}) — zero brokerage. ${L.location}. Ready to move.`,
         L.type, L.status, L.price, L.area, L.beds, L.baths, L.location,
         L.lat + jitter(), L.lng + jitter(),
         ["No Brokerage", "Prime Location", "owner-demo-seed"], EMOJI[L.type], "#2D74CB",
         IMG[L.type], IMG[L.type], false, "exact"]
      );
      n++;
    }
    console.log(`  ✓ ${LISTINGS.length} listings for @${o.username} (${o.name})`);
  }
  console.log(`\n✅ Seeded ${n} properties across ${OWNERS.length} real owners.`);
  await pool.end();
  process.exit(0);
})().catch((e) => { console.error("SEED FAILED:", e.message); process.exit(1); });
