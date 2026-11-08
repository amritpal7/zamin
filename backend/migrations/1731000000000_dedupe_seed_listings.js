/* eslint-disable camelcase */

// Data fix: db/init.sql re-inserted its 6 seed listings on every api boot (no unique key, so
// ON CONFLICT never fired) — hundreds of photo-less duplicates that buried real listings in the
// feed. Keep the OLDEST copy of each (owner, title); delete the rest unless a copy has messages or
// saves attached (FKs cascade — never destroy user data). Seed owners only.

exports.up = (pgm) => {
  pgm.sql(`
    DELETE FROM properties p
    WHERE p.clerk_user_id LIKE 'seed\\_user\\_%'
      AND p.id NOT IN (
        SELECT DISTINCT ON (clerk_user_id, title) id
          FROM properties
         WHERE clerk_user_id LIKE 'seed\\_user\\_%'
         ORDER BY clerk_user_id, title, created_at ASC, id ASC
      )
      AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.property_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM saved_properties s WHERE s.property_id = p.id)
  `);
};

exports.down = () => {};
