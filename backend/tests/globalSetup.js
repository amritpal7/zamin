// Ensures the test DB has the full schema (base tables come from db/init.sql; this
// applies the versioned migrations via node-pg-migrate — same runner as boot).
const { runMigrations } = require("../src/runMigrations");

module.exports = async () => {
  await runMigrations();
};
