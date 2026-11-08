const { getAuth } = require("@clerk/express");
const { isDeleted } = require("../revocation");

// REST-API guard — always returns 401 JSON, never redirects.
// clerkRequireAuth() from @clerk/express redirects to a sign-in URL (302)
// which makes fetch follow the redirect and receive HTML instead of JSON.
const requireAuth = async (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  // A just-deleted account's JWT stays valid for ~60 s — reject it immediately.
  if (await isDeleted(userId)) return res.status(401).json({ error: "Unauthorized" });
  next();
};

module.exports = { requireAuth };
