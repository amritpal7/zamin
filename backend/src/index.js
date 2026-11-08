require("dotenv").config();
require("./instrument"); // Sentry.init — must run before ./app so express/http/pg get instrumented
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
  // Hosts without background workers (e.g. Render free): run the image + maintenance workers
  // inside the API process instead of a separate `worker` service.
  if (process.env.RUN_WORKER_IN_API === "true") {
    require("./worker");
    console.log("🧵 Workers running in-process (RUN_WORKER_IN_API)");
  }
});
