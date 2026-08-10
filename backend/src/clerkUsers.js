// Owner-liveness + display reconciliation. Users live in Clerk, not our DB, so a
// listing's owner can vanish (deleted / fake) or change their profile photo. We
// denormalize `owner_active` and `owner_image` onto properties so the app can flag
// unavailable owners and show their picture to other users.

const SECRET = process.env.CLERK_SECRET_KEY;

// Fetch a Clerk user. Returns { reliable, exists, imageUrl }.
// - reliable=false on a transient error → callers should NOT overwrite stored data.
// - demo/seed owners are treated as always active with no image.
async function getUser(id) {
  const empty = { reliable: true, exists: true, imageUrl: null, name: null, avatar: null };
  if (!id || id.startsWith("seed_user_")) return empty;
  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${id}`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    if (res.status === 404) return { reliable: true, exists: false, imageUrl: null, name: null, avatar: null };
    if (!res.ok) return { reliable: false, exists: true, imageUrl: null, name: null, avatar: null };
    const u = await res.json();
    const first = u.first_name || "", last = u.last_name || "", uname = u.username || "";
    const name = [first, last].filter(Boolean).join(" ") || (uname ? `@${uname}` : "User");
    const avatar = (`${first[0] || ""}${last[0] || ""}`).toUpperCase() || (uname[0] || "").toUpperCase() || "U";
    return { reliable: true, exists: true, imageUrl: u.has_image ? u.image_url : null, name, avatar };
  } catch {
    return { reliable: false, exists: true, imageUrl: null, name: null, avatar: null };
  }
}

async function userExists(id) {
  return (await getUser(id)).exists;
}

// Backfill denormalized sender identity on messages that predate the feature
// (sender_name IS NULL). New messages already carry it; this heals old ones from Clerk.
async function backfillMessageSenders(pool) {
  const { rows } = await pool.query(
    "SELECT DISTINCT sender_id FROM messages WHERE sender_name IS NULL AND sender_id NOT LIKE 'seed_user_%'"
  );
  let filled = 0;
  for (const { sender_id } of rows) {
    const u = await getUser(sender_id);
    if (!u.reliable || !u.exists || !u.name) continue;
    await pool.query(
      "UPDATE messages SET sender_name = $1, sender_avatar = $2, sender_image = $3 WHERE sender_id = $4 AND sender_name IS NULL",
      [u.name, u.avatar, u.imageUrl, sender_id]
    );
    filled++;
  }
  return { senders: rows.length, filled };
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

module.exports = { getUser, userExists, reconcileOwners, backfillMessageSenders };
