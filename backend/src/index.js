require("dotenv").config();
const http = require("http");
const app = require("./app");
const { ensureBucket } = require("./storage");
const { attachRealtime } = require("./realtime");
const { runMigrations } = require("./runMigrations");

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
attachRealtime(server, app);

server.listen(PORT, () => {
  console.log(`🚀 Zamin API running on port ${PORT} (+ realtime)`);
  runMigrations().then(() => console.log("✅ DB migrations applied")).catch(err => console.error("Migration failed:", err.message));
  ensureBucket()
    .then(() => console.log("✅ Object storage bucket ready"))
    .catch(err => console.error("Bucket init failed:", err.message));
});
