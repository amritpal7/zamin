/* Demo seeder: creates loginable owner accounts (Clerk, username-only → no 2FA) and
 * inserts fake properties across India (multiple per city/type so price-insights have
 * comparables, and enough volume to exercise pagination + server-side search).
 *
 * Run:  docker compose exec api node scripts/seed-demo.js
 * Idempotent-ish: owners are reused if the username already exists; properties are
 * tagged 'demo-seed' and cleared + reinserted each run so counts stay predictable.
 *
 * Prints a credentials table at the end (also mirrored into docs/TEST_DATA.md).
 */
const pool = require("../src/db");
const SECRET = process.env.CLERK_SECRET_KEY;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Owners (username + password; no email so login is frictionless, no 2FA) ──
const OWNERS = [
  { username: "demo_aarav",   password: "Mumbai-Harbor-4821-Qz",  name: "Aarav Sharma",   phone: "+91 90000 10001", avatar: "AS" },
  { username: "demo_meera",   password: "Willow-Canyon-4417-Rk",  name: "Meera Patil",    phone: "+91 90000 10002", avatar: "MP" },
  { username: "demo_rohan",   password: "Amber-Meadow-7723-Tp",   name: "Rohan Kulkarni", phone: "+91 90000 10003", avatar: "RK" },
  { username: "demo_priya",   password: "Silver-Falls-3390-Vn",   name: "Priya Nair",     phone: "+91 90000 10004", avatar: "PN" },
  { username: "demo_imran",   password: "Cobalt-Ridge-9052-Wm",   name: "Imran Hussain",  phone: "+91 90000 10005", avatar: "IH" },
  { username: "demo_sanjana", password: "Maple-Grove-6614-Xd",    name: "Sanjana Reddy",  phone: "+91 90000 10006", avatar: "SR" },
  { username: "demo_vikram",  password: "Basalt-Cove-2288-Yh",    name: "Vikram Singh",   phone: "+91 90000 10007", avatar: "VS" },
  { username: "demo_deepa",   password: "Cedar-Bluff-5147-Zc",    name: "Deepa Menon",    phone: "+91 90000 10008", avatar: "DM" },
  { username: "demo_arjun",   password: "Coral-Summit-8039-Bf",   name: "Arjun Verma",    phone: "+91 90000 10009", avatar: "AV" },
  { username: "demo_neha",    password: "Slate-Harbor-4471-Cg",   name: "Neha Gupta",     phone: "+91 90000 10010", avatar: "NG" },
  { username: "demo_farhan",  password: "Birch-Meadow-6620-Dh",   name: "Farhan Shaikh",  phone: "+91 90000 10011", avatar: "FS" },
  { username: "demo_kavya",   password: "Onyx-Valley-3315-Ej",    name: "Kavya Iyer",     phone: "+91 90000 10012", avatar: "KI" },
];

// ── Cities with approximate centre coords (properties jitter around these) ──
const CITIES = [
  { city: "Mumbai",     areas: ["Bandra West", "Andheri East", "Powai", "Worli"],           lat: 19.076, lng: 72.877 },
  { city: "Delhi",      areas: ["Dwarka", "Saket", "Rohini", "Vasant Kunj"],                lat: 28.644, lng: 77.216 },
  { city: "Bengaluru",  areas: ["Koramangala", "Whitefield", "Indiranagar", "HSR Layout"],  lat: 12.971, lng: 77.594 },
  { city: "Hyderabad",  areas: ["Gachibowli", "Jubilee Hills", "Kondapur", "Madhapur"],     lat: 17.385, lng: 78.486 },
  { city: "Chennai",    areas: ["Adyar", "Velachery", "OMR", "Anna Nagar"],                 lat: 13.083, lng: 80.270 },
  { city: "Pune",       areas: ["Kothrud", "Hinjewadi", "Baner", "Viman Nagar"],            lat: 18.520, lng: 73.857 },
  { city: "Kolkata",    areas: ["Salt Lake", "Rajarhat", "Ballygunge", "New Town"],         lat: 22.573, lng: 88.364 },
  { city: "Ahmedabad",  areas: ["Satellite", "Bopal", "Vastrapur", "SG Highway"],           lat: 23.023, lng: 72.572 },
  { city: "Jaipur",     areas: ["Malviya Nagar", "Vaishali Nagar", "Mansarovar", "C-Scheme"], lat: 26.912, lng: 75.787 },
  { city: "Goa",        areas: ["Candolim", "Assagao", "Panaji", "Dona Paula"],             lat: 15.499, lng: 73.828 },
  { city: "Lucknow",    areas: ["Gomti Nagar", "Hazratganj", "Aliganj", "Indira Nagar"],    lat: 26.847, lng: 80.946 },
  { city: "Chandigarh", areas: ["Sector 17", "Sector 35", "Mohali", "Panchkula"],           lat: 30.734, lng: 76.779 },
  { city: "Kochi",      areas: ["Kakkanad", "Marine Drive", "Edappally", "Fort Kochi"],     lat: 9.931,  lng: 76.267 },
  { city: "Indore",     areas: ["Vijay Nagar", "Palasia", "Rau", "Bhawarkuan"],             lat: 22.719, lng: 75.857 },
];

const IMAGES = {
  House:      ["https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80", "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80"],
  Apartment:  ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80", "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80"],
  Land:       ["https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80"],
  Commercial: ["https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80"],
};
const EMOJI = { House: "🏡", Apartment: "🏢", Land: "🌾", Commercial: "🏬" };
const COLORS = ["#E09A33", "#129E6B", "#2D74CB", "#6A45C0", "#DB8C2E"];
const VIS = ["exact", "exact", "exact", "approximate", "hidden"]; // mostly exact

