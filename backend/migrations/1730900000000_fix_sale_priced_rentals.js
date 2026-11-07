/* eslint-disable camelcase */

// Data fix: the base seed (db/init.sql) shipped "Luxury Apartment — Sea View" as
// 'For Rent' with a sale price (₹1.8 Cr), and it was copied into many demo rows.
// Those rows inflated the rental ₹/sqft median so every real rental's price
// insight read "100% below the area median". Re-label them as For Sale.
// Scoped to seed owners only — never touches real users' listings.

exports.up = (pgm) => {
  pgm.sql(`
    UPDATE properties SET status = 'For Sale'
    WHERE status = 'For Rent'
      AND clerk_user_id LIKE 'seed\\_user\\_%'
      AND price ILIKE '%cr%'
  `);
};

exports.down = () => {};
