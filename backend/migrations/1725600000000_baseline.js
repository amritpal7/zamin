/* eslint-disable camelcase */

// Baseline migration. Reuses the existing idempotent schema logic (`src/migrate.js`)
// as migration #1 so the schema stays defined in one place and applying this on an
// already-migrated database is a safe no-op. `pgm.db` exposes `.query(sql, params)` —
// the same interface `migrate()` expects from a pg Pool. Future schema changes go in
// NEW migration files (npm run migrate create <name>), not by editing migrate.js.

exports.up = async (pgm) => {
  const { migrate } = require("../src/migrate");
  await migrate(pgm.db);
};

// Baseline is not reversible (it's the starting point).
exports.down = false;
