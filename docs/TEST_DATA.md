# Zamin — Test Data (ideas for manual testing)

Reference/fixture data for exercising the app by hand: **20 users** + **20 properties** covering
every property `type`, both `status` values, all three `location_visibility` modes, verified and
unverified owners, and listings with/without beds/baths (e.g. Land).

> This is a **copy-paste idea sheet**, not a seeder. Create users via the Clerk Backend API
> (see `CLAUDE.md` runbook), then post listings through the app (or the API) as each user.

## How to use it

**Signup is username-first.** Username + password only; email is optional and added later in
Settings → (Add & verify email).

**Test emails & codes (Clerk dev):** any address containing `+clerk_test` (e.g.
`aarav+clerk_test@example.com`) verifies with the fixed code **`424242`** — no real inbox needed.
Same code works for password-reset via email.

**⚠️ Verified email ⇒ email-code 2FA at login** (this Clerk plan enforces it; see
`docs/BUGLOG.md`). Users below marked **Verified = yes** will need the email code (`424242`) at
sign-in. Keep some users email-free to test the frictionless username-only path.

**Create a user (Clerk Backend API):**
```bash
sk=$(grep CLERK_SECRET_KEY .env | cut -d= -f2)
curl -s -X POST https://api.clerk.com/v1/users -H "Authorization: Bearer $sk" \
  -H "Content-Type: application/json" \
  -d '{"username":"aarav_realty","password":"Cedar-Harbor-8821-Qz"}'
```

**Property fields** (what the app/API expects): `title, description, type` (House | Apartment | Land
| Commercial), `status` (For Sale | For Rent), `price` (string, e.g. `₹1.2 Cr`), `area`, `beds`,
`baths`, `location`, `latitude`, `longitude`, `tags[]`, `img` (emoji), `color` (hex accent),
`owner_phone`, `images[]`, `location_visibility` (exact | approximate | hidden). Accent colors:
amber `#E09A33` · green `#129E6B` · blue `#2D74CB` · purple `#6A45C0` · orange `#DB8C2E`.

---

## Users (20)

| # | Username | Password | Full name | Phone | Email (verified?) | Avatar |
|---|----------|----------|-----------|-------|-------------------|--------|
| 1  | `aarav_realty`    | `Cedar-Harbor-8821-Qz`  | Aarav Sharma      | +91 98200 11001 | aarav+clerk_test@example.com — **yes** | AS |
| 2  | `meera_estates`   | `Willow-Canyon-4417-Rk` | Meera Patil       | +91 98200 11002 | meera+clerk_test@example.com — **yes** | MP |
| 3  | `rohan.k`         | `Amber-Meadow-7723-Tp`  | Rohan Kulkarni    | +91 98200 11003 | — (no)                                 | RK |
| 4  | `priya_nair`      | `Silver-Falls-3390-Vn`  | Priya Nair        | +91 98200 11004 | priya+clerk_test@example.com — **yes** | PN |
| 5  | `imran_h`         | `Cobalt-Ridge-9052-Wm`  | Imran Hussain     | +91 98200 11005 | — (no)                                 | IH |
| 6  | `sanjana_reddy`   | `Maple-Grove-6614-Xd`   | Sanjana Reddy     | +91 98200 11006 | sanjana+clerk_test@example.com — **yes** | SR |
| 7  | `vikram_estates`  | `Basalt-Cove-2288-Yh`   | Vikram Singh      | +91 98200 11007 | — (no)                                 | VS |
| 8  | `deepa_menon`     | `Cedar-Bluff-5147-Zc`   | Deepa Menon       | +91 98200 11008 | deepa+clerk_test@example.com — **yes** | DM |
| 9  | `arjun_realty`    | `Coral-Summit-8039-Bf`  | Arjun Verma       | +91 98200 11009 | — (no)                                 | AV |
| 10 | `neha.g`          | `Slate-Harbor-4471-Cg`  | Neha Gupta        | +91 98200 11010 | neha+clerk_test@example.com — **yes** | NG |
| 11 | `farhan_shaikh`   | `Birch-Meadow-6620-Dh`  | Farhan Shaikh     | +91 98200 11011 | — (no)                                 | FS |
| 12 | `kavya_iyer`      | `Onyx-Valley-3315-Ej`   | Kavya Iyer        | +91 98200 11012 | kavya+clerk_test@example.com — **yes** | KI |
| 13 | `manish_estates`  | `Cedar-Ridge-7788-Fk`   | Manish Joshi      | +91 98200 11013 | — (no)                                 | MJ |
| 14 | `ananya_das`      | `Amber-Cove-2201-Gl`    | Ananya Das        | +91 98200 11014 | ananya+clerk_test@example.com — **yes** | AD |
| 15 | `rahul.m`         | `Willow-Bluff-9934-Hm`  | Rahul Mehta       | +91 98200 11015 | — (no)                                 | RM |
| 16 | `tanvi_realty`    | `Cobalt-Meadow-5560-Jn` | Tanvi Kapoor      | +91 98200 11016 | tanvi+clerk_test@example.com — **yes** | TK |
| 17 | `zaid_ansari`     | `Maple-Harbor-8817-Kp`  | Zaid Ansari       | +91 98200 11017 | — (no)                                 | ZA |
| 18 | `divya_pillai`    | `Slate-Canyon-3346-Lq`  | Divya Pillai      | +91 98200 11018 | divya+clerk_test@example.com — **yes** | DP |
| 19 | `karan_estates`   | `Basalt-Grove-6109-Mr`  | Karan Malhotra    | +91 98200 11019 | — (no)                                 | KM |
| 20 | `isha_kapoor`     | `Cedar-Valley-4472-Ns`  | Isha Kapoor       | +91 98200 11020 | isha+clerk_test@example.com — **yes** | IK |

