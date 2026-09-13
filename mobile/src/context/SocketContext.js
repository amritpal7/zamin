import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { io } from "socket.io-client";
import { useAuth } from "@clerk/clerk-expo";
import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";
import { socketConfig } from "../utils/net";

const BASE = Constants.expoConfig?.extra?.apiUrl
  || process.env.EXPO_PUBLIC_API_URL
  || "http://localhost/api";
// dev (behind nginx): ORIGIN=http://host, path=/api/socket.io. prod (direct API): path=/socket.io.
const { origin: ORIGIN, path: SOCKET_PATH } = socketConfig(BASE);

const SocketContext = createContext(null);
export const useSocket = () => useContext(SocketContext);

// One authenticated Socket.io connection for the whole app, tied to the Clerk
// session. Reconnects with a fresh token so short-lived Clerk tokens keep working.
export function SocketProvider({ children }) {
  const { isSignedIn, getToken } = useAuth();
  const [socket, setSocket] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!isSignedIn) return;

    const s = io(ORIGIN, {
      path: SOCKET_PATH,
      // `auth` as a function is invoked before EVERY (re)connect, so the handshake always
      // carries a fresh Clerk token — fixes the "JWT is expired" handshake rejections.
      auth: (cb) => { getToken().then((t) => cb({ token: t || "" })).catch(() => cb({ token: "" })); },
      // Polling FIRST, then upgrade to websocket. The browser's raw websocket to Railway's
      // proxy was failing ("websocket error") and blocking realtime on web; polling connects
      // reliably through the HTTP proxy and Socket.io transparently upgrades to ws when it can.
      transports: ["polling", "websocket"],
      reconnection: true,
    });
    // Surface WHY a socket won't connect — logged + sent to Sentry (origin/path/platform).
    s.on("connect_error", (err) => {
      console.warn("socket connect_error:", err?.message, "→", ORIGIN, SOCKET_PATH);
      try {
        Sentry.captureException(
          Object.assign(new Error(`socket connect_error: ${err?.message || "unknown"}`), {
            origin: ORIGIN, path: SOCKET_PATH, platform: Platform.OS,
          })
        );
      } catch {}
    });
    ref.current = s;
    setSocket(s);

    return () => {
      if (ref.current) { ref.current.disconnect(); ref.current = null; }
      setSocket(null);
    };
  }, [isSignedIn]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
