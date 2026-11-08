// Immediate revocation for deleted accounts. Clerk session JWTs are verified offline and stay
// valid for up to ~60 s after the user is deleted, so a stale token could keep calling the API
// (or recreate rows mid-deletion). On deletion we mark the id in Redis (shared across instances)
// for longer than a token can live; requireAuth + socket auth reject marked ids.
const IORedis = require("ioredis");
const { redisOptions } = require("./redisConfig");

const TTL_SECONDS = 300;
const local = new Map(); // id → expiry ms (fast path + works if Redis is briefly down)
let redis = null;
function client() {
  if (!redis) {
    redis = new IORedis(redisOptions({ maxRetriesPerRequest: 1, enableOfflineQueue: false }));
    redis.on("error", () => {}); // never crash the API over the revocation cache
  }
  return redis;
}

async function markDeleted(userId) {
  local.set(String(userId), Date.now() + TTL_SECONDS * 1000);
  try { await client().set(`deleted-user:${userId}`, "1", "EX", TTL_SECONDS); } catch { /* local still applies */ }
}

async function isDeleted(userId) {
  if (!userId) return false;
  const exp = local.get(String(userId));
  if (exp) { if (exp > Date.now()) return true; local.delete(String(userId)); }
  try { return (await client().exists(`deleted-user:${userId}`)) === 1; } catch { return false; } // fail open on cache outage
}

module.exports = { markDeleted, isDeleted };
