import React, { useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { C, FONT } from "../../src/theme";
import Header from "../../src/components/Header";
import NeoBox from "../../src/components/NeoBox";
import NeoButton from "../../src/components/NeoButton";
import { Avatar, Tag } from "../../src/components/ui";
import { useApi } from "../../src/hooks/useApi";

const MENU = [
  { icon: "🏠", label: "My Listings",     route: "/my-listings" },
  { icon: "💬", label: "Messages",         route: null },
  { icon: "🔔", label: "Notifications",    route: null },
  { icon: "🔒", label: "Privacy Settings", route: null },
  { icon: "❓", label: "Help & Support",   route: null },
];

export default function Profile() {
  const router = useRouter();
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;

  const [listedCount, setListedCount]   = useState(0);
  const [savedCount, setSavedCount]     = useState(0);
  const [statsLoading, setStatsLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn) return;
      setStatsLoading(true);
      Promise.all([
        apiRef.current.getMyProperties(),
        apiRef.current.getSaved(),
      ]).then(([mine, saved]) => {
        setListedCount(mine.length);
        setSavedCount(saved.length);
      }).catch(() => {}).finally(() => setStatsLoading(false));
    }, [isSignedIn])
  );

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
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ")
    || user?.emailAddresses?.[0]?.emailAddress || "User";

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>

        {/* Profile card */}
        <NeoBox offset={6} fullWidth>
          <View style={{ padding: 22, alignItems: "center" }}>
            <Avatar initials={initials} size={66} />
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", marginTop: 12, fontFamily: FONT }}>{fullName}</Text>
            <Text style={{ color: C.muted, fontSize: 12, fontFamily: FONT, marginTop: 2 }}>{user?.primaryEmailAddress?.emailAddress}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Tag color={C.green} solid>✓ Verified</Tag>
              <Tag color={C.blue} solid>Member</Tag>
            </View>
          </View>
        </NeoBox>

        {/* Stats */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 18, marginBottom: 24 }}>
          {[
            { label: "Listed",    value: statsLoading ? "…" : listedCount, color: C.amber },
            { label: "Saved",     value: statsLoading ? "…" : savedCount,  color: C.red   },
            { label: "Inquiries", value: 0,                                 color: C.blue  },
          ].map(s => (
            <View key={s.label} style={{ flex: 1 }}>
              <NeoBox offset={3} shadowColor={s.color} radius={12} fullWidth>
                <View style={{ padding: 14, alignItems: "center" }}>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: s.color, fontFamily: FONT }}>{s.value}</Text>
                  <Text style={{ color: C.muted, fontSize: 11, fontWeight: "600", marginTop: 2, fontFamily: FONT }}>{s.label}</Text>
                </View>
              </NeoBox>
            </View>
          ))}
        </View>

        {/* Menu */}
        {MENU.map(({ icon, label, route }) => (
          <Pressable
            key={label}
            onPress={() => route && router.push(route)}
            style={{ borderColor: C.ink, borderWidth: 2.5, borderRadius: 12, backgroundColor: C.card, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8, opacity: route ? 1 : 0.55 }}
          >
            <Text style={{ fontSize: 18 }}>{icon}</Text>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: 14, flex: 1, fontFamily: FONT }}>{label}</Text>
            <Text style={{ color: C.amber, fontWeight: "800", fontSize: 16 }}>→</Text>
          </Pressable>
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
