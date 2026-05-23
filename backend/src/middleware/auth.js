const { requireAuth: clerkRequireAuth } = require("@clerk/express");

/**
 * Drop this on any route that needs a logged-in user.
 * Clerk validates the JWT from the Authorization header automatically.
 * On failure it returns 401 before your handler runs.
 *
 * Usage:
 *   router.post("/", requireAuth, myController);
 */
const requireAuth = clerkRequireAuth();

module.exports = { requireAuth };