> Passwords follow a `Word-Word-NNNN-Xx` pattern (≥ Clerk's zxcvbn-2 + un-breached). If Clerk
> rejects one as too weak/breached, tweak the digits.

---

## Properties (20)

Each block lists **every** field. Owner # maps to the user table above.

### 1. Sea-View Penthouse — Worli
- **Owner:** #1 Aarav Sharma (+91 98200 11001) · **verified: yes**
- **type:** Apartment · **status:** For Sale · **price:** ₹8.5 Cr · **area:** 3,400 sq ft
- **beds:** 4 · **baths:** 4 · **location:** Worli Sea Face, Mumbai
- **lat/lng:** 19.0176, 72.8156 · **location_visibility:** exact
- **tags:** [Sea View, Private Terrace, Concierge, Parking] · **img:** 🏙️ · **color:** #2D74CB
- **description:** Full-floor penthouse with wraparound sea views, private plunge pool, imported marble, and 3 covered car parks. Walk to Worli Sea Link.
- **images:** https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800

### 2. 5-Acre Agricultural Land — Pune-Nashik Highway
- **Owner:** #2 Meera Patil (+91 98200 11002) · **verified: yes**
- **type:** Land · **status:** For Sale · **price:** ₹85 L · **area:** 5 Acres
- **beds:** — · **baths:** — · **location:** Rajgurunagar, Pune-Nashik Hwy
- **lat/lng:** 18.8637, 73.8846 · **location_visibility:** approximate
- **tags:** [Fertile Soil, Water Source, Road Access] · **img:** 🌾 · **color:** #129E6B
- **description:** Black-cotton-soil farmland with a year-round well and direct highway frontage. Clear title, ready for agriculture or a farmhouse.
- **images:** https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800

### 3. 2BHK Starter Flat — Kothrud
- **Owner:** #3 Rohan Kulkarni (+91 98200 11003) · **verified: no**
- **type:** Apartment · **status:** For Rent · **price:** ₹28,000/mo · **area:** 950 sq ft
- **beds:** 2 · **baths:** 2 · **location:** Kothrud, Pune
- **lat/lng:** 18.5074, 73.8077 · **location_visibility:** exact
- **tags:** [Semi-Furnished, Lift, 24x7 Water] · **img:** 🏢 · **color:** #E09A33
- **description:** Bright 2BHK in a quiet society, close to Karve Road. Semi-furnished with modular kitchen and covered two-wheeler parking.
- **images:** https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800

### 4. Independent Villa — Koramangala
- **Owner:** #4 Priya Nair (+91 98200 11004) · **verified: yes**
- **type:** House · **status:** For Sale · **price:** ₹6.2 Cr · **area:** 4,000 sq ft
- **beds:** 5 · **baths:** 5 · **location:** Koramangala 3rd Block, Bengaluru
- **lat/lng:** 12.9352, 77.6245 · **location_visibility:** hidden
- **tags:** [Garden, Home Office, Solar, Parking] · **img:** 🏡 · **color:** #6A45C0
- **description:** Architect-designed villa on a corner plot with landscaped garden, rooftop solar, and a double garage. Exact address shared with serious buyers.
- **images:** https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800

### 5. Commercial Office Floor — BKC
- **Owner:** #5 Imran Hussain (+91 98200 11005) · **verified: no**
- **type:** Commercial · **status:** For Rent · **price:** ₹4.5 L/mo · **area:** 5,200 sq ft
- **beds:** — · **baths:** 3 · **location:** Bandra Kurla Complex, Mumbai
- **lat/lng:** 19.0662, 72.8688 · **location_visibility:** exact
- **tags:** [Grade A, 100% Power Backup, 20 Parking] · **img:** 🏢 · **color:** #2D74CB
- **description:** Warm-shell office floor in a Grade-A tower, efficient floor plate, 20 reserved car parks, and metro connectivity.
- **images:** https://images.unsplash.com/photo-1497366216548-37526070297c?w=800

### 6. Lakeview 3BHK — Powai
- **Owner:** #6 Sanjana Reddy (+91 98200 11006) · **verified: yes**
- **type:** Apartment · **status:** For Sale · **price:** ₹3.1 Cr · **area:** 1,650 sq ft
- **beds:** 3 · **baths:** 3 · **location:** Hiranandani Gardens, Powai, Mumbai
- **lat/lng:** 19.1207, 72.9089 · **location_visibility:** approximate
- **tags:** [Lake View, Club House, Gym, Kids Play] · **img:** 🏙️ · **color:** #E09A33
- **description:** High-floor 3BHK overlooking Powai Lake with resort-style amenities and quick access to IIT-B and Hiranandani Hospital.
- **images:** https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800

### 7. Corner Plot (DTCP) — Hinjewadi
- **Owner:** #7 Vikram Singh (+91 98200 11007) · **verified: no**
- **type:** Land · **status:** For Sale · **price:** ₹1.4 Cr · **area:** 2,400 sq ft
- **beds:** — · **baths:** — · **location:** Hinjewadi Phase 2, Pune
- **lat/lng:** 18.5912, 73.7389 · **location_visibility:** exact
- **tags:** [Corner Plot, DTCP Approved, Gated] · **img:** 📍 · **color:** #129E6B
- **description:** DTCP-approved corner residential plot in a gated layout minutes from the IT park. Ready for construction, all utilities at the gate.
- **images:** https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800

### 8. Heritage Bungalow — Adyar
- **Owner:** #8 Deepa Menon (+91 98200 11008) · **verified: yes**
- **type:** House · **status:** For Sale · **price:** ₹5.5 Cr · **area:** 3,800 sq ft
- **beds:** 4 · **baths:** 4 · **location:** Adyar, Chennai
- **lat/lng:** 13.0012, 80.2565 · **location_visibility:** hidden
- **tags:** [Heritage, Mango Trees, Well, Parking] · **img:** 🏚️ · **color:** #6A45C0
- **description:** Restored 1960s bungalow on a leafy plot with mature mango trees and an open well. Loads of character; address on request.
- **images:** https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800

### 9. Studio Apartment — Whitefield
- **Owner:** #9 Arjun Verma (+91 98200 11009) · **verified: no**
- **type:** Apartment · **status:** For Rent · **price:** ₹19,500/mo · **area:** 520 sq ft
- **beds:** 1 · **baths:** 1 · **location:** Whitefield, Bengaluru
- **lat/lng:** 12.9698, 77.7500 · **location_visibility:** exact
- **tags:** [Fully Furnished, Wi-Fi, Laundry] · **img:** 🛋️ · **color:** #E09A33
- **description:** Move-in-ready furnished studio near ITPL — all utilities and high-speed internet included. Ideal for a single professional.
- **images:** https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800

### 10. Retail Showroom — CG Road
- **Owner:** #10 Neha Gupta (+91 98200 11010) · **verified: yes**
- **type:** Commercial · **status:** For Sale · **price:** ₹9.8 Cr · **area:** 6,000 sq ft
- **beds:** — · **baths:** 4 · **location:** CG Road, Ahmedabad
- **lat/lng:** 23.0300, 72.5600 · **location_visibility:** exact
- **tags:** [High Street, Glass Frontage, Basement] · **img:** 🏬 · **color:** #DB8C2E
- **description:** Double-height high-street showroom with prime glass frontage, basement storage, and heavy footfall. Suits flagship retail or F&B.
- **images:** https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800

### 11. 3BHK Builder Floor — Gurgaon
- **Owner:** #11 Farhan Shaikh (+91 98200 11011) · **verified: no**
- **type:** Apartment · **status:** For Rent · **price:** ₹55,000/mo · **area:** 1,850 sq ft
- **beds:** 3 · **baths:** 3 · **location:** DLF Phase 4, Gurgaon
- **lat/lng:** 28.4595, 77.0721 · **location_visibility:** approximate
- **tags:** [Semi-Furnished, Power Backup, Stilt Parking] · **img:** 🏢 · **color:** #2D74CB
- **description:** Independent builder floor with a private terrace, close to Galleria Market and Cyber Hub. Semi-furnished with two car parks.
- **images:** https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800

### 12. Farmhouse with Orchard — Alibaug
- **Owner:** #12 Kavya Iyer (+91 98200 11012) · **verified: yes**
- **type:** House · **status:** For Sale · **price:** ₹2.9 Cr · **area:** 6,500 sq ft
- **beds:** 4 · **baths:** 3 · **location:** Alibaug, Raigad
- **lat/lng:** 18.6414, 72.8722 · **location_visibility:** approximate
- **tags:** [Orchard, Pool, Caretaker, Barn] · **img:** 🏡 · **color:** #129E6B
- **description:** Weekend farmhouse on 1 acre with a mango orchard, private pool, and caretaker quarters. An hour by ferry from Mumbai.
- **images:** https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800

### 13. Industrial Warehouse — Bhiwandi
- **Owner:** #13 Manish Joshi (+91 98200 11013) · **verified: no**
- **type:** Commercial · **status:** For Rent · **price:** ₹3.2 L/mo · **area:** 20,000 sq ft
- **beds:** — · **baths:** 2 · **location:** Bhiwandi, Thane
- **lat/lng:** 19.2967, 73.0630 · **location_visibility:** exact
- **tags:** [Warehouse, 12m Clearance, Dock Levellers, Truck Access] · **img:** 🏭 · **color:** #DB8C2E
- **description:** RCC warehouse with 12m eave height, four dock levellers, and 40-ft container turning radius. On the Mumbai-Nashik logistics corridor.
- **images:** https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800

### 14. 1BHK Compact — Noida Sector 62
- **Owner:** #14 Ananya Das (+91 98200 11014) · **verified: yes**
- **type:** Apartment · **status:** For Rent · **price:** ₹16,000/mo · **area:** 650 sq ft
- **beds:** 1 · **baths:** 1 · **location:** Sector 62, Noida
- **lat/lng:** 28.6272, 77.3649 · **location_visibility:** exact
- **tags:** [Unfurnished, Metro Nearby, Lift] · **img:** 🏢 · **color:** #E09A33
- **description:** Affordable 1BHK a 5-minute walk from the Sector 62 metro, surrounded by IT offices. Great first rental.
- **images:** https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800

### 15. Hillside Plot — Lonavala
- **Owner:** #15 Rahul Mehta (+91 98200 11015) · **verified: no**
- **type:** Land · **status:** For Sale · **price:** ₹65 L · **area:** 3,600 sq ft
- **beds:** — · **baths:** — · **location:** Tungarli, Lonavala
- **lat/lng:** 18.7648, 73.4062 · **location_visibility:** hidden
- **tags:** [Valley View, NA Plot, Motorable Road] · **img:** ⛰️ · **color:** #6A45C0
- **description:** NA-converted hillside plot with dramatic valley views, ideal for a weekend villa. Motorable road up to the boundary. Location shared privately.
- **images:** https://images.unsplash.com/photo-1444927714506-8492d94b5ba0?w=800

### 16. Luxury 4BHK — Jubilee Hills
- **Owner:** #16 Tanvi Kapoor (+91 98200 11016) · **verified: yes**
- **type:** Apartment · **status:** For Sale · **price:** ₹4.7 Cr · **area:** 2,900 sq ft
- **beds:** 4 · **baths:** 4 · **location:** Jubilee Hills, Hyderabad
- **lat/lng:** 17.4319, 78.4073 · **location_visibility:** exact
- **tags:** [Corner Unit, Private Lift, Sky Deck] · **img:** 🏙️ · **color:** #2D74CB
- **description:** Corner 4BHK with a private lift lobby, home automation, and a shared sky deck. Prime Jubilee Hills address near KBR Park.
- **images:** https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800

### 17. Row House — Baner
- **Owner:** #17 Zaid Ansari (+91 98200 11017) · **verified: no**
- **type:** House · **status:** For Rent · **price:** ₹72,000/mo · **area:** 2,600 sq ft
- **beds:** 4 · **baths:** 4 · **location:** Baner, Pune
- **lat/lng:** 18.5590, 73.7868 · **location_visibility:** approximate
- **tags:** [Duplex, Terrace Garden, 2 Car Parks] · **img:** 🏘️ · **color:** #E09A33
- **description:** Spacious duplex row house in a gated community with a private terrace garden, near Baner-Balewadi high street.
- **images:** https://images.unsplash.com/photo-1576941089067-2de3c901e126?w=800

### 18. Sea-Facing Villa — Candolim, Goa
- **Owner:** #18 Divya Pillai (+91 98200 11018) · **verified: yes**
- **type:** House · **status:** For Sale · **price:** ₹7.9 Cr · **area:** 5,100 sq ft
- **beds:** 5 · **baths:** 5 · **location:** Candolim, North Goa
- **lat/lng:** 15.5187, 73.7626 · **location_visibility:** hidden
- **tags:** [Sea Facing, Pool, Portuguese Style, Rental Income] · **img:** 🏖️ · **color:** #6A45C0
- **description:** Portuguese-style sea-facing villa with a private pool and strong holiday-rental history. Exact location disclosed to verified buyers.
- **images:** https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800

### 19. Coworking-Ready Office — HSR Layout
- **Owner:** #19 Karan Malhotra (+91 98200 11019) · **verified: no**
- **type:** Commercial · **status:** For Rent · **price:** ₹2.1 L/mo · **area:** 3,000 sq ft
- **beds:** — · **baths:** 2 · **location:** HSR Layout, Bengaluru
- **lat/lng:** 12.9121, 77.6446 · **location_visibility:** exact
- **tags:** [Plug & Play, 45 Seats, Meeting Rooms, Cafeteria] · **img:** 🏢 · **color:** #DB8C2E
- **description:** Fully-fitted plug-and-play office for ~45 seats with two meeting rooms and a pantry. Startup hub location, ready from day one.
- **images:** https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800

### 20. Budget 2BHK — Rajarhat, Kolkata
- **Owner:** #20 Isha Kapoor (+91 98200 11020) · **verified: yes**
- **type:** Apartment · **status:** For Sale · **price:** ₹58 L · **area:** 1,080 sq ft
- **beds:** 2 · **baths:** 2 · **location:** Rajarhat, New Town, Kolkata
- **lat/lng:** 22.6180, 88.4640 · **location_visibility:** exact
- **tags:** [East Facing, Vaastu, Gym, Parking] · **img:** 🏢 · **color:** #129E6B
- **description:** East-facing Vaastu-compliant 2BHK in a newer township with a gym and covered parking. Close to the IT hub and airport.
- **images:** https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=800

---

## Coverage checklist (for deliberate testing)

- **Types:** House ×5 (4,8,12,17,18) · Apartment ×8 (1,3,6,9,11,14,16,20) · Land ×3 (2,7,15) · Commercial ×4 (5,10,13,19).
- **Status:** For Sale ×11 · For Rent ×9.
- **location_visibility:** exact ×11 · approximate ×5 (2,6,11,12,17) · hidden ×4 (4,8,15,18).
- **Owner verified:** yes ×10 (odd/even split) · no ×10 — test the 2FA-at-login path with a verified owner.
- **No beds/baths:** Land listings (2,7,15) — confirm the UI handles null beds/baths.
- **Cities:** Mumbai, Pune, Bengaluru, Chennai, Hyderabad, Ahmedabad, Gurgaon, Noida, Goa, Kolkata,
  Lonavala, Alibaug — good spread for map clustering + "near me".
