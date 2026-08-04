// mobile/app/messages.js — real conversations inbox.
// Lists the current user's chats (one row per property), newest first.

import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { C, FONT, FONT_MED, FONT_HEAD, FONT_HEAD_ITALIC } from "../src/theme";
import { useTheme } from "../src/context/ThemeContext";
import { Icon } from "../src/components/Icon";
import { Avatar } from "../src/components/ui";
import { useApi } from "../src/hooks/useApi";
import { timeAgo } from "../src/utils/time";

export default function Messages() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const api = useApi();
  useTheme();

  const [chats, setChats]     = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn) { setLoading(false); return; }
      let active = true;
      setLoading(true);
      api.getConversations()
        .then((rows) => { if (active) setChats(rows); })
        .catch(() => { if (active) setChats([]); })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [isSignedIn])
  );

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
        <Text style={{ flex: 1, textAlign: "center", fontFamily: FONT_MED, fontSize: 14, color: C.fg }}>Messages</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Editorial headline */}
        <View style={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 20 }}>
          <Text style={{ color: C.fgDim, fontFamily: FONT, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
            Conversations
          </Text>
          <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 38, lineHeight: 40, letterSpacing: -1 }}>
            Threads,{" "}
            <Text style={{ color: C.fgDim, fontFamily: FONT_HEAD_ITALIC, fontStyle: "italic" }}>open.</Text>
          </Text>
        </View>

        {loading ? (
          <View style={{ paddingTop: 60, alignItems: "center" }}>
            <ActivityIndicator color={C.amber} />
          </View>
        ) : chats.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 40, gap: 8 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.chipBg, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
              <Icon name="bell" size={20} color={C.fgDim} strokeWidth={1.4} />
            </View>
            <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 18, letterSpacing: -0.3 }}>No conversations yet.</Text>
            <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT, textAlign: "center", lineHeight: 18 }}>
              Message an owner from a listing to start a conversation.
            </Text>
          </View>
        ) : (
          chats.map((chat, i) => (
            <Pressable
              key={chat.property_id}
              onPress={() => router.push(`/chat/${chat.property_id}`)}
              style={({ pressed }) => ({
                flexDirection: "row", alignItems: "center", gap: 14,
                paddingHorizontal: 22, paddingVertical: 16,
                borderBottomWidth: i < chats.length - 1 ? StyleSheet.hairlineWidth : 0,
                borderBottomColor: C.line,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Avatar initials={chat.owner_avatar || "??"} size={48} color={chat.color || C.amber} imageUrl={chat.owner_image} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3, gap: 8 }}>
                  <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 14, flex: 1 }} numberOfLines={1}>{chat.title}</Text>
                  <Text style={{ color: C.fgDim, fontSize: 11, fontFamily: FONT }}>{timeAgo(chat.last_time)}</Text>
                </View>
                {chat.owner_active === false ? (
                  <Text style={{ color: C.red, fontSize: 12, fontFamily: FONT, fontWeight: "700" }} numberOfLines={1}>
                    ⚠ Owner no longer available
                  </Text>
                ) : (
                  <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT }} numberOfLines={1}>
                    {chat.last_text}
                  </Text>
                )}
              </View>
              <Icon name="chevR" size={14} color={C.fgDim} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
