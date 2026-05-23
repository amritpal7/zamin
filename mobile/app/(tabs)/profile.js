import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { C, FONT } from "../../src/theme";
import Header from "../../src/components/Header";
import NeoBox from "../../src/components/NeoBox";
import { Avatar, Tag } from "../../src/components/ui";
import NeoButton from "../../src/components/NeoButton";

const MENU = [
  ["🏠", "My Listings"],
  ["💬", "Messages"],
  ["🔔", "Notifications"],
  ["🔒", "Privacy Settings"],
  ["❓", "Help & Support"],
];

export default function Profile() {
  const router = useRouter();
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();

  if (!isSignedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Header />
        <View style={{ alignItems: "center", paddingTop: 60 }}>
          <Text style={{ fontSize: 46, marginBottom: 16 }}>👤</Text>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", fontFamily: FONT, marginBottom: 16 }}>Sign in to view profile</Text>
          <NeoButton title="Sign In →" onPress={() => router.push("/sign-in")} />
        </View>
      </View>
    );
  }

  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase() || "ME";
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.emailAddresses?.[0]?.emailAddress || "User";

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 32 }}>
        {/* Profile card */}
        <NeoBox offset={6} fullWidth>
          <View style={{ padding: 22, alignItems: "center" }}>
            <Avatar initials={initials} size={66} />
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", marginTop: 12, fontFamily: FONT }}>{fullName}</Text>
            <Text style={{ color: C.muted, fontSize: 12, fontFamily: FONT, marginTop: 2 }}>{user?.primaryEmailAddress?.emailAddress}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Tag color={C.green} solid>✓ Verified</Tag>
              <Tag color={C.blue} solid>Buyer</Tag>
            </View>
          </View>
        </NeoBox>

        {/* Stats */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 18, marginBottom: 20 }}>
          {[
            { l: "Listed",    v: 0, c: C.amber },
            { l: "Saved",     v: 0, c: C.red   },
            { l: "Inquiries", v: 0, c: C.blue  },
          ].map(s => (
            <View key={s.l} style={{ flex: 1 }}>
              <NeoBox offset={3} shadowColor={s.c} radius={12} fullWidth>
                <View style={{ padding: 14, alignItems: "center" }}>
                  <Text style={{ fontSize: 24, fontWeight: "900", color: s.c, fontFamily: FONT }}>{s.v}</Text>
                  <Text style={{ color: C.muted, fontSize: 11, fontWeight: "600", marginTop: 2, fontFamily: FONT }}>{s.l}</Text>
                </View>
              </NeoBox>
            </View>
          ))}
        </View>

        {/* Menu items */}
        {MENU.map(([icon, label]) => (
          <View key={label} style={{ borderColor: C.ink, borderWidth: 2.5, borderRadius: 12, backgroundColor: C.card, paddingHorizontal: 15, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <Text style={{ fontSize: 18 }}>{icon}</Text>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: 14, flex: 1, fontFamily: FONT }}>{label}</Text>
            <Text style={{ color: C.amber, fontWeight: "800" }}>→</Text>
          </View>
        ))}

        {/* Sign out */}
        <Pressable onPress={async () => { await signOut(); router.replace("/sign-in"); }} style={{ marginTop: 8 }}>
          <NeoBox offset={5} bg={C.red} radius={12} fullWidth>
            <View style={{ paddingVertical: 14, alignItems: "center" }}>
              <Text style={{ color: C.ink, fontWeight: "800", fontSize: 14, fontFamily: FONT }}>Sign Out</Text>
            </View>
          </NeoBox>
        </Pressable>
      </ScrollView>
    </View>
  );
}
