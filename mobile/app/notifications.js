// mobile/app/notifications.js — real activity derived from conversations.
// Shows inbound messages (someone messaged you about a listing). Read state is
// tracked locally for the session until a full notifications backend exists.

import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { C, FONT, FONT_MED, FONT_HEAD, FONT_HEAD_ITALIC } from "../src/theme";
import { useTheme } from "../src/context/ThemeContext";
import { Icon } from "../src/components/Icon";
import { useApi } from "../src/hooks/useApi";
import { timeAgo } from "../src/utils/time";

export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const api = useApi();
  useTheme();

  const [notifs, setNotifs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState(new Set());

  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn) { setLoading(false); return; }
      let active = true;
      setLoading(true);
      api.getConversations()
        .then((rows) => {
          if (!active) return;
          // Inbound = the last message was sent by someone else (not me).
          const items = rows
            .filter((c) => c.last_sender_id && c.last_sender_id !== user?.id)
            .map((c) => ({
              id: c.property_id,
              title: `New message · ${c.title}`,
              body: c.last_text,
              time: c.last_time,
            }));
          setNotifs(items);
        })
        .catch(() => { if (active) setNotifs([]); })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [isSignedIn, user?.id])
  );

  const markAllRead = () => setReadIds(new Set(notifs.map((n) => n.id)));
  const unread = notifs.filter((n) => !readIds.has(n.id)).length;

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
        <Text style={{ flex: 1, textAlign: "center", fontFamily: FONT_MED, fontSize: 14, color: C.fg }}>Notifications</Text>
        {unread > 0 ? (
          <Pressable onPress={markAllRead} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: C.amberDim }}>
            <Text style={{ color: C.amberText, fontFamily: FONT_MED, fontSize: 11 }}>Mark all read</Text>
          </Pressable>
        ) : <View style={{ width: 44 }} />}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Editorial headline */}
        <View style={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 20 }}>
          <Text style={{ color: C.fgDim, fontFamily: FONT, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
            What's new
          </Text>
          <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 38, lineHeight: 40, letterSpacing: -1 }}>
            Activity,{" "}
            <Text style={{ color: C.fgDim, fontFamily: FONT_HEAD_ITALIC, fontStyle: "italic" }}>fresh.</Text>
          </Text>
        </View>

        {loading ? (
          <View style={{ paddingTop: 60, alignItems: "center" }}>
            <ActivityIndicator color={C.amber} />
          </View>
        ) : notifs.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 60, gap: 8 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.chipBg, alignItems: "center", justifyContent: "center" }}>
              <Icon name="bell" size={20} color={C.fgDim} strokeWidth={1.4} />
            </View>
            <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT, marginTop: 4 }}>You're all caught up.</Text>
          </View>
        ) : (
          notifs.map((n, i) => {
            const isRead = readIds.has(n.id);
            return (
              <Pressable
                key={n.id}
                onPress={() => { setReadIds((prev) => new Set([...prev, n.id])); router.push(`/chat/${n.id}`); }}
                style={({ pressed }) => ({
                  flexDirection: "row", alignItems: "flex-start", gap: 14,
                  paddingHorizontal: 22, paddingVertical: 16,
                  borderBottomWidth: i < notifs.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: C.line,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: isRead ? C.chipBg : C.amberDim,
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon name="send" size={18} color={isRead ? C.fg : C.amber} strokeWidth={1.6} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3, gap: 8 }}>
                    <Text style={{ color: C.fg, fontFamily: isRead ? FONT : FONT_MED, fontSize: 13, flex: 1 }} numberOfLines={1}>{n.title}</Text>
                    <Text style={{ color: C.fgDim, fontSize: 10, fontFamily: FONT }}>{timeAgo(n.time)}</Text>
                  </View>
                  <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT, lineHeight: 18 }} numberOfLines={1}>{n.body}</Text>
                </View>
                {!isRead && (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.amber, marginTop: 8, flexShrink: 0 }} />
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
