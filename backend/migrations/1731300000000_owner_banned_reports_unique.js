/* eslint-disable camelcase */

// Security review 2026-11-10 (moderation):
//  - owner_banned: a ban hides ALL the owner's listings without touching the per-listing `flagged`
//    moderation state, so an unban can't un-hide a listing that was hidden for its own reasons.
//    (Not owner_active: reconcile would flip that back — banned users still exist in Clerk.)
//  - reports: one row per (reporter, reported user, listing) enforced by a unique index, so
//    concurrent taps can't insert duplicates (inserts use ON CONFLICT DO NOTHING).

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_banned BOOLEAN DEFAULT false;
    DELETE FROM reports a USING reports b
     WHERE a.ctid > b.ctid
       AND a.reporter_id = b.reporter_id
       AND a.reported_id = b.reported_id
       AND a.property_id IS NOT DISTINCT FROM b.property_id;
    CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_per_reporter
      ON reports (reporter_id, reported_id, COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS reports_unique_per_reporter;
    ALTER TABLE properties DROP COLUMN IF EXISTS owner_banned;
  `);
};
