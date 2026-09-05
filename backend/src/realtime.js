const { Server } = require("socket.io");
const { verifyToken } = require("@clerk/backend");
const { createAdapter } = require("@socket.io/redis-adapter");
const IORedis = require("ioredis");

// Attaches Socket.io to the HTTP server. Each client authenticates with its Clerk
// session token and joins a personal room keyed by its Clerk user id, so the API
// can push events to a specific user with io.to(userId).
function attachRealtime(server, app) {
  const io = new Server(server, { cors: { origin: "*" } });

  // Multi-instance fan-out: route Socket.io events through Redis pub/sub so
  // io.to(userId) reaches a user connected to ANY API instance. Best-effort — if
  // Redis is unreachable, Socket.io falls back to its in-memory adapter (fine for one instance).
  try {
    const opts = {
      host: process.env.REDIS_HOST || "redis",
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: null,
    };
    const pub = new IORedis(opts);
    const sub = pub.duplicate();
    pub.on("error", (e) => console.error("socket.io redis pub error:", e.message));
    sub.on("error", (e) => console.error("socket.io redis sub error:", e.message));
    io.adapter(createAdapter(pub, sub));
    console.log("Socket.io Redis adapter attached");
  } catch (e) {
    console.error("Redis adapter setup failed; using in-memory adapter:", e.message);
  }

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("unauthorized"));
      const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(socket.userId);
    // Relay ephemeral typing signals to the other person in the thread.
    socket.on("typing", ({ to, propertyId, typing }) => {
      if (to) io.to(to).emit("typing", { from: socket.userId, propertyId, typing: !!typing });
    });
  });

  app.set("io", io); // routes reach it via req.app.get("io")
  return io;
}

module.exports = { attachRealtime };
