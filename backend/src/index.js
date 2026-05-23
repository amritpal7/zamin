require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { clerkMiddleware } = require("@clerk/express");

const propertiesRouter = require("./routes/properties");
const savedRouter = require("./routes/saved");
const messagesRouter = require("./routes/messages");

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json());

// Clerk attaches auth state to every request.
// Routes can then call requireAuth() to enforce login.
app.use(clerkMiddleware());

// ── Routes ──────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok", service: "zamin-api" }));

app.use("/properties", propertiesRouter);
app.use("/saved", savedRouter);
app.use("/messages", messagesRouter);

// ── 404 / error handlers ────────────────────────────────────
app.use((_, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => console.log(`🚀 Zamin API running on port ${PORT}`));
