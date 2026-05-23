import React, { useState, useRef, useEffect } from "react";
import { View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import { C, FONT } from "../../src/theme";
import NeoButton from "../../src/components/NeoButton";
import { Avatar } from "../../src/components/ui";
import { SEED_PROPERTIES } from "../../src/data/properties";
import { useApi } from "../../src/hooks/useApi";

export default function Chat() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const api = useApi();

  const p = SEED_PROPERTIES.find(x => String(x.id) === String(id));
  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    api.getMessages(id)
      .then(setMessages)
      .catch(() => setMessages([{ id: "seed", sender_id: "owner", text: "Hi! Thanks for your interest. How can I help?", created_at: new Date().toISOString() }]))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100); }, [messages]);

  const send = async () => {
    if (!msg.trim() || sending) return;
    const text = msg.trim();
    setMsg("");
    setSending(true);
    const optimistic = { id: `tmp-${Date.now()}`, sender_id: user?.id, text, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    try {
      const sent = await api.sendMessage(id, text, p?.owner_id || "seed_user_1");
      setMessages(prev => prev.map(m => m.id === optimistic.id ? sent : m));
    } catch {
      // keep optimistic on failure
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
      {/* Header */}
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 18, paddingBottom: 14, backgroundColor: C.amber, borderBottomWidth: 3, borderBottomColor: C.ink, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()} style={{ backgroundColor: C.ink, borderRadius: 10, width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.amber, fontSize: 18, fontWeight: "800", fontFamily: FONT }}>←</Text>
        </Pressable>
        <Avatar initials={p?.owner_avatar || "??"} size={36} color={p?.color || C.amber} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.ink, fontWeight: "800", fontSize: 15, fontFamily: FONT }}>{p?.owner_name || "Owner"}</Text>
          <Text style={{ color: C.ink, fontSize: 12, fontFamily: FONT }}>● Online</Text>
        </View>
        <Pressable style={{ backgroundColor: C.ink, borderRadius: 10, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 16 }}>📞</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, gap: 12 }}>
          {/* Property pill */}
          {p && (
            <View style={{ borderColor: C.ink, borderWidth: 2.5, borderRadius: 12, backgroundColor: C.cardAlt, padding: 10, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Text style={{ fontSize: 26 }}>{p.img}</Text>
              <View>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: "700", fontFamily: FONT }}>{p.title}</Text>
                <Text style={{ color: C.amber, fontSize: 13, fontWeight: "800", fontFamily: FONT }}>{p.price}</Text>
              </View>
            </View>
          )}

          {loading && <ActivityIndicator color={C.amber} style={{ marginTop: 20 }} />}

          {messages.map((m) => {
            const own = m.sender_id === user?.id;
            return (
              <View key={m.id} style={{ alignSelf: own ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                <View style={{ backgroundColor: own ? C.amber : C.card, borderColor: C.ink, borderWidth: 2.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }}>
                  <Text style={{ color: own ? C.ink : C.text, fontSize: 14, fontFamily: FONT }}>{m.text}</Text>
                </View>
                <Text style={{ color: C.muted, fontSize: 11, marginTop: 3, textAlign: own ? "right" : "left", fontFamily: FONT }}>{fmt(m.created_at)}</Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Input */}
        <View style={{ flexDirection: "row", gap: 10, padding: 14, paddingBottom: insets.bottom + 14, borderTopWidth: 3, borderTopColor: C.ink, backgroundColor: C.card }}>
          <TextInput
            value={msg} onChangeText={setMsg} onSubmitEditing={send}
            placeholder="Type a message..." placeholderTextColor={C.muted}
            style={{ flex: 1, backgroundColor: C.bg, borderColor: "#2e2e44", borderWidth: 2.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontFamily: FONT }}
          />
          <NeoButton title={sending ? "…" : "➤"} onPress={send} offset={3} disabled={sending} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
