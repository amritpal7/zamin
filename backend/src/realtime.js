const { Server } = require("socket.io");
const { verifyToken } = require("@clerk/backend");

// Attaches Socket.io to the HTTP server. Each client authenticates with its Clerk
// session token and joins a personal room keyed by its Clerk user id, so the API
// can push events to a specific user with io.to(userId).
function attachRealtime(server, app) {
  const io = new Server(server, { cors: { origin: "*" } });

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
