/* eslint-disable camelcase */

// Data fix: before 2026-11-07 the Post form saved prices without the ₹ / "/mo" convention
// ("85 L", "28 K"), so those listings displayed inconsistently ("85 L" vs "₹85 L"). Rewrite any
// price that starts with a digit into the app convention: "₹85 L", "₹28K/mo", "₹8.5 Cr".
// Only touches prices that START WITH A DIGIT (never already-formatted or free-text prices).

exports.up = (pgm) => {
  pgm.sql(`
    UPDATE properties
       SET price = '₹'
         || regexp_replace(btrim(price), '^([0-9][0-9.,]*)\\s*[kK]$', '\\1K')
         || CASE WHEN status ILIKE '%rent%' AND price !~* '/\\s*mo' THEN '/mo' ELSE '' END
     WHERE btrim(price) ~ '^[0-9]'
  `);
};

exports.down = () => {};
