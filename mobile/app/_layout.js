import React, { useEffect } from "react";
import { Platform, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from "@expo-google-fonts/instrument-serif";
import {
  Geist_400Regular,
  Geist_500Medium,
} from "@expo-google-fonts/geist";
import {
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
} from "@expo-google-fonts/geist-mono";
import { C } from "../src/theme";
import { ThemeProvider } from "../src/context/ThemeContext";
import { SocketProvider } from "../src/context/SocketContext";
import PushManager from "../src/components/PushManager";
import * as Sentry from "@sentry/react-native";

// Client error/crash monitoring. No-op without EXPO_PUBLIC_SENTRY_DSN (so local dev is quiet).
// Pairs with SocketContext's connect_error capture to surface the web realtime socket failures.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  try {
    Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0.1, enableAutoSessionTracking: true });
  } catch (e) { console.warn("Sentry init failed:", e?.message); }
}

SplashScreen.preventAutoHideAsync().catch(() => {});

const tokenCache = {
  async getToken(key) { try { return await SecureStore.getItemAsync(key); } catch { return null; } },
  async saveToken(key, value) { try { await SecureStore.setItemAsync(key, value); } catch {} },
  async clearToken(key) { try { await SecureStore.deleteItemAsync(key); } catch {} },
};

// Top-level route groups that require a signed-in user. Everything else is public:
// index, sign-in/up, forgot-password, and the public property VIEW at /property/[id].
// (These screens all make authed calls / show the user's own data, so a signed-out
// user reaching them via push deep-link, web URL, or an expired session must be sent
// to sign-in rather than landing on a broken/empty screen.)
const PROTECTED_SEGMENTS = new Set([
  "(tabs)", "chat", "messages", "my-listings", "settings",
  "visits", "notifications", "saved-searches",
]);

function AuthGuard() {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    // /property/[id] is a public listing view; /property/edit/[id] requires auth.
    const isProtected =
      PROTECTED_SEGMENTS.has(segments[0]) ||
      (segments[0] === "property" && segments[1] === "edit");
    if (!isSignedIn && isProtected) router.replace("/sign-in");
    if (isSignedIn && (segments[0] === "sign-in" || segments[0] === "sign-up")) {
      router.replace("/(tabs)/discover");
    }
  }, [isSignedIn, isLoaded, segments]);

  return null;
}

function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env");
  }

  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Geist_400Regular,
    Geist_500Medium,
    GeistMono_400Regular,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const clerkProps = Platform.OS === "web"
    ? { publishableKey }
    : { publishableKey, tokenCache };

  return (
    <ClerkProvider {...clerkProps}>
      <ThemeProvider>
        <SafeAreaProvider>
          <SocketProvider>
          <StatusBar style="light" />
          <AuthGuard />
          <PushManager />
          <Stack screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: C.bg },
            animation: "slide_from_right",
            animationDuration: 280,   // smoother push/pop (Android; iOS uses its native curve)
            gestureEnabled: true,     // swipe from the left edge to go back
          }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="sign-up" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="property/[id]" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="property/edit/[id]" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="chat/[id]" />
            <Stack.Screen name="my-listings" />
            <Stack.Screen name="messages" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="saved-searches" />
            <Stack.Screen name="settings" />
          </Stack>
          </SocketProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}

// Wrap with Sentry when enabled (captures render errors + navigation context); passthrough otherwise.
export default SENTRY_DSN ? Sentry.wrap(RootLayout) : RootLayout;
