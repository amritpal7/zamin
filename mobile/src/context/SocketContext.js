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
    let cancelled = false;
    if (!isSignedIn) return;

    (async () => {
      const token = await getToken();
      if (cancelled || !token) return;
      const s = io(ORIGIN, {
        path: SOCKET_PATH,
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
      });
      // Refresh the auth token on each (re)connect attempt so it never goes stale.
      s.io.on("reconnect_attempt", () => { getToken().then((t) => { if (t) s.auth = { token: t }; }); });
      // Surface WHY a socket won't connect (esp. the web client's realtime gap): the error
      // message tells us transport vs auth vs CORS vs path. Logged + sent to Sentry.
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
    })();

    return () => {
      cancelled = true;
      if (ref.current) { ref.current.disconnect(); ref.current = null; }
      setSocket(null);
    };
  }, [isSignedIn]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
