const path = require("path");

// Applies all pending migrations in ./migrations using node-pg-migrate (tracked in
// the `pgmigrations` table). Replaces the old boot-time hand-rolled migrate() call —
// migrations are now ordered, versioned, and each runs exactly once.
async function runMigrations() {
  const mod = require("node-pg-migrate");
  const runner = mod.default || mod;
  await runner({
    databaseUrl: process.env.DATABASE_URL,
    dir: path.join(__dirname, "..", "migrations"),
    migrationsTable: "pgmigrations",
    direction: "up",
    count: Infinity,
    log: (msg) => console.log(msg),
  });
}

module.exports = { runMigrations };
