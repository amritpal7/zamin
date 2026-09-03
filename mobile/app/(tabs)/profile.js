import { useTheme } from "../../src/context/ThemeContext";
import React, { useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, FONT, FONT_MED, FONT_HEAD } from "../../src/theme";
import { Icon } from "../../src/components/Icon";
import NeoButton from "../../src/components/NeoButton";
import { useApi } from "../../src/hooks/useApi";

const MENU = [
  { icon: "home",     label: "My Listings",   sub: "Properties you've posted",  route: "/my-listings" },
  { icon: "bell",     label: "Messages",       sub: "Chats with owners",         route: "/messages"    },
  { icon: "bell",     label: "Notifications",  sub: "Alerts & updates",          route: "/notifications"},
  { icon: "search",   label: "Saved searches", sub: "Alerts on new matches",     route: "/saved-searches"},
  { icon: "clock",    label: "Visits",         sub: "Viewings you've scheduled",  route: "/visits"       },
  { icon: "settings", label: "Settings",       sub: "Profile, security, theme",  route: "/settings"    },
  { icon: "globe",    label: "Help & Support", sub: "FAQ and contact",           route: null            },
];

function GlassRow({ icon, label, sub, route, onPress, danger }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, opacity: route === null ? 0.5 : 1 }}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: danger ? C.red + "20" : C.chipBg,
        alignItems: "center", justifyContent: "center",
      }}>
        <Icon name={icon} size={17} color={danger ? C.red : C.fg} strokeWidth={1.5} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: FONT_MED, fontSize: 14, color: danger ? C.red : C.fg }}>{label}</Text>
        {sub && <Text style={{ fontSize: 11, color: C.fgDim, fontFamily: FONT, marginTop: 1 }}>{sub}</Text>}
      </View>
      <Icon name="chevR" size={16} color={C.fgDim} strokeWidth={1.4} />
    </Pressable>
  );
}

function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 66 }} />;
}

