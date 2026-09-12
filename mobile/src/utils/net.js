// Derive the Socket.io origin + path from the REST API base, handling BOTH deployments:
//  - dev: BASE ends with /api and the app talks through nginx, which strips /api. The client
//    must request /api/socket.io so nginx forwards it to the server's default /socket.io.
//  - prod: BASE is the bare API origin (no nginx). The client talks to the API directly, which
//    serves Socket.io at the default /socket.io.
// Getting this wrong silently breaks realtime in one environment (the handshake 404s and the
// socket never connects) while REST keeps working — so it's easy to miss. Keep it pure + tested.
export function socketConfig(base) {
  const hasApiPrefix = /\/api\/?$/.test(base || "");
  return {
    origin: (base || "").replace(/\/api\/?$/, ""),
    path: hasApiPrefix ? "/api/socket.io" : "/socket.io",
  };
}
