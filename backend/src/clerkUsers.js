// Owner-liveness + display reconciliation. Users live in Clerk, not our DB, so a
// listing's owner can vanish (deleted / fake) or change their profile photo. We
// denormalize `owner_active` and `owner_image` onto properties so the app can flag
// unavailable owners and show their picture to other users.

const SECRET = process.env.CLERK_SECRET_KEY;

// Fetch a Clerk user. Returns { reliable, exists, imageUrl }.
// - reliable=false on a transient error → callers should NOT overwrite stored data.
// - verified = the account has at least one *verified* email or phone (trust badge).
// - demo/seed owners are treated as always active, unverified, with no image.
async function getUser(id) {
  const empty = { reliable: true, exists: true, imageUrl: null, name: null, avatar: null, verified: false };
  // No Clerk secret (tests/CI, or misconfig) → don't hit the network; treat as
  // unverified. seed/demo owners are likewise short-circuited.
  if (!id || !SECRET || id.startsWith("seed_user_")) return empty;
  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${id}`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    if (res.status === 404) return { reliable: true, exists: false, imageUrl: null, name: null, avatar: null, verified: false };
    if (!res.ok) return { reliable: false, exists: true, imageUrl: null, name: null, avatar: null, verified: false };
    const u = await res.json();
    const first = u.first_name || "", last = u.last_name || "", uname = u.username || "";
    const name = [first, last].filter(Boolean).join(" ") || (uname ? `@${uname}` : "User");
    const avatar = (`${first[0] || ""}${last[0] || ""}`).toUpperCase() || (uname[0] || "").toUpperCase() || "U";
    const verified =
      (u.email_addresses || []).some((e) => e.verification?.status === "verified") ||
      (u.phone_numbers || []).some((p) => p.verification?.status === "verified");
    return { reliable: true, exists: true, imageUrl: u.has_image ? u.image_url : null, name, avatar, verified };
  } catch {
    return { reliable: false, exists: true, imageUrl: null, name: null, avatar: null, verified: false };
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

// Reconcile a SINGLE owner's listings from Clerk (one API call). Used to propagate
// a just-changed account state (e.g. email verified → trust badge) to the owner's
// denormalized property rows immediately, instead of waiting for the scheduled sweep.
// Safe to expose per-user: it only touches rows owned by `clerkUserId`.
async function reconcileOwner(pool, clerkUserId) {
  if (!clerkUserId || clerkUserId.startsWith("seed_user_")) return { updated: 0, skipped: 1 };
  const u = await getUser(clerkUserId);
  if (!u.reliable) return { updated: 0, skipped: 1 };   // transient Clerk error → leave data as-is
  if (!u.exists) {
    const { rowCount } = await pool.query(
      "UPDATE properties SET owner_active = false WHERE clerk_user_id = $1", [clerkUserId]
    );
    return { updated: rowCount, inactive: true };
  }
  const { rowCount } = await pool.query(
    `UPDATE properties
       SET owner_active = true,
           owner_image  = $1,
           owner_name   = COALESCE($2, owner_name),
           owner_avatar = COALESCE($3, owner_avatar),
           verified     = $4
     WHERE clerk_user_id = $5`,
    [u.imageUrl, u.name, u.avatar, u.verified, clerkUserId]
  );
  return { updated: rowCount, verified: u.verified };
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
    if (u.exists) {
      // Keep the denormalized owner display in sync with Clerk. u.name already
      // prefers the full name and falls back to @username.
      await pool.query(
        `UPDATE properties
           SET owner_active = true,
               owner_image  = $1,
               owner_name   = COALESCE($2, owner_name),
               owner_avatar = COALESCE($3, owner_avatar),
               verified     = $4
         WHERE clerk_user_id = $5`,
        [u.imageUrl, u.name, u.avatar, u.verified, clerk_user_id]
      );
      active++;
    } else {
      await pool.query("UPDATE properties SET owner_active = false WHERE clerk_user_id = $1", [clerk_user_id]);
      inactive++;
    }
  }
  return { checked: rows.length, active, inactive, skipped };
}

module.exports = { getUser, userExists, reconcileOwner, reconcileOwners, backfillMessageSenders };