// Create (or reuse) a Clerk user; returns its id.
async function ensureOwner(o) {
  const create = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({ username: o.username, password: o.password, first_name: o.name.split(" ")[0], last_name: o.name.split(" ").slice(1).join(" ") }),
  });
  if (create.ok) return (await create.json()).id;
  // already exists → look it up
  const find = await fetch(`https://api.clerk.com/v1/users?username=${o.username}`, { headers: { Authorization: `Bearer ${SECRET}` } });
  const arr = await find.json();
  if (Array.isArray(arr) && arr[0]) return arr[0].id;
  const err = await create.text();
  throw new Error(`owner ${o.username}: ${err.slice(0, 160)}`);
}

const jitter = () => (Math.random() - 0.5) * 0.06; // ~±3km
const pick = (a, i) => a[i % a.length];
const rint = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function makeProperty(city, area, owner, i, force) {
  const types = ["Apartment", "Apartment", "House", "Land", "Commercial"];
  const type = force?.type || pick(types, i + area.length);
  const forRent = force?.status ? force.status === "For Rent" : (type !== "Land" && i % 3 === 0);
  const status = forRent ? "For Rent" : "For Sale";
  let price, areaStr, beds = null, baths = null;
  if (type === "Land") { price = `₹${rint(40, 300)} L`; areaStr = `${rint(1, 6)} Acres`; }
  else if (type === "Commercial") { price = forRent ? `₹${rint(1, 6)} L/mo` : `₹${rint(2, 12)} Cr`; areaStr = `${rint(1500, 8000).toLocaleString()} sq ft`; baths = rint(2, 4); }
  else if (type === "House") { price = forRent ? `₹${rint(30, 120)}K/mo` : `₹${(rint(15, 80) / 10).toFixed(1)} Cr`; areaStr = `${rint(1800, 4500).toLocaleString()} sq ft`; beds = rint(3, 5); baths = rint(2, 5); }
  else { price = forRent ? `₹${rint(15, 70)}K/mo` : `₹${rint(45, 350)} L`; areaStr = `${rint(600, 2200).toLocaleString()} sq ft`; beds = rint(1, 4); baths = rint(1, 3); }
  return {
    title: `${["Modern", "Spacious", "Premium", "Cozy", "Sunlit", "Elegant"][i % 6]} ${type} in ${area}`,
    description: `A ${type.toLowerCase()} in ${area}, ${city.city}. Direct from owner — zero brokerage. Well-connected, ready to move.`,
    type, status, price, area: areaStr, beds, baths,
    location: `${area}, ${city.city}`,
    latitude: city.lat + jitter(), longitude: city.lng + jitter(),
    tags: ["No Brokerage", type === "Land" ? "Clear Title" : "Parking", "Prime Location"],
    img: EMOJI[type], color: pick(COLORS, i),
    images: IMAGES[type], visibility: pick(VIS, i),
    verified: i % 2 === 0,
    owner,
  };
}

(async () => {
  if (!SECRET) throw new Error("CLERK_SECRET_KEY missing");
  console.log("Creating owners…");
  const owners = [];
  for (const o of OWNERS) {
    const id = await ensureOwner(o);
    owners.push({ ...o, id });
    console.log(`  ✓ ${o.username} → ${id}`);
    await sleep(400); // gentle on Clerk rate limits
  }

  console.log("Clearing previous demo-seed properties…");
  await pool.query("DELETE FROM properties WHERE 'demo-seed' = ANY(tags)");

  console.log("Inserting properties…");
  let n = 0;
  const insert = async (p) => {
    const tags = [...p.tags, "demo-seed"];
    await pool.query(
      `INSERT INTO properties
        (clerk_user_id, owner_name, owner_phone, owner_avatar, owner_username, title, description, type, status, price, area, beds, baths, location, latitude, longitude, tags, img, color, images, thumbnails, verified, location_visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [p.owner.id, p.owner.name, p.owner.phone, p.owner.avatar, p.owner.username, p.title, p.description, p.type, p.status, p.price, p.area, p.beds, p.baths, p.location, p.latitude, p.longitude, tags, p.img, p.color, p.images, p.images, p.verified, p.visibility]
    );
    n++;
  };

  for (let ci = 0; ci < CITIES.length; ci++) {
    const c = CITIES[ci];
    for (let a = 0; a < c.areas.length; a++) {
      const o1 = owners[(ci + a) % owners.length];
      const o2 = owners[(ci + a + 3) % owners.length];
      // 1 guaranteed comparable (Apartment · For Sale) → price-insights have ≥4/city.
      await insert(makeProperty(c, c.areas[a], o1, ci + a, { type: "Apartment", status: "For Sale" }));
      // 1 varied listing → type/status/visibility spread.
      await insert(makeProperty(c, c.areas[a], o2, ci + a + 7));
    }
  }
  console.log(`\n✅ Seeded ${n} properties across ${CITIES.length} cities, ${owners.length} owners.\n`);
  console.log("=== OWNER LOGIN CREDENTIALS (username · password) ===");
  for (const o of owners) console.log(`  ${o.username}\t${o.password}\t(${o.name})`);
  await pool.end();
  process.exit(0);
})().catch((e) => { console.error("SEED FAILED:", e.message); process.exit(1); });
