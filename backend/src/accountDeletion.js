// Account deletion: one purge used by DELETE /users/me and by the maintenance sweep that
// finishes deletions whose Clerk delete succeeded but whose DB transaction did not commit.
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { s3, BUCKET, UPLOAD_BUCKET } = require("./storage");
const { getUser } = require("./clerkUsers");

// Delete every row keyed to `userId` inside the caller's transaction (`client`).
// Returns the media bases the user OWNED (from media_objects) for storage cleanup after commit.
async function purgeUserData(client, userId) {
  const del = (sql) => client.query(sql, [userId]);
  const { rows } = await del("DELETE FROM media_objects WHERE clerk_user_id = $1 RETURNING base");
  await del("DELETE FROM properties WHERE clerk_user_id = $1");            // cascades messages + saves on them
  await del("DELETE FROM messages WHERE sender_id = $1 OR receiver_id = $1");
  await del("DELETE FROM saved_properties WHERE clerk_user_id = $1");
  await del("DELETE FROM saved_searches WHERE clerk_user_id = $1");
  await del("DELETE FROM notifications WHERE clerk_user_id = $1 OR data->>'peer' = $1"); // incl. others' rows naming them
  await del("DELETE FROM push_tokens WHERE clerk_user_id = $1");
  await del("DELETE FROM pending_uploads WHERE clerk_user_id = $1");
  await del("DELETE FROM visits WHERE requester_id = $1 OR owner_id = $1");
  await del("DELETE FROM blocks WHERE blocker_id = $1 OR blocked_id = $1");
  await del("DELETE FROM reviews WHERE reviewer_id = $1 OR owner_id = $1");
  // Reports FILED by the user are removed; reports ABOUT them are kept as moderation evidence.
  await del("DELETE FROM reports WHERE reporter_id = $1");
  return rows.map((r) => r.base);
}

// Best-effort removal of the user's own processed images (+ any leftover raw original).
function deleteOwnedMedia(bases) {
  for (const base of bases) {
    if (!/^properties\/[A-Za-z0-9-]+$/.test(base)) continue;
    for (const key of [`${base}.jpg`, `${base}_thumb.jpg`]) {
      s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {});
    }
    s3.send(new DeleteObjectCommand({ Bucket: UPLOAD_BUCKET, Key: `${base}_orig` })).catch(() => {});
  }
}

// Maintenance: finish deletions left behind by a rollback after Clerk had already deleted the user.
async function finishPendingDeletions(pool, olderThanMs = 10 * 60 * 1000) {
  const { rows } = await pool.query(
    "SELECT clerk_user_id FROM account_deletions WHERE requested_at < NOW() - ($1::bigint * INTERVAL '1 millisecond')",
    [olderThanMs]
  );
  let purged = 0, cleared = 0;
  for (const { clerk_user_id: id } of rows) {
    const u = await getUser(id);
    if (!u.reliable) continue;                       // Clerk unreachable → try next sweep
    if (u.exists) {                                  // deletion genuinely failed; user can retry
      await pool.query("DELETE FROM account_deletions WHERE clerk_user_id = $1", [id]);
      cleared++; continue;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const bases = await purgeUserData(client, id);
      await client.query("DELETE FROM account_deletions WHERE clerk_user_id = $1", [id]);
      await client.query("COMMIT");
      deleteOwnedMedia(bases);
      purged++;
    } catch {
      await client.query("ROLLBACK").catch(() => {});
    } finally {
      client.release();
    }
  }
  return { pending: rows.length, purged, cleared };
}

module.exports = { purgeUserData, deleteOwnedMedia, finishPendingDeletions };
