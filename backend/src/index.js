require("dotenv").config();
const http = require("http");
const app = require("./app");
const pool = require("./db");
const { ensureBucket } = require("./storage");
const { attachRealtime } = require("./realtime");
const { migrate } = require("./migrate");

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
attachRealtime(server, app);

server.listen(PORT, () => {
  console.log(`🚀 Zamin API running on port ${PORT} (+ realtime)`);
  migrate(pool).then(() => console.log("✅ DB migration complete")).catch(err => console.error("Migration failed:", err.message));
  ensureBucket()
    .then(() => console.log("✅ Object storage bucket ready"))
    .catch(err => console.error("Bucket init failed:", err.message));
});
