// mobile/app/messages.js — refactored to design language.
// SVG back button, editorial header, hairline glass rows, no emoji empty state.

import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, FONT, FONT_MED, FONT_HEAD, FONT_HEAD_ITALIC } from "../src/theme";
import { useTheme } from "../src/context/ThemeContext";
import { Icon } from "../src/components/Icon";
import { Avatar } from "../src/components/ui";

const FAKE_CHATS = [
  { id: 1, name: "Rahul Mehta",   initials: "RM", color: "#4da6ff", time: "2m ago",    unread: 2, lastMsg: "Is the 3BHK still available?" },
  { id: 2, name: "Priya Sharma",  initials: "PS", color: "#00d084", time: "1h ago",    unread: 1, lastMsg: "Can we schedule a visit this weekend?" },
  { id: 3, name: "Amit Verma",    initials: "AV", color: "#f0a500", time: "Yesterday", unread: 0, lastMsg: "What is the final asking price?" },
  { id: 4, name: "Sunita Patel",  initials: "SP", color: "#ff4757", time: "2d ago",    unread: 0, lastMsg: "Thanks for showing the property!" },
  { id: 5, name: "Vikram Joshi",  initials: "VJ", color: "#9b59b6", time: "3d ago",    unread: 0, lastMsg: "We'll get back to you soon." },
];

export default function Messages() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useTheme();

  const unreadCount = FAKE_CHATS.filter(c => c.unread > 0).length;

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
        {unreadCount > 0 ? (
          <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: C.amberDim, borderWidth: StyleSheet.hairlineWidth, borderColor: C.amber + "40" }}>
            <Text style={{ color: C.amberText, fontFamily: FONT_MED, fontSize: 11 }}>{unreadCount} unread</Text>
          </View>
        ) : <View style={{ width: 44 }} />}
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

        {FAKE_CHATS.map((chat, i) => (
          <Pressable
            key={chat.id}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 14,
              paddingHorizontal: 22, paddingVertical: 16,
              borderBottomWidth: i < FAKE_CHATS.length - 1 ? StyleSheet.hairlineWidth : 0,
              borderBottomColor: C.line,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ position: "relative" }}>
              <Avatar initials={chat.initials} size={48} color={chat.color} />
              {chat.unread > 0 && (
                <View style={{
                  position: "absolute", top: -2, right: -2,
                  width: 18, height: 18, borderRadius: 9,
                  backgroundColor: C.amber,
                  alignItems: "center", justifyContent: "center",
                  borderWidth: 2, borderColor: C.bg,
                }}>
                  <Text style={{ color: C.ink, fontFamily: FONT_MED, fontSize: 10 }}>{chat.unread}</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                <Text style={{ color: C.fg, fontFamily: chat.unread > 0 ? FONT_MED : FONT, fontSize: 14 }}>{chat.name}</Text>
                <Text style={{ color: C.fgDim, fontSize: 11, fontFamily: FONT }}>{chat.time}</Text>
              </View>
              <Text
                style={{ color: chat.unread > 0 ? C.fg : C.fgDim, fontSize: 12, fontFamily: FONT }}
                numberOfLines={1}
              >
                {chat.lastMsg}
              </Text>
            </View>
            <Icon name="chevR" size={14} color={C.fgDim} />
          </Pressable>
        ))}

        <View style={{ alignItems: "center", paddingTop: 48, paddingHorizontal: 40, gap: 8 }}>
          <View style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: C.chipBg, alignItems: "center", justifyContent: "center",
            marginBottom: 8,
          }}>
            <Icon name="bell" size={20} color={C.fgDim} strokeWidth={1.4} />
          </View>
          <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 18, letterSpacing: -0.3 }}>In-app chat, soon.</Text>
          <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT, textAlign: "center", lineHeight: 18 }}>
            Contact sellers directly through their listings for now.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
