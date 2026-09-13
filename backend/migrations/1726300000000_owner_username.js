/* eslint-disable camelcase */

// Denormalized owner @username on properties — shown next to owner_name to disambiguate
// accounts that share a display name (e.g. two "Meera Patil"s). Set on create from the
// owner's Clerk user, and kept in sync by the reconcile job.

exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_username VARCHAR(255)`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE properties DROP COLUMN IF EXISTS owner_username`);
};
