require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { clerkMiddleware } = require("@clerk/express");

const { UPLOAD_DIR } = require("./upload");
const propertiesRouter = require("./routes/properties");
const savedRouter = require("./routes/saved");
const messagesRouter = require("./routes/messages");
const pushRouter = require("./routes/push");
const usersRouter = require("./routes/users");
const notificationsRouter = require("./routes/notifications");
const savedSearchesRouter = require("./routes/savedSearches");
const visitsRouter = require("./routes/visits");

// Builds the Express app WITHOUT starting a server. index.js adds listen() +
// boot tasks; tests import this directly with supertest.
const app = express();
app.set("trust proxy", 1); // behind nginx — needed for correct client IP (rate limiting)

// ── Security middleware ─────────────────────────────────────
// API-only: no HTML, so CSP/CORP would only get in the way of cross-origin fetches.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

// CORS: lock down via CORS_ORIGIN (comma-separated) in prod; "*" by default for dev.
const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: corsOrigin === "*" ? "*" : corsOrigin.split(",").map((o) => o.trim()) }));

app.use(express.json({ limit: "1mb" }));

// Basic abuse protection. Generous cap; the app is Clerk-authenticated anyway.
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 600),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
}));

// Clerk attaches auth state to every request.
app.use(clerkMiddleware());

// ── Routes ──────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok", service: "zamin-api" }));

// Uploaded property images (reached via nginx at /api/uploads/...)
app.use("/uploads", express.static(UPLOAD_DIR));

app.use("/properties", propertiesRouter);
app.use("/saved", savedRouter);
app.use("/messages", messagesRouter);
app.use("/push", pushRouter);
app.use("/users", usersRouter);
app.use("/notifications", notificationsRouter);
app.use("/saved-searches", savedSearchesRouter);
app.use("/visits", visitsRouter);

// ── 404 / error handlers ────────────────────────────────────
app.use((_, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  // Don't leak internal error details / stack traces to clients in production.
  const isProd = process.env.NODE_ENV === "production";
  res.status(err.status || 500).json({ error: isProd ? "Internal server error" : (err.message || "Internal server error") });
});

module.exports = app;
