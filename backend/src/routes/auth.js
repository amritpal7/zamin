const express = require("express");
const { clerkClient } = require("@clerk/express");

const router = express.Router();

// GET /auth/resolve?username=johndoe
// Resolves a display username (stored in unsafeMetadata) to the account email
// so the client can sign in with email+password. No auth required.
router.get("/resolve", async (req, res) => {
  const { username } = req.query;
  if (!username || !username.trim()) {
    return res.status(400).json({ error: "username query param required" });
  }

  const needle = username.trim().replace(/^@/, "").toLowerCase();

  try {
    // Paginate through Clerk users looking for a matching unsafeMetadata.username.
    // Suitable for apps with <500 users; add a DB index for larger scale.
    let offset = 0;
    const limit = 500;

    while (true) {
      const resp  = await clerkClient.users.getUserList({ limit, offset });
      const users = Array.isArray(resp) ? resp : (resp.data ?? []);

      const match = users.find(
        u => (u.unsafeMetadata?.username ?? "").toLowerCase() === needle
      );

      if (match) {
        const email = match.emailAddresses?.[0]?.emailAddress;
        if (!email) return res.status(404).json({ error: "Account has no email address" });
        return res.json({ email });
      }

      if (users.length < limit) break; // exhausted all pages
      offset += limit;
    }

    return res.status(404).json({ error: "Username not found" });
  } catch (err) {
    console.error("resolve username error:", err);
    res.status(500).json({ error: "Could not look up username" });
  }
});

module.exports = router;
