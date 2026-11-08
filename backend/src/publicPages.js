// Public, unauthenticated pages served by the API (no separate web hosting needed).
// GET /account-deletion — Google Play requires a web URL where users can learn how to delete
// their account and request deletion without the app. Enter `<API base>/account-deletion` in
// Play Console → App content → Data safety → Data deletion.
const router = require("express").Router();

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

router.get("/account-deletion", (_req, res) => {
  const email = process.env.SUPPORT_EMAIL;
  const contact = email
    ? `Email <a href="mailto:${esc(email)}?subject=Delete%20my%20Zamin%20account">${esc(email)}</a> from any address with the subject
       “Delete my Zamin account” and include your <b>Zamin username</b>. We'll confirm and delete it within 30 days.`
    : `Contact us through the support address listed on the app's store page and include your <b>Zamin username</b>.`;
  res.set("Cache-Control", "public, max-age=3600");
  res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Delete your Zamin account</title>
<style>body{font:16px/1.6 system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:32px 20px;color:#14181f;background:#f7f5f0}
h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 6px}p,li{color:#333}code{background:#ece8df;padding:1px 6px;border-radius:6px}
.card{background:#fff;border:1px solid #e6e1d6;border-radius:16px;padding:18px 20px;margin-top:16px}small{color:#777}</style></head>
<body><h1>Delete your Zamin account</h1><small>Zamin — zero-brokerage property marketplace</small>
<div class="card"><h2>In the app (fastest)</h2><ol><li>Open Zamin and sign in.</li><li>Go to <b>Me → Settings</b>.</li>
<li>Scroll down and tap <b>Delete account</b>, then <b>Delete forever</b>.</li></ol><p>Your account is deleted immediately.</p></div>
<div class="card"><h2>Without the app</h2><p>${contact}</p></div>
<div class="card"><h2>What gets deleted</h2><p>Your account and sign-in details, profile photo, listings and their photos, messages,
offers and visit requests, saved listings and searches, notifications, reviews, and reports you filed.</p>
<h2>What may be kept</h2><p>Reports other users made about your account may be retained for safety and abuse prevention.
Backups that contain deleted data are overwritten in the normal backup cycle.</p></div></body></html>`);
});

module.exports = router;
