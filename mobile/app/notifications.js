// mobile/app/notifications.js — refactored to design language.
// Editorial header, SVG icons (no emoji), hairline row separators, accent dot for unread.

import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, FONT, FONT_MED, FONT_HEAD, FONT_HEAD_ITALIC } from "../src/theme";
import { useTheme } from "../src/context/ThemeContext";
import { Icon } from "../src/components/Icon";

const FAKE_NOTIFS = [
  { id: 1, icon: "heart",    title: "New save on your listing",       body: "3BHK Flat in Bandra West got a new save",  time: "5m ago",    read: false },
  { id: 2, icon: "send",     title: "Message from Rahul Mehta",       body: '"Is the property still available?"',       time: "2h ago",    read: false },
  { id: 3, icon: "compass",  title: "10 people viewed your listing",  body: "Your Andheri listing got 10 views today",  time: "Yesterday", read: true  },
  { id: 4, icon: "sparkle",  title: "Listing published",              body: "Your property is now live on Zamin",       time: "3d ago",    read: true  },
  { id: 5, icon: "arrow",    title: "Price drop alert",               body: "A saved property dropped ₹2L in price",    time: "5d ago",    read: true  },
];

export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useTheme();
  const [readIds, setReadIds] = useState(new Set());

  const markAllRead = () => setReadIds(new Set(FAKE_NOTIFS.map(n => n.id)));
  const unread = FAKE_NOTIFS.filter(n => !n.read && !readIds.has(n.id)).length;

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

        {FAKE_NOTIFS.map((n, i) => {
          const isRead = n.read || readIds.has(n.id);
          return (
            <Pressable
              key={n.id}
              onPress={() => setReadIds(prev => new Set([...prev, n.id]))}
              style={({ pressed }) => ({
                flexDirection: "row", alignItems: "flex-start", gap: 14,
                paddingHorizontal: 22, paddingVertical: 16,
                borderBottomWidth: i < FAKE_NOTIFS.length - 1 ? StyleSheet.hairlineWidth : 0,
                borderBottomColor: C.line,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: isRead ? C.chipBg : C.amberDim,
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Icon name={n.icon} size={18} color={isRead ? C.fg : C.amber} strokeWidth={1.6} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3, gap: 8 }}>
                  <Text style={{ color: C.fg, fontFamily: isRead ? FONT : FONT_MED, fontSize: 13, flex: 1 }}>{n.title}</Text>
                  <Text style={{ color: C.fgDim, fontSize: 10, fontFamily: FONT }}>{n.time}</Text>
                </View>
                <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT, lineHeight: 18 }}>{n.body}</Text>
              </View>
              {!isRead && (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.amber, marginTop: 8, flexShrink: 0 }} />
              )}
            </Pressable>
          );
        })}

        <View style={{ alignItems: "center", paddingTop: 48, gap: 8 }}>
          <View style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: C.chipBg, alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="bell" size={20} color={C.fgDim} strokeWidth={1.4} />
          </View>
          <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT, marginTop: 4 }}>You're all caught up.</Text>
        </View>
      </ScrollView>
    </View>
  );
}
