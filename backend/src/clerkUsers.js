// Owner-liveness + display reconciliation. Users live in Clerk, not our DB, so a
// listing's owner can vanish (deleted / fake) or change their profile photo. We
// denormalize `owner_active` and `owner_image` onto properties so the app can flag
// unavailable owners and show their picture to other users.

const SECRET = process.env.CLERK_SECRET_KEY;

// Fetch a Clerk user. Returns { reliable, exists, imageUrl }.
// - reliable=false on a transient error → callers should NOT overwrite stored data.
// - demo/seed owners are treated as always active with no image.
async function getUser(id) {
  if (!id || id.startsWith("seed_user_")) return { reliable: true, exists: true, imageUrl: null };
  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${id}`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    if (res.status === 404) return { reliable: true, exists: false, imageUrl: null };
    if (!res.ok) return { reliable: false, exists: true, imageUrl: null };
    const u = await res.json();
    return { reliable: true, exists: true, imageUrl: u.has_image ? u.image_url : null };
  } catch {
    return { reliable: false, exists: true, imageUrl: null };
  }
}

async function userExists(id) {
  return (await getUser(id)).exists;
}

// Reconcile every distinct real owner: update owner_active + owner_image from Clerk.
// Skips rows on transient errors so a Clerk hiccup never wipes stored data.
async function reconcileOwners(pool) {
  const { rows } = await pool.query(
    "SELECT DISTINCT clerk_user_id FROM properties WHERE clerk_user_id NOT LIKE 'seed_user_%'"
  );
  let active = 0, inactive = 0, skipped = 0;
  for (const { clerk_user_id } of rows) {
    const u = await getUser(clerk_user_id);
    if (!u.reliable) { skipped++; continue; }
    await pool.query(
      "UPDATE properties SET owner_active = $1, owner_image = $2 WHERE clerk_user_id = $3",
      [u.exists, u.imageUrl, clerk_user_id]
    );
    u.exists ? active++ : inactive++;
  }
  return { checked: rows.length, active, inactive, skipped };
}

module.exports = { getUser, userExists, reconcileOwners };
