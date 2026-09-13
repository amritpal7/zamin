// Sentry initialization — MUST be required before ./app (before express/http/pg are
// imported) so the SDK can auto-instrument them. No-op when SENTRY_DSN is unset (local/dev),
// so it never adds noise or a hard dependency in development. DSNs are not secret.
const Sentry = require("@sentry/node");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    // Scrub obvious PII; we don't want message text / tokens in Sentry.
    sendDefaultPii: false,
  });
  console.log("🛰  Sentry initialized");
}

module.exports = Sentry;
