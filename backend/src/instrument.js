// Sentry initialization — MUST be required before ./app (before express/http/pg are
// imported) so the SDK can auto-instrument them. No-op when SENTRY_DSN is unset (local/dev),
// so it never adds noise or a hard dependency in development. DSNs are not secret.
//
// Hardened: the require is wrapped so a MISSING @sentry/node (e.g. a minimal build or a stale
// Docker node_modules volume) degrades to a no-op instead of crashing the process at boot — an
// optional observability dependency must never take api/worker down. Callers that use the export
// (worker.js, realtime.js) already wrap Sentry.* calls in try/catch, so a null here is safe.
let Sentry = null;
try {
  Sentry = require("@sentry/node");
} catch {
  console.warn("⚠  @sentry/node not installed — Sentry disabled (running without error reporting)");
}

if (Sentry && process.env.SENTRY_DSN) {
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
