import React, { useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { C, FONT } from "../../src/theme";
import Header from "../../src/components/Header";
import NeoBox from "../../src/components/NeoBox";
import NeoButton from "../../src/components/NeoButton";
import { Avatar, Tag } from "../../src/components/ui";
import { useApi } from "../../src/hooks/useApi";

function MyListingCard({ property: p, onEdit, onDelete }) {
  return (
    <NeoBox offset={4} fullWidth>
      <View style={{ padding: 14 }}>
        {/* Top row */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
          <View style={{ width: 52, height: 52, backgroundColor: (p.color || C.amber) + "22", borderRadius: 10, borderWidth: 2, borderColor: C.ink, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 26 }}>{p.img || "🏠"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "800", fontSize: 14, fontFamily: FONT }} numberOfLines={1}>{p.title || "Untitled"}</Text>
            <Text style={{ color: C.muted, fontSize: 11, marginTop: 3, fontFamily: FONT }} numberOfLines={1}>📍 {p.location || "No location"}</Text>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 5 }}>
              <Tag color={p.status === "For Sale" ? C.green : C.blue} solid>{p.status}</Tag>
              <Tag color={C.amber}>{p.type}</Tag>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: C.amber, fontWeight: "900", fontSize: 15, fontFamily: FONT }}>{p.price}</Text>
          </View>
        </View>

        {/* Action row */}
        <View style={{ flexDirection: "row", gap: 8, borderTopWidth: 2, borderTopColor: C.dim, paddingTop: 10 }}>
          <Pressable onPress={onEdit}
            style={{ flex: 1, backgroundColor: C.card, borderColor: C.ink, borderWidth: 2, borderRadius: 8, paddingVertical: 7, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5 }}>
            <Text style={{ fontSize: 13 }}>✏️</Text>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: 12, fontFamily: FONT }}>Edit</Text>
          </Pressable>
          <Pressable onPress={onDelete}
            style={{ flex: 1, backgroundColor: C.red + "22", borderColor: C.red, borderWidth: 2, borderRadius: 8, paddingVertical: 7, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5 }}>
            <Text style={{ fontSize: 13 }}>🗑️</Text>
            <Text style={{ color: C.red, fontWeight: "700", fontSize: 12, fontFamily: FONT }}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </NeoBox>
  );
}

export default function Profile() {
  const router = useRouter();
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;

  const [myListings, setMyListings] = useState([]);
  const [savedCount, setSavedCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn) return;
      setLoading(true);
      Promise.all([
        apiRef.current.getMyProperties(),
        apiRef.current.getSaved(),
      ]).then(([listings, saved]) => {
        setMyListings(listings);
        setSavedCount(saved.length);
      }).catch(() => {}).finally(() => setLoading(false));
    }, [isSignedIn])
  );

  const handleDelete = (p) => {
    Alert.alert(
      "Delete Listing",
      `Delete "${p.title || "this property"}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              await api.deleteProperty(p.id);
              setMyListings(prev => prev.filter(x => x.id !== p.id));
            } catch (e) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  };

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
        <View style={{ flexDirection: "row", gap: 10, marginTop: 18, marginBottom: 22 }}>
          {[
            { l: "Listed",    v: loading ? "…" : myListings.length, c: C.amber },
            { l: "Saved",     v: loading ? "…" : savedCount,        c: C.red   },
            { l: "Inquiries", v: 0,                                  c: C.blue  },
          ].map(s => (
            <View key={s.l} style={{ flex: 1 }}>
              <NeoBox offset={3} shadowColor={s.c} radius={12} fullWidth>
                <View style={{ padding: 14, alignItems: "center" }}>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: s.c, fontFamily: FONT }}>{s.v}</Text>
                  <Text style={{ color: C.muted, fontSize: 11, fontWeight: "600", marginTop: 2, fontFamily: FONT }}>{s.l}</Text>
                </View>
              </NeoBox>
            </View>
          ))}
        </View>

        {/* My Listings section */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: "800", fontFamily: FONT }}>My Listings</Text>
          <Pressable onPress={() => router.push("/(tabs)/post")}
            style={{ backgroundColor: C.amber, borderColor: C.ink, borderWidth: 2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 12 }}>＋</Text>
            <Text style={{ color: C.ink, fontWeight: "800", fontSize: 12, fontFamily: FONT }}>New</Text>
          </Pressable>
        </View>

        {loading && <ActivityIndicator color={C.amber} style={{ marginVertical: 20 }} />}

        {!loading && myListings.length === 0 && (
          <NeoBox offset={4} fullWidth>
            <View style={{ padding: 32, alignItems: "center" }}>
              <Text style={{ fontSize: 36, marginBottom: 10 }}>🏠</Text>
              <Text style={{ color: C.muted, fontSize: 13, fontFamily: FONT, textAlign: "center" }}>No listings yet.</Text>
              <Text style={{ color: C.muted, fontSize: 12, fontFamily: FONT, textAlign: "center", marginTop: 4, marginBottom: 16 }}>Post your first property for free.</Text>
              <NeoButton title="Post a Property →" onPress={() => router.push("/(tabs)/post")} />
            </View>
          </NeoBox>
        )}

        {myListings.map(p => (
          <View key={p.id} style={{ marginBottom: 12 }}>
            <MyListingCard
              property={p}
              onEdit={() => router.push({ pathname: "/(tabs)/post", params: { editId: p.id } })}
              onDelete={() => handleDelete(p)}
            />
          </View>
        ))}

        {/* Other menu items */}
        <Text style={{ color: C.text, fontSize: 16, fontWeight: "800", fontFamily: FONT, marginTop: 8, marginBottom: 12 }}>Account</Text>
        {[["💬", "Messages"], ["🔔", "Notifications"], ["🔒", "Privacy Settings"], ["❓", "Help & Support"]].map(([icon, label]) => (
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
