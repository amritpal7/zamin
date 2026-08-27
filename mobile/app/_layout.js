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

SplashScreen.preventAutoHideAsync().catch(() => {});

const tokenCache = {
  async getToken(key) { try { return await SecureStore.getItemAsync(key); } catch { return null; } },
  async saveToken(key, value) { try { await SecureStore.setItemAsync(key, value); } catch {} },
  async clearToken(key) { try { await SecureStore.deleteItemAsync(key); } catch {} },
};

function AuthGuard() {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inProtected = segments[0] === "(tabs)";
    if (!isSignedIn && inProtected) router.replace("/sign-in");
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
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: "slide_from_right" }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="sign-up" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="property/[id]" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
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
