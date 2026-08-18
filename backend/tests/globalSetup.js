// Ensures the test DB has the full schema (base tables come from db/init.sql;
// this applies the idempotent migrations/columns the tests rely on).
const { Pool } = require("pg");
const { migrate } = require("../src/migrate");

module.exports = async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await migrate(pool);
  await pool.end();
};