export default function Profile() {
  useTheme();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const api     = useApi();
  const apiRef  = useRef(api);
  apiRef.current = api;

  const [listedCount,    setListedCount]    = useState(0);
  const [savedCount,     setSavedCount]     = useState(0);
  const [inquiriesCount, setInquiriesCount] = useState(0);
  const [statsLoading,   setStatsLoading]   = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn) return;
      setStatsLoading(true);
      Promise.all([apiRef.current.getMyProperties(), apiRef.current.getSaved(), apiRef.current.getConversations()])
        .then(([mine, saved, convos]) => {
          setListedCount(mine.length);
          setSavedCount(saved.length);
          // Inquiries = conversations on listings I own.
          setInquiriesCount(convos.filter(c => c.owner_id === user?.id).length);
        })
        .catch(() => {})
        .finally(() => setStatsLoading(false));
    }, [isSignedIn, user?.id])
  );

  if (!isSignedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 22, paddingBottom: 24 }}>
          <Text style={{ fontFamily: FONT, fontSize: 14, color: C.fgDim, marginBottom: 4 }}>Your account</Text>
          <Text style={{ fontFamily: FONT_HEAD, fontSize: 38, color: C.fg, fontWeight: "400", letterSpacing: -1, lineHeight: 40 }}>
            Your trail.
          </Text>
        </View>
        <View style={{ alignItems: "center", paddingTop: 40, paddingHorizontal: 40 }}>
          <LinearGradient
            colors={[C.amber + "cc", "#B86A26"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{
              width: 84, height: 84, borderRadius: 42,
              alignItems: "center", justifyContent: "center",
              marginBottom: 20,
              shadowColor: C.amber, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 24,
            }}
          >
            <Text style={{ fontFamily: FONT_HEAD, fontSize: 38, color: "#1A0A00" }}>Z</Text>
          </LinearGradient>
          <Text style={{ fontFamily: FONT_HEAD, fontSize: 28, color: C.fg, fontWeight: "400", letterSpacing: -0.5, marginBottom: 8, textAlign: "center" }}>
            Sign in to Zamin
          </Text>
          <Text style={{ color: C.fgDim, fontSize: 14, fontFamily: FONT, marginBottom: 28, textAlign: "center", lineHeight: 22 }}>
            Post listings, save properties, and chat with owners.
          </Text>
          <NeoButton title="Sign In →" full fill={C.amber} fg={C.ink} onPress={() => router.push("/sign-in")} />
        </View>
      </View>
    );
  }

  // Prefer Clerk's native username; fall back to older accounts that stored it in metadata.
  const username   = user?.username ?? user?.unsafeMetadata?.username ?? null;
  const initials   = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase()
                     || username?.[0]?.toUpperCase() || "ME";
  const fullName   = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || username || "User";
  const isVerified = user?.primaryEmailAddress?.verification?.status === "verified";

  const stats = [
    { v: statsLoading ? "…" : listedCount, l: "Listed"    },
    { v: statsLoading ? "…" : savedCount,  l: "Saved"     },
    { v: statsLoading ? "…" : inquiriesCount, l: "Inquiries" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>

        {/* ── Header ── */}
        <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 22, paddingBottom: 0 }}>
          <Text style={{ fontFamily: FONT, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", color: C.fgDim, marginBottom: 8 }}>
            Your trail
          </Text>
        </View>

        {/* ── Avatar + name row ── */}
        <View style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 28, flexDirection: "row", alignItems: "center", gap: 18 }}>
          <Pressable onPress={() => router.push("/settings")}>
            {user?.hasImage ? (
              <Image
                source={{ uri: user.imageUrl }}
                style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.chipBg }}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={[C.amber + "cc", "#B86A26"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{
                  width: 80, height: 80, borderRadius: 40,
                  alignItems: "center", justifyContent: "center",
                  shadowColor: C.amber, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 8,
                }}
              >
                <Text style={{ fontFamily: FONT_HEAD, fontSize: 34, color: "#1A0A00" }}>{initials}</Text>
              </LinearGradient>
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONT_HEAD, fontSize: 30, lineHeight: 32, letterSpacing: -0.6, fontWeight: "400", color: C.fg }}>
              {fullName}
            </Text>
            {username
              ? <Text style={{ marginTop: 3, fontFamily: FONT, fontSize: 12, color: C.amberText }}>@{username}</Text>
              : <Text style={{ marginTop: 3, fontFamily: FONT, fontSize: 12, color: C.fgDim }}>
                  {user?.primaryEmailAddress?.emailAddress || ""}
                </Text>
            }
            {isVerified
              ? <View style={{ marginTop: 6, backgroundColor: C.green + "20", borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" }}>
                  <Text style={{ color: C.green, fontSize: 11, fontWeight: "600", fontFamily: FONT }}>✓ Verified</Text>
                </View>
              : <Pressable onPress={() => router.push("/settings")} style={{ marginTop: 6, backgroundColor: C.amber + "18", borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" }}>
                  <Text style={{ color: C.amberText, fontSize: 11, fontWeight: "600", fontFamily: FONT }}>Verify email →</Text>
                </Pressable>
            }
          </View>
        </View>

        {/* ── Stats grid ── */}
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 18, marginBottom: 28 }}>
          {stats.map(s => (
            <View key={s.l} style={{
              flex: 1,
              backgroundColor: C.glassBg,
              borderRadius: 20,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: C.glassBorder,
              padding: 14,
              alignItems: "center",
            }}>
              <Text style={{ fontFamily: FONT_HEAD, fontSize: 26, letterSpacing: -0.4, color: C.fg }}>{s.v}</Text>
              <Text style={{ marginTop: 2, fontFamily: FONT, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", color: C.fgDim }}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* ── Menu card ── */}
        <View style={{ paddingHorizontal: 18, marginBottom: 12 }}>
          <View style={{
            backgroundColor: C.glassBg,
            borderRadius: 22,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: C.glassBorder,
            overflow: "hidden",
          }}>
            {MENU.map((item, i) => (
              <React.Fragment key={item.label}>
                <GlassRow
                  {...item}
                  onPress={() => item.route && router.push(item.route)}
                />
                {i < MENU.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* ── Sign out ── */}
        <View style={{ paddingHorizontal: 18 }}>
          <View style={{
            backgroundColor: C.glassBg,
            borderRadius: 22,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: C.red + "40",
            overflow: "hidden",
          }}>
            <GlassRow
              icon="forward"
              label="Sign Out"
              sub={null}
              route="/sign-out"
              danger
              onPress={async () => { await signOut(); router.replace("/sign-in"); }}
            />
          </View>
        </View>

        <View style={{ paddingTop: 32, alignItems: "center" }}>
          <Text style={{ fontFamily: FONT, fontSize: 11, color: C.fgFaint }}>Zamin · India Property Marketplace</Text>
        </View>

      </ScrollView>
    </View>
  );
}
