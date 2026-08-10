import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "@clerk/clerk-expo";
import Constants from "expo-constants";

const BASE = Constants.expoConfig?.extra?.apiUrl
  || process.env.EXPO_PUBLIC_API_URL
  || "http://localhost/api";
const ORIGIN = BASE.replace(/\/api\/?$/, "");   // e.g. http://192.168.x.x
const SOCKET_PATH = "/api/socket.io";           // nginx strips /api → server sees /socket.io

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
