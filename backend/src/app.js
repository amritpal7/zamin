require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { clerkMiddleware } = require("@clerk/express");

const { UPLOAD_DIR } = require("./upload");
const propertiesRouter = require("./routes/properties");
const savedRouter = require("./routes/saved");
const messagesRouter = require("./routes/messages");
const authRouter = require("./routes/auth");

// Builds the Express app WITHOUT starting a server. index.js adds listen() +
// boot tasks; tests import this directly with supertest.
const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json());

// Clerk attaches auth state to every request.
// Routes can then call requireAuth() to enforce login.
app.use(clerkMiddleware());

// ── Routes ──────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok", service: "zamin-api" }));

// Uploaded property images (reached via nginx at /api/uploads/...)
app.use("/uploads", express.static(UPLOAD_DIR));

app.use("/properties", propertiesRouter);
app.use("/saved", savedRouter);
app.use("/messages", messagesRouter);
app.use("/auth", authRouter);

// ── 404 / error handlers ────────────────────────────────────
app.use((_, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

module.exports = app;
