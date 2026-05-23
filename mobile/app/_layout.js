import React, { useEffect } from "react";
import { Platform } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import { C } from "../src/theme";

const tokenCache = {
  async getToken(key) { try { return await SecureStore.getItemAsync(key); } catch { return null; } },
  async saveToken(key, value) { try { await SecureStore.setItemAsync(key, value); } catch {} },
  async clearToken(key) { try { await SecureStore.deleteItemAsync(key); } catch {} },
};

// Guards: redirect signed-out users away from protected tabs
function AuthGuard() {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inProtected = segments[0] === "(tabs)";
    if (!isSignedIn && inProtected) router.replace("/sign-in");
    // If signed in and on auth screen, redirect to app
    if (isSignedIn && (segments[0] === "sign-in" || segments[0] === "sign-up")) {
      router.replace("/(tabs)/discover");
    }
  }, [isSignedIn, isLoaded, segments]);

  return null;
}

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env");
  }

  const clerkProps = Platform.OS === "web"
    ? { publishableKey }                    // web uses cookies/localStorage automatically
    : { publishableKey, tokenCache };       // native uses SecureStore

  return (
    <ClerkProvider {...clerkProps}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthGuard />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: "slide_from_right" }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="property/[id]" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="chat/[id]" />
        </Stack>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
