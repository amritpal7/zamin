import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useApi } from "../hooks/useApi";

// Which chat is currently open, so we don't buzz the user for a message they're
// already reading. The chat screen sets/clears this on focus/unmount.
let activePropertyId = null;
export function setActiveChat(propertyId) { activePropertyId = propertyId ? String(propertyId) : null; }

// Foreground behavior: show a banner unless the matching chat is already open.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request?.content?.data || {};
    const suppress = activePropertyId && String(data.propertyId) === activePropertyId;
    return { shouldShowAlert: !suppress, shouldPlaySound: !suppress, shouldSetBadge: false };
  },
});

// Null-rendering manager: registers the device's Expo push token and routes taps
// to the right chat. Silently no-ops in Expo Go / web (remote push needs a dev build).
export default function PushManager() {
  const { isSignedIn } = useAuth();
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;
  const router = useRouter();

  // Register this device's push token with the backend on sign-in.
  useEffect(() => {
    if (!isSignedIn || Platform.OS === "web") return;
    let cancelled = false;
    (async () => {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Messages",
            importance: Notifications.AndroidImportance.HIGH,
          });
        }
        const perm = await Notifications.getPermissionsAsync();
        const status = perm.granted ? "granted" : (await Notifications.requestPermissionsAsync()).status;
        if (status !== "granted") return;
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
        const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
        if (!cancelled && token) await apiRef.current.registerPush(token);
      } catch {
        // Expo Go (SDK 53+) / no EAS projectId → push needs a development build. No-op.
      }
    })();
    return () => { cancelled = true; };
  }, [isSignedIn]);

  // Tapping a notification opens the conversation it belongs to.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification?.request?.content?.data || {};
      if (data.kind === "listing" && data.propertyId) {
        router.push(`/property/${data.propertyId}`);
      } else if (data.propertyId) {
        router.push(`/chat/${data.propertyId}${data.peer ? `?peer=${data.peer}` : ""}`);
      }
    });
    return () => sub.remove();
  }, [router]);

  return null;
}
