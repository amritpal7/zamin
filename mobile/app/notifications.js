// mobile/app/notifications.js — real notifications feed (new messages + saved-search matches).

import React, { useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { C, FONT, FONT_MED, FONT_HEAD, FONT_HEAD_ITALIC } from "../src/theme";
import { useTheme } from "../src/context/ThemeContext";
import { Icon } from "../src/components/Icon";
import { useApi } from "../src/hooks/useApi";
import { useSocket } from "../src/context/SocketContext";
import { timeAgo } from "../src/utils/time";

export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;               // useApi() isn't referentially stable — pin it
  const socket = useSocket();
  useTheme();

  const [items, setItems]     = useState([]);
  const [unread, setUnread]   = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!isSignedIn) { setLoading(false); return; }
    return apiRef.current.getNotifications()
      .then((d) => { setItems(d.notifications || []); setUnread(d.unread || 0); })
      .catch(() => setItems([]));
  }, [isSignedIn]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.resolve(load()).finally(() => {
        setLoading(false);
        // Opening the screen marks everything read.
        apiRef.current.markNotificationsRead().then(() => setUnread(0)).catch(() => {});
      });
    }, [load])
  );

  // Live refresh when a new message arrives.
  useFocusEffect(
    useCallback(() => {
      if (!socket) return;
      const refresh = () => load();
      socket.on("message", refresh);
      return () => socket.off("message", refresh);
    }, [socket, load])
  );

  const open = (n) => {
    const d = n.data || {};
    if (d.kind === "visit") router.push("/visits");
    else if (d.kind === "listing" && d.propertyId) router.push(`/property/${d.propertyId}`);
    else if (d.propertyId) router.push(`/chat/${d.propertyId}${d.peer ? `?peer=${d.peer}` : ""}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Top nav */}
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/discover"); }}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="back" size={18} color={C.fg} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", fontFamily: FONT_MED, fontSize: 14, color: C.fg }}>Notifications</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 20 }}>
          <Text style={{ color: C.fgDim, fontFamily: FONT, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>What's new</Text>
          <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 38, lineHeight: 40, letterSpacing: -1 }}>
            Activity,{" "}
            <Text style={{ color: C.fgDim, fontFamily: FONT_HEAD_ITALIC, fontStyle: "italic" }}>fresh.</Text>
          </Text>
        </View>

        {loading ? (
          <View style={{ paddingTop: 60, alignItems: "center" }}><ActivityIndicator color={C.amber} /></View>
        ) : items.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 60, gap: 8 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.chipBg, alignItems: "center", justifyContent: "center" }}>
              <Icon name="bell" size={20} color={C.fgDim} strokeWidth={1.4} />
            </View>
            <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT, marginTop: 4 }}>You're all caught up.</Text>
          </View>
        ) : (
          items.map((n, i) => {
            const isMatch = n.type === "listing_match";
            const wasUnread = !n.read_at;
            return (
              <Pressable
                key={n.id}
                onPress={() => open(n)}
                style={({ pressed }) => ({
                  flexDirection: "row", alignItems: "flex-start", gap: 14,
                  paddingHorizontal: 22, paddingVertical: 16,
                  borderBottomWidth: i < items.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: C.line,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: wasUnread ? C.amberDim : C.chipBg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name={isMatch ? "home" : "send"} size={18} color={wasUnread ? C.amber : C.fg} strokeWidth={1.6} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3, gap: 8 }}>
                    <Text style={{ color: C.fg, fontFamily: wasUnread ? FONT_MED : FONT, fontSize: 13, flex: 1 }} numberOfLines={1}>{n.title}</Text>
                    <Text style={{ color: C.fgDim, fontSize: 10, fontFamily: FONT }}>{timeAgo(n.created_at)}</Text>
                  </View>
                  <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT, lineHeight: 18 }} numberOfLines={1}>{n.body}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
