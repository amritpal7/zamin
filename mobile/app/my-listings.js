// mobile/app/my-listings.js — refactored to design language.
// Editorial header, SVG icons throughout, no emoji.

import { useTheme } from "../src/context/ThemeContext";
import React, { useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { C, FONT, FONT_MED, FONT_HEAD, FONT_HEAD_ITALIC } from "../src/theme";
import { Icon } from "../src/components/Icon";
import { Tag } from "../src/components/ui";
import { useApi } from "../src/hooks/useApi";
import ConfirmModal from "../src/components/ConfirmModal";

function MyListingCard({ property: p, onEdit, onDelete }) {
  const ambient = p.color || C.amber;
  return (
    <View style={{
      backgroundColor: C.glassBg,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.glassBorder,
      marginBottom: 14,
      overflow: "hidden",
    }}>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", gap: 14, marginBottom: 14 }}>
          {/* Tinted hero square */}
          <View style={{
            width: 64, height: 64, borderRadius: 16,
            backgroundColor: ambient + "33",
            alignItems: "center", justifyContent: "center",
            overflow: "hidden",
          }}>
            <LinearGradient
              colors={[ambient + "55", ambient + "11"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={{ fontSize: 28 }}>{p.img || "🏠"}</Text>
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 18, letterSpacing: -0.3, lineHeight: 22 }} numberOfLines={1}>
              {p.title || "Untitled"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Icon name="pin" size={11} color={C.fgDim} />
              <Text style={{ color: C.fgDim, fontSize: 11, fontFamily: FONT }} numberOfLines={1}>
                {p.location || "No location set"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
              <Tag color={p.status === "For Sale" ? C.green : C.blue} solid>{p.status}</Tag>
              <Tag color={C.amber}>{p.type}</Tag>
            </View>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 15 }}>
              {p.price ? `₹${p.price}` : "—"}
            </Text>
            {p.area ? <Text style={{ color: C.fgDim, fontSize: 11, fontFamily: FONT, marginTop: 4 }}>{p.area}</Text> : null}
          </View>
        </View>

        {p.tags?.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {p.tags.slice(0, 4).map(t => (
              <View key={t} style={{ backgroundColor: C.chipBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder }}>
                <Text style={{ color: C.fg, fontSize: 10, fontFamily: FONT }}>{t}</Text>
              </View>
            ))}
            {p.tags.length > 4 && (
              <Text style={{ color: C.fgDim, fontSize: 10, fontFamily: FONT, paddingVertical: 4 }}>+{p.tags.length - 4} more</Text>
            )}
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, paddingTop: 12 }}>
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => ({
              flex: 1, backgroundColor: C.chipBg, borderRadius: 999, paddingVertical: 10,
              alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6,
              opacity: pressed ? 0.85 : 1,
              borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder,
            })}
          >
            <Icon name="settings" size={14} color={C.fg} />
            <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 12 }}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={onDelete}
            style={({ pressed }) => ({
              flex: 1, backgroundColor: C.red + "1A", borderRadius: 999, paddingVertical: 10,
              alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6,
              opacity: pressed ? 0.85 : 1,
              borderWidth: StyleSheet.hairlineWidth, borderColor: C.red + "40",
            })}
          >
            <Icon name="close" size={14} color={C.red} />
            <Text style={{ color: C.red, fontFamily: FONT_MED, fontSize: 12 }}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function MyListings() {
  useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const api    = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;

  const [listings,     setListings]     = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

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
      {/* Top nav */}
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon name="back" size={18} color={C.fg} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", fontFamily: FONT_MED, fontSize: 14, color: C.fg }}>My listings</Text>
        <Pressable
          onPress={() => router.navigate("/(tabs)/post")}
          style={({ pressed }) => ({
            paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
            backgroundColor: C.amber,
            flexDirection: "row", alignItems: "center", gap: 6,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Icon name="plus" size={14} color={C.ink} strokeWidth={2} />
          <Text style={{ color: C.ink, fontFamily: FONT_MED, fontSize: 12 }}>New</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 48 }}>
        {/* Editorial headline */}
        <View style={{ paddingHorizontal: 4, paddingTop: 18, paddingBottom: 20 }}>
          <Text style={{ color: C.fgDim, fontFamily: FONT, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
            Your properties
          </Text>
          <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 38, lineHeight: 40, letterSpacing: -1 }}>
            What you've{" "}
            <Text style={{ color: C.fgDim, fontFamily: FONT_HEAD_ITALIC, fontStyle: "italic" }}>posted.</Text>
          </Text>
        </View>

        {loading && <ActivityIndicator color={C.amber} style={{ marginTop: 48 }} />}

        {!loading && listings.length === 0 && (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: C.chipBg, alignItems: "center", justifyContent: "center",
              borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder,
              marginBottom: 18,
            }}>
              <Icon name="home" size={24} color={C.fgDim} strokeWidth={1.4} />
            </View>
            <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 22, letterSpacing: -0.4, marginBottom: 8 }}>No listings yet.</Text>
            <Text style={{ color: C.fgDim, fontSize: 13, fontFamily: FONT, textAlign: "center", marginBottom: 24, lineHeight: 20, paddingHorizontal: 24 }}>
              Post your first property — free, no brokerage, direct buyer connect.
            </Text>
            <Pressable
              onPress={() => router.navigate("/(tabs)/post")}
              style={({ pressed }) => ({
                flexDirection: "row", alignItems: "center", gap: 10,
                paddingLeft: 6, paddingRight: 18, paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: C.glassBg,
                borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <LinearGradient
                colors={[C.amber + "ee", "#B86A26"]}
                start={{ x: 0.2, y: 0.2 }} end={{ x: 1, y: 1 }}
                style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }}
              >
                <Icon name="plus" size={16} color={C.ink} strokeWidth={2} />
              </LinearGradient>
              <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 14 }}>Post a property</Text>
            </Pressable>
          </View>
        )}

        {listings.map(p => (
          <MyListingCard
            key={p.id}
            property={p}
            onEdit={() => router.push(`/property/edit/${p.id}`)}
            onDelete={() => setDeleteTarget(p)}
          />
        ))}
      </ScrollView>

      <ConfirmModal
        visible={!!deleteTarget}
        title="Delete listing"
        message={`Are you sure you want to delete "${deleteTarget?.title || "this property"}"?\n\nThis action cannot be undone.`}
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        confirmColor={C.red}
        onConfirm={handleConfirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </View>
  );
}
