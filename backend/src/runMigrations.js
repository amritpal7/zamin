const path = require("path");
const fs = require("fs");

// Applies all pending migrations in ./migrations using node-pg-migrate (tracked in
// the `pgmigrations` table). Replaces the old boot-time hand-rolled migrate() call —
// migrations are now ordered, versioned, and each runs exactly once.
async function runMigrations() {
  // Base schema. The docker-compose Postgres runs db/init.sql via its
  // docker-entrypoint-initdb.d mount, but a managed/cloud Postgres (Railway, RDS, …)
  // does not — so apply it here first. init.sql is fully idempotent (CREATE … IF NOT
  // EXISTS), so this is a safe no-op on an already-provisioned DB and makes a fresh
  // managed DB self-provisioning. The versioned migrations below then add columns.
  const pool = require("./db");
  const initSql = fs.readFileSync(path.join(__dirname, "..", "db", "init.sql"), "utf8");
  await pool.query(initSql);

  const mod = require("node-pg-migrate");
  const runner = mod.default || mod;
  await runner({
    // Reuse db.js's SSL decision so migrations connect to managed Postgres (Neon: sslmode=require).
    databaseUrl: pool.sslConfig
      ? { connectionString: process.env.DATABASE_URL, ssl: pool.sslConfig }
      : process.env.DATABASE_URL,
    dir: path.join(__dirname, "..", "migrations"),
    migrationsTable: "pgmigrations",
    direction: "up",
    count: Infinity,
    log: (msg) => console.log(msg),
  });
}

module.exports = { runMigrations };
