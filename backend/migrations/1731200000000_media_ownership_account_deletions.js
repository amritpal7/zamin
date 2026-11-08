/* eslint-disable camelcase */

// Security (2026-11-08 review):
//  - media_objects: who uploaded each processed image base. Account deletion removes ONLY the
//    caller's objects (never keys derived from listing URLs, which clients can forge).
//  - account_deletions: a durable marker written before a deletion starts, so if Clerk deletes the
//    user but our transaction rolls back (timeout / dropped connection), the sweep finishes the purge.
//  - indexes for the per-user message deletes / lookups.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS media_objects (
      base          VARCHAR(255) PRIMARY KEY,
      clerk_user_id VARCHAR(255) NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS media_objects_user_idx ON media_objects (clerk_user_id);
    CREATE TABLE IF NOT EXISTS account_deletions (
      clerk_user_id VARCHAR(255) PRIMARY KEY,
      requested_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS messages_sender_idx   ON messages (sender_id);
    CREATE INDEX IF NOT EXISTS messages_receiver_idx ON messages (receiver_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS messages_receiver_idx;
    DROP INDEX IF EXISTS messages_sender_idx;
    DROP TABLE IF EXISTS account_deletions;
    DROP TABLE IF EXISTS media_objects;
  `);
};
