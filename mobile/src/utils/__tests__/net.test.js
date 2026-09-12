import { socketConfig } from "../net";

describe("socketConfig", () => {
  test("dev behind nginx (BASE ends with /api) → /api/socket.io, origin without /api", () => {
    expect(socketConfig("http://localhost/api")).toEqual({
      origin: "http://localhost",
      path: "/api/socket.io",
    });
    expect(socketConfig("http://192.168.1.5/api/")).toEqual({
      origin: "http://192.168.1.5",
      path: "/api/socket.io",
    });
  });

  test("prod direct API (no /api suffix) → /socket.io, origin unchanged (regression: used to hardcode /api/socket.io → realtime dead in prod)", () => {
    expect(socketConfig("https://api-production-43dd.up.railway.app")).toEqual({
      origin: "https://api-production-43dd.up.railway.app",
      path: "/socket.io",
    });
  });

  test("does not strip a mid-path 'api' segment", () => {
    // only a trailing /api (optionally with slash) is the nginx prefix
    expect(socketConfig("https://apingsvc.example.com")).toEqual({
      origin: "https://apingsvc.example.com",
      path: "/socket.io",
    });
  });
});
