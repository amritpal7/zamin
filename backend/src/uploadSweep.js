// Abandoned-upload sweeper. Every presign inserts a pending_uploads row; it is consumed by
// POST /properties/process or POST /users/me/photo. If the client never gets there (app killed,
// network drop, user cancelled), the row and its raw `<base>_orig` object linger forever.
// This deletes bindings older than STALE_UPLOAD_MS and best-effort removes their raw objects.
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");

const STALE_UPLOAD_MS = Number(process.env.STALE_UPLOAD_MS || 60 * 60 * 1000); // 1 h (presign URLs live 10 min)

async function sweepStaleUploads(pool, s3, bucket, olderThanMs = STALE_UPLOAD_MS) {
  const { rows } = await pool.query(
    "DELETE FROM pending_uploads WHERE created_at < NOW() - ($1::bigint * INTERVAL '1 millisecond') RETURNING base",
    [olderThanMs]
  );
  let objectsDeleted = 0;
  for (const { base } of rows) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: `${base}_orig` })); // no-op if never uploaded
      objectsDeleted++;
    } catch { /* leave it; next sweep won't see it, but it's private (not *.jpg) */ }
  }
  return { bindings: rows.length, objectsDeleted };
}

module.exports = { sweepStaleUploads, STALE_UPLOAD_MS };
