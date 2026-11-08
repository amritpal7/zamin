// Messaging guards (security audit 2026-11-07):
//  - canMessage: a conversation is always (listing owner ↔ someone). You may message the owner of
//    the listing, or — as the owner — reply to someone who already messaged you about it. Stops
//    unsolicited DMs/proposals to arbitrary accounts under arbitrary listings.
//  - senderIdentity: sender name/avatar/photo come from Clerk, not the request body (no impersonation).
//  - safeImageMeta: image messages may only point at our own processed media.
const { getUser } = require("./clerkUsers");

async function canMessage(pool, propertyId, senderId, receiverId) {
  const { rows } = await pool.query("SELECT clerk_user_id FROM properties WHERE id = $1", [propertyId]);
  if (!rows[0]) return { ok: false, status: 404, error: "Listing not found." };
  const owner = rows[0].clerk_user_id;
  if (String(receiverId) === String(owner)) return { ok: true };
  if (String(senderId) === String(owner)) {
    const prior = await pool.query(
      "SELECT 1 FROM messages WHERE property_id = $1 AND sender_id = $2 AND receiver_id = $3 LIMIT 1",
      [propertyId, receiverId, senderId]
    );
    if (prior.rowCount) return { ok: true };
  }
  return { ok: false, status: 403, error: "You can only message the owner of this listing." };
}

// Short cache so a chat burst doesn't hit Clerk per message.
const ID_TTL_MS = 2 * 60 * 1000;
const idCache = new Map();
async function senderIdentity(userId, body = {}) {
  // No Clerk secret (tests/CI): keep the client-supplied display fields.
  if (!process.env.CLERK_SECRET_KEY) {
    return { sender_name: body.sender_name || null, sender_avatar: body.sender_avatar || null, sender_image: body.sender_image || null };
  }
  const hit = idCache.get(userId);
  if (hit && hit.exp > Date.now()) return hit.v;
  const u = await getUser(userId);
  const v = u.reliable && u.exists
    ? { sender_name: u.name, sender_avatar: u.avatar, sender_image: u.imageUrl }
    : { sender_name: null, sender_avatar: null, sender_image: null }; // never fall back to client values
  if (u.reliable) idCache.set(userId, { v, exp: Date.now() + ID_TTL_MS });
  return v;
}
function forgetSenderIdentity(userId) { idCache.delete(userId); }

// Accept only our processed images, relative or on the API host / storage public host(s).
// Returns sanitized { url, thumb } or null.
// Dev: (/api)/media/properties/… via nginx. Prod: absolute MinIO/S3 URLs …/<bucket>/properties/….
const BUCKET_NAME = (process.env.S3_BUCKET || "zamin").replace(/[^A-Za-z0-9._-]/g, "").replace(/\./g, "\\.");
const MEDIA_PATH = new RegExp(`^(?:(?:/api)?/media|/${BUCKET_NAME})/properties/[A-Za-z0-9-]+(?:_thumb)?\\.jpg$`);
function safeMediaUrl(raw, req) {
  if (typeof raw !== "string" || raw.length > 500) return null;
  if (raw.startsWith("/")) return MEDIA_PATH.test(raw) ? raw : null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || u.search || u.hash) return null;
  // Hosts come from CONFIG only — never from the request (Host / X-Forwarded-Host are client-controlled).
  // In dev S3_PUBLIC_ENDPOINT is http://$HOST_IP, i.e. the same host the app uses for /api.
  const allowedHosts = new Set();
  if (process.env.API_PUBLIC_URL) { try { allowedHosts.add(new URL(process.env.API_PUBLIC_URL).hostname); } catch {} }
  for (const v of [process.env.S3_PUBLIC_ENDPOINT, process.env.S3_PUBLIC_BASE]) {
    try { if (v && /^https?:/.test(v)) allowedHosts.add(new URL(v).hostname); } catch {}
  }
  return allowedHosts.has(u.hostname) && MEDIA_PATH.test(u.pathname) ? raw : null;
}
// Our processed-media base ("properties/<id>") for a URL we'd serve, or null.
function mediaBaseOf(raw) {
  const ok = safeMediaUrl(raw);
  if (!ok) return null;
  const path = ok.startsWith("/") ? ok : new URL(ok).pathname;
  const m = path.match(/\/(properties\/[A-Za-z0-9-]+?)(?:_thumb)?\.jpg$/);
  return m ? m[1] : null;
}

function safeImageMeta(image, req) {
  const url = safeMediaUrl(image?.url, req);
  if (!url) return null;
  const thumb = image.thumb ? safeMediaUrl(image.thumb, req) : url;
  return thumb ? { url, thumb } : null;
}

module.exports = { canMessage, senderIdentity, forgetSenderIdentity, safeImageMeta, mediaBaseOf, MEDIA_PATH };
