// mobile/app/saved-searches.js — manage saved searches (get alerts on new matches).

import React, { useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { C, FONT, FONT_MED, FONT_HEAD, FONT_HEAD_ITALIC } from "../src/theme";
import { useTheme } from "../src/context/ThemeContext";
import { Icon } from "../src/components/Icon";
import { useApi } from "../src/hooks/useApi";

function label(s) {
  const parts = [];
  if (s.type && s.type !== "All") parts.push(s.type);
  if (s.status && s.status !== "All") parts.push(s.status);
  if (s.search) parts.push(`"${s.search}"`);
  return parts.length ? parts.join(" · ") : "All listings";
}

export default function SavedSearches() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;
  useTheme();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!isSignedIn) { setLoading(false); return; }
    return apiRef.current.getSavedSearches().then(setRows).catch(() => setRows([]));
  }, [isSignedIn]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    Promise.resolve(load()).finally(() => setLoading(false));
  }, [load]));

  const remove = async (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    apiRef.current.deleteSavedSearch(id).catch(() => load());
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/discover"); }}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="back" size={18} color={C.fg} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", fontFamily: FONT_MED, fontSize: 14, color: C.fg }}>Saved searches</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 20 }}>
          <Text style={{ color: C.fgDim, fontFamily: FONT, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Alerts</Text>
          <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 34, lineHeight: 38, letterSpacing: -1 }}>
            Your{" "}
            <Text style={{ color: C.fgDim, fontFamily: FONT_HEAD_ITALIC, fontStyle: "italic" }}>searches.</Text>
          </Text>
        </View>

        {loading ? (
          <View style={{ paddingTop: 40, alignItems: "center" }}><ActivityIndicator color={C.amber} /></View>
        ) : rows.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 50, paddingHorizontal: 40, gap: 8 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.chipBg, alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
              <Icon name="bell" size={20} color={C.fgDim} strokeWidth={1.4} />
            </View>
            <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 18 }}>No saved searches yet.</Text>
            <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT, textAlign: "center", lineHeight: 18 }}>
              On Home, set your filters and tap “Save this search” to get alerted when new matching listings are posted.
            </Text>
          </View>
        ) : (
          rows.map((s, i) => (
            <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 22, paddingVertical: 16, borderBottomWidth: i < rows.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: C.line }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.chipBg, alignItems: "center", justifyContent: "center" }}>
                <Icon name="search" size={17} color={C.amberText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 14 }} numberOfLines={1}>{s.name || label(s)}</Text>
                {s.name ? <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT, marginTop: 2 }} numberOfLines={1}>{label(s)}</Text> : null}
              </View>
              <Pressable onPress={() => remove(s.id)} style={{ paddingHorizontal: 6, paddingVertical: 6 }}>
                <Icon name="close" size={16} color={C.red} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
