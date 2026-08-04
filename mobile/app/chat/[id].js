// mobile/app/chat/[id].js — refactored to design language.
// SVG icons (back/send/bell for call), editorial header, bubble shapes via borderRadius corners.

import { useTheme } from "../../src/context/ThemeContext";
import React, { useState, useRef, useEffect } from "react";
import { View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import { LinearGradient } from "expo-linear-gradient";
import { C, FONT, FONT_MED, FONT_HEAD } from "../../src/theme";
import { Icon } from "../../src/components/Icon";
import { Avatar } from "../../src/components/ui";
import { SEED_PROPERTIES } from "../../src/data/properties";
import { useApi } from "../../src/hooks/useApi";

export default function Chat() {
  useTheme();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const api = useApi();

  // Load the REAL property so the header + receiver_id are correct for live
  // listings (UUID ids). Fall back to seed data for the demo listings.
  const [p, setP]               = useState(() => SEED_PROPERTIES.find(x => String(x.id) === String(id)) || null);
  const [messages, setMessages] = useState([]);
  const [msg, setMsg]           = useState("");
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    api.getProperty(id).then(setP).catch(() => {});
  }, [id]);

  useEffect(() => {
    api.getMessages(id)
      .then(setMessages)
      .catch(() => setMessages([{
        id: "seed", sender_id: "owner",
        text: "Hi! Thanks for your interest. How can I help?",
        created_at: new Date().toISOString(),
      }]))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const send = async () => {
    if (!msg.trim() || sending) return;
    const text = msg.trim();
    setMsg("");
    setSending(true);
    const optimistic = { id: `tmp-${Date.now()}`, sender_id: user?.id, text, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    try {
      const sent = await api.sendMessage(id, text, p?.clerk_user_id || p?.owner_id || "seed_user_1");
      setMessages(prev => prev.map(m => m.id === optimistic.id ? sent : m));
    } catch {
      /* keep optimistic on failure */
    } finally {
      setSending(false);
    }
  };

  const fmt = (iso) => {
    const d = new Date(iso);
    return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() >= 12 ? "PM" : "AM"}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Glass header */}
      <View style={{
        paddingTop: insets.top + 10, paddingHorizontal: 14, paddingBottom: 12,
        backgroundColor: C.glassBg,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line,
        flexDirection: "row", alignItems: "center", gap: 10,
      }}>
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: C.chipBg,
            borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon name="back" size={17} color={C.fg} />
        </Pressable>

        <Avatar initials={p?.owner_avatar || "??"} size={40} color={p?.color || C.amber} imageUrl={p?.owner_image} />

        <View style={{ flex: 1 }}>
          <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 14 }}>{p?.owner_name || "Owner"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p?.owner_active === false ? C.red : C.green }} />
            <Text style={{ color: p?.owner_active === false ? C.red : C.fgDim, fontSize: 11, fontFamily: FONT }}>
              {p?.owner_active === false ? "No longer available" : "Online"}
            </Text>
          </View>
        </View>

        <Pressable
          style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: C.chipBg,
            borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon name="bell" size={16} color={C.fg} />
        </Pressable>
      </View>

      {p?.owner_active === false && (
        <View style={{ backgroundColor: C.red + "18", paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ color: C.red, fontSize: 12, fontFamily: FONT, textAlign: "center" }}>
            ⚠ This owner's account no longer exists. They won't receive new messages.
          </Text>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, gap: 10 }}>

          {/* Property pill */}
          {p && (
            <Pressable
              onPress={() => router.push(`/property/${p.id}`)}
              style={({ pressed }) => ({
                backgroundColor: C.glassBg, borderRadius: 18,
                borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder,
                padding: 12,
                flexDirection: "row", alignItems: "center", gap: 12,
                marginBottom: 6,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 12,
                backgroundColor: (p.color || C.amber) + "33",
                alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ fontSize: 22 }}>{p.img}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 16, letterSpacing: -0.2 }} numberOfLines={1}>{p.title}</Text>
                <Text style={{ color: C.amberText, fontFamily: FONT_MED, fontSize: 13, marginTop: 2 }}>₹{p.price}</Text>
              </View>
              <Icon name="chevR" size={16} color={C.fgDim} />
            </Pressable>
          )}

          {loading && <ActivityIndicator color={C.amber} style={{ marginTop: 20 }} />}

          {messages.map((m) => {
            const own = m.sender_id === user?.id;
            return (
              <View key={m.id} style={{ alignSelf: own ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                <View style={{
                  backgroundColor: own ? C.amber : C.glassBg,
                  borderWidth: own ? 0 : StyleSheet.hairlineWidth,
                  borderColor: C.glassBorder,
                  borderTopLeftRadius: 18,
                  borderTopRightRadius: 18,
                  borderBottomLeftRadius: own ? 18 : 4,
                  borderBottomRightRadius: own ? 4 : 18,
                  paddingHorizontal: 14, paddingVertical: 10,
                }}>
                  <Text style={{ color: own ? C.ink : C.fg, fontFamily: FONT, fontSize: 14, lineHeight: 20 }}>{m.text}</Text>
                </View>
                <Text style={{ color: C.fgDim, fontSize: 10, marginTop: 4, marginHorizontal: 6, textAlign: own ? "right" : "left", fontFamily: FONT }}>
                  {fmt(m.created_at)}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Composer */}
        <View style={{
          flexDirection: "row", gap: 10, padding: 14,
          paddingBottom: insets.bottom + 14,
          borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line,
          backgroundColor: C.glassBg,
          alignItems: "center",
        }}>
          <View style={{
            flex: 1, backgroundColor: C.bg,
            borderRadius: 999,
            paddingHorizontal: 16, paddingVertical: 4,
            borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder,
            flexDirection: "row", alignItems: "center", gap: 8,
          }}>
            <TextInput
              value={msg} onChangeText={setMsg} onSubmitEditing={send}
              placeholder="Type a message…" placeholderTextColor={C.fgDim}
              style={{ flex: 1, paddingVertical: 10, color: C.fg, fontFamily: FONT, fontSize: 14 }}
            />
          </View>
          <Pressable
            onPress={send}
            disabled={sending || !msg.trim()}
            style={({ pressed }) => ({
              width: 44, height: 44, borderRadius: 22,
              opacity: pressed ? 0.85 : (sending || !msg.trim()) ? 0.4 : 1,
            })}
          >
            <LinearGradient
              colors={[C.amber + "ee", "#F0A65A", "#B86A26"]}
              start={{ x: 0.2, y: 0.2 }} end={{ x: 1, y: 1 }}
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}
            >
              {sending
                ? <ActivityIndicator color={C.ink} size="small" />
                : <Icon name="send" size={17} color={C.ink} strokeWidth={1.8} />
              }
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
