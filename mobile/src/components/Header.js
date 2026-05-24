import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { C, FONT, FONT_HEAD } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { Avatar } from "./ui";
import NeoButton from "./NeoButton";

export default function Header() {
  useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  const initials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "ME"
    : "?";

  return (
    <View style={{
      paddingTop: insets.top + 12,
      paddingBottom: 14,
      paddingHorizontal: 20,
      backgroundColor: C.bg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    }}>
      {/* Wordmark pill */}
      <View style={{
        backgroundColor: C.amber,
        borderRadius: 100,
        paddingHorizontal: 16,
        paddingVertical: 7,
        shadowColor: C.amber,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 6,
      }}>
        <Text style={{ fontSize: 17, fontWeight: "400", color: C.ink, fontFamily: FONT_HEAD, letterSpacing: -0.3 }}>Zamin.</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <Pressable
          onPress={() => router.push("/notifications")}
          style={{
            backgroundColor: C.glassBg,
            borderRadius: 100, width: 38, height: 38,
            alignItems: "center", justifyContent: "center",
            borderWidth: 1, borderColor: C.glassBorder,
          }}
        >
          <Text style={{ fontSize: 15 }}>🔔</Text>
        </Pressable>

        {isSignedIn ? (
          <Pressable onPress={() => router.push("/(tabs)/profile")}>
            <Avatar initials={initials} size={38} />
          </Pressable>
        ) : (
          <NeoButton title="Sign In" small fill={C.amber} fg={C.ink} onPress={() => router.push("/sign-in")} />
        )}
      </View>
    </View>
  );
}
