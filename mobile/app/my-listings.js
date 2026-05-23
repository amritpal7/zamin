import React, { useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { C, FONT } from "../src/theme";
import NeoBox from "../src/components/NeoBox";
import NeoButton from "../src/components/NeoButton";
import { Tag } from "../src/components/ui";
import { useApi } from "../src/hooks/useApi";
import ConfirmModal from "../src/components/ConfirmModal";

function MyListingCard({ property: p, onEdit, onDelete }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <NeoBox offset={4} fullWidth>
        <View style={{ padding: 14 }}>
          {/* Top row */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
            <View style={{ width: 54, height: 54, backgroundColor: (p.color || C.amber) + "22", borderRadius: 10, borderWidth: 2, borderColor: C.ink, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 26 }}>{p.img || "🏠"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "800", fontSize: 14, fontFamily: FONT }} numberOfLines={1}>
                {p.title || "Untitled"}
              </Text>
              <Text style={{ color: C.muted, fontSize: 11, marginTop: 3, fontFamily: FONT }} numberOfLines={1}>
                📍 {p.location || "No location set"}
              </Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                <Tag color={p.status === "For Sale" ? C.green : C.blue} solid>{p.status}</Tag>
                <Tag color={C.amber}>{p.type}</Tag>
              </View>
            </View>
            <View style={{ alignItems: "flex-end", justifyContent: "flex-start" }}>
              <Text style={{ color: C.amber, fontWeight: "900", fontSize: 15, fontFamily: FONT }}>
                {p.price ? `₹${p.price}` : "—"}
              </Text>
              {p.area ? <Text style={{ color: C.muted, fontSize: 11, fontFamily: FONT, marginTop: 3 }}>{p.area}</Text> : null}
            </View>
          </View>

          {/* Amenities row */}
          {p.tags?.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
              {p.tags.slice(0, 4).map(t => (
                <View key={t} style={{ backgroundColor: C.amberDim, borderColor: C.amber + "55", borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: C.amber, fontSize: 10, fontWeight: "700", fontFamily: FONT }}>{t}</Text>
                </View>
              ))}
              {p.tags.length > 4 && (
                <Text style={{ color: C.muted, fontSize: 10, fontFamily: FONT, paddingVertical: 2 }}>+{p.tags.length - 4} more</Text>
              )}
            </View>
          )}

          {/* Action row */}
          <View style={{ flexDirection: "row", gap: 8, borderTopWidth: 2, borderTopColor: C.dim, paddingTop: 10 }}>
            <Pressable
              onPress={onEdit}
              style={{ flex: 1, backgroundColor: C.card, borderColor: C.ink, borderWidth: 2, borderRadius: 8, paddingVertical: 9, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
            >
              <Text style={{ fontSize: 13 }}>✏️</Text>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 12, fontFamily: FONT }}>Edit</Text>
            </Pressable>
            <Pressable
              onPress={onDelete}
              style={{ flex: 1, backgroundColor: "#ff475715", borderColor: C.red, borderWidth: 2, borderRadius: 8, paddingVertical: 9, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
            >
              <Text style={{ fontSize: 13 }}>🗑️</Text>
              <Text style={{ color: C.red, fontWeight: "700", fontSize: 12, fontFamily: FONT }}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </NeoBox>
    </View>
  );
}

export default function MyListings() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn) return;
      setLoading(true);
      apiRef.current.getMyProperties()
        .then(setListings)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [isSignedIn])
  );

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await apiRef.current.deleteProperty(deleteTarget.id);
      setListings(prev => prev.filter(x => x.id !== deleteTarget.id));
    } catch (e) {
      Alert.alert("Error", e.message || "Delete failed");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ paddingTop: 54, paddingBottom: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", borderBottomWidth: 2, borderBottomColor: C.dim }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 14, padding: 4 }}>
          <Text style={{ color: C.amber, fontSize: 22, fontWeight: "800" }}>←</Text>
        </Pressable>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", fontFamily: FONT, flex: 1 }}>My Listings</Text>
        <Pressable
          onPress={() => router.push("/(tabs)/post")}
          style={{ backgroundColor: C.amber, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 2, borderColor: C.ink }}
        >
          <Text style={{ color: C.ink, fontWeight: "800", fontSize: 13, fontFamily: FONT }}>+ New</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 48 }}>
        {loading && <ActivityIndicator color={C.amber} style={{ marginTop: 48 }} />}

        {!loading && listings.length === 0 && (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Text style={{ fontSize: 52, marginBottom: 16 }}>🏠</Text>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", fontFamily: FONT, marginBottom: 8 }}>No listings yet</Text>
            <Text style={{ color: C.muted, fontSize: 13, fontFamily: FONT, textAlign: "center", marginBottom: 28, lineHeight: 22 }}>
              Post your first property for free.{"\n"}No brokerage · Direct buyer connect.
            </Text>
            <NeoButton title="Post a Property →" onPress={() => router.push("/(tabs)/post")} />
          </View>
        )}

        {listings.map(p => (
          <MyListingCard
            key={p.id}
            property={p}
            onEdit={() => router.push({ pathname: "/(tabs)/post", params: { editId: p.id } })}
            onDelete={() => setDeleteTarget(p)}
          />
        ))}
      </ScrollView>

      <ConfirmModal
        visible={!!deleteTarget}
        title="Delete Listing"
        message={`Are you sure you want to delete "${deleteTarget?.title || "this property"}"?\n\nThis action cannot be undone.`}
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        confirmColor={C.red}
        onConfirm={handleConfirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </View>
  );
}
