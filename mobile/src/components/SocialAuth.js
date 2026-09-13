import React, { useCallback } from "react";
import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useSSO } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { C, FONT, FONT_MED } from "../theme";

// Finish any pending web-auth session on mount (required for the browser handoff on Android/web).
WebBrowser.maybeCompleteAuthSession();

// "Continue with Google / Apple" via Clerk SSO. Providers must be enabled in the Clerk
// dashboard (Google works with Clerk's shared creds in dev; Apple needs Apple Developer creds).
// Apple is hidden on Android (Apple sign-in isn't offered there).
export default function SocialAuth({ onError }) {
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const go = useCallback(async (strategy) => {
    onError?.("");
    try {
      const redirectUrl = AuthSession.makeRedirectUri();
      const { createdSessionId, setActive } = await startSSOFlow({ strategy, redirectUrl });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(tabs)/discover");
      } else {
        // Missing requirements / MFA — uncommon for this setup. Nudge the user.
        onError?.("Extra steps are needed to finish sign in. Try username & password.");
      }
    } catch (e) {
      onError?.(e?.errors?.[0]?.message || "Couldn't sign in with that provider. It may not be enabled yet.");
    }
  }, [startSSOFlow, router, onError]);

  return (
    <View style={{ marginTop: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 16 }}>
        <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.glassBorder }} />
        <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT }}>or continue with</Text>
        <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.glassBorder }} />
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable onPress={() => go("oauth_google")} style={btn}>
          <Text style={{ color: "#EA4335", fontFamily: FONT_MED, fontSize: 15, fontWeight: "900" }}>G</Text>
          <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 14 }}>Google</Text>
        </Pressable>
        {Platform.OS !== "android" && (
          <Pressable onPress={() => go("oauth_apple")} style={btn}>
            <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 16, fontWeight: "900" }}></Text>
            <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 14 }}>Apple</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const btn = {
  flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  paddingVertical: 13, borderRadius: 14,
  backgroundColor: C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder,
};
