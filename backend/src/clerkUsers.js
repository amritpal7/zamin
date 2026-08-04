// Owner-liveness reconciliation. Users live in Clerk, not our DB, so a listing's
// owner can vanish (deleted / fake account removed). We denormalize an
// `owner_active` flag onto properties so the app can flag unavailable owners.

const SECRET = process.env.CLERK_SECRET_KEY;

// Does a Clerk user id still exist? Demo/seed owners are always treated as active.
// On any non-404 error we return `true` so a transient API hiccup never falsely
// flags a real owner as gone.
async function userExists(id) {
  if (!id || id.startsWith("seed_user_")) return true;
  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${id}`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    if (res.status === 404) return false;
    return true;
  } catch {
    return true;
  }
}

// Check every distinct real owner against Clerk and update owner_active.
async function reconcileOwners(pool) {
  const { rows } = await pool.query(
    "SELECT DISTINCT clerk_user_id FROM properties WHERE clerk_user_id NOT LIKE 'seed_user_%'"
  );
  let active = 0, inactive = 0;
  for (const { clerk_user_id } of rows) {
    const exists = await userExists(clerk_user_id);
    await pool.query(
      "UPDATE properties SET owner_active = $1 WHERE clerk_user_id = $2",
      [exists, clerk_user_id]
    );
    exists ? active++ : inactive++;
  }
  return { checked: rows.length, active, inactive };
}

module.exports = { userExists, reconcileOwners };
