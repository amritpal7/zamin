import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { C, FONT } from "../theme";
import { Avatar } from "./ui";
import NeoButton from "./NeoButton";

export default function Header() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  const initials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "ME"
    : "?";

  return (
    <View style={{
      paddingTop: insets.top + 10, paddingBottom: 14, paddingHorizontal: 18,
      backgroundColor: C.amber, borderBottomWidth: 3, borderBottomColor: C.ink,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    }}>
      <Text style={{ fontSize: 23, fontWeight: "900", color: C.ink, fontFamily: FONT, letterSpacing: -0.5 }}>Zamin.</Text>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Pressable style={{ backgroundColor: C.ink, borderRadius: 10, width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 14 }}>🔔</Text>
        </Pressable>
        {isSignedIn
          ? <Pressable onPress={() => router.push("/(tabs)/profile")}><Avatar initials={initials} size={36} /></Pressable>
          : <NeoButton title="Sign In" small offset={3} fill={C.ink} fg={C.amber} onPress={() => router.push("/sign-in")} />
        }
      </View>
    </View>
  );
}
