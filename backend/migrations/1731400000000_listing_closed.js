/* eslint-disable camelcase */

// Owners can mark a listing Sold / Rented (closed_at set) instead of deleting it: it leaves the
// public feed and map, but existing chats, saved lists and direct links still open it with a
// "Sold"/"Rented" badge, so buyers mid-conversation aren't left with a dead link.
exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE properties DROP COLUMN IF EXISTS closed_at;`);
};
