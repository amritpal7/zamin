const { Pool, types } = require("pg");

// node-postgres returns DECIMAL/NUMERIC (type OID 1700) as STRINGS to avoid float-precision
// loss. Our only NUMERIC columns are latitude/longitude, and the mobile client feeds those
// straight to react-native-maps, which on Android throws
// `UnexpectedNativeTypeException: Value for longitude cannot be cast from String to double`
// (Sentry ZAMIN-MOBILE-9). Parse OID 1700 → JS number so the API always emits numeric coords.
types.setTypeParser(1700, (v) => (v == null ? null : parseFloat(v)));

// Managed Postgres (Neon, RDS, Supabase, …) requires TLS; the Railway-internal DB and the
// local docker-compose DB do not. Enable SSL when the connection string asks for it (Neon's
// string includes ?sslmode=require) or when PGSSL=true is set. Exported so runMigrations can
// reuse the same decision for node-pg-migrate.
const DATABASE_URL = process.env.DATABASE_URL || "";
const sslConfig =
  /sslmode=require/i.test(DATABASE_URL) || process.env.PGSSL === "true"
    ? { rejectUnauthorized: false } // managed providers present valid certs; keep simple/portable
    : false;

const pool = new Pool({ connectionString: DATABASE_URL, ssl: sslConfig });

pool.on("error", (err) => console.error("Postgres pool error:", err));

module.exports = pool;
module.exports.sslConfig = sslConfig;
