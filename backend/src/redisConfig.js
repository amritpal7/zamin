// One place to build Redis connection options for BullMQ, the Socket.io adapter and the
// revocation cache. Supports either REDIS_URL (redis:// or rediss:// with user/password — managed
// providers like Render Key Value / Upstash) or the docker-compose REDIS_HOST/REDIS_PORT pair.
function redisOptions(extra = {}) {
  const url = process.env.REDIS_URL;
  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 6379),
      ...(u.username ? { username: decodeURIComponent(u.username) } : {}),
      ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
      ...(u.protocol === "rediss:" ? { tls: {} } : {}),
      ...extra,
    };
  }
  return {
    host: process.env.REDIS_HOST || "redis",
    port: Number(process.env.REDIS_PORT || 6379),
    ...extra,
  };
}

module.exports = { redisOptions };
