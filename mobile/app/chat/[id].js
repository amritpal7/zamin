// mobile/app/chat/[id].js — refactored to design language.
// SVG icons (back/send/bell for call), editorial header, bubble shapes via borderRadius corners.

import { useTheme } from "../../src/context/ThemeContext";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet, Modal, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import { LinearGradient } from "expo-linear-gradient";
import { C, FONT, FONT_MED, FONT_HEAD } from "../../src/theme";
import { Icon } from "../../src/components/Icon";
import { Avatar } from "../../src/components/ui";
import SmartImage from "../../src/components/SmartImage";
import { SEED_PROPERTIES } from "../../src/data/properties";
import { useApi } from "../../src/hooks/useApi";
import { useSocket } from "../../src/context/SocketContext";
import { setActiveChat } from "../../src/components/PushManager";

// A visit or offer rendered inline. While pending, the recipient can Accept,
// Decline, or Counter (propose a new time/amount). Both sides see the outcome.
function ProposalCard({ m, mineId, onRespond, onCounter }) {
  const meta = m.meta || {};
  const isVisit = m.type === "visit";
  const isRecipient = String(m.receiver_id) === String(mineId);
  const status = meta.status || "pending";
  const valueStr = isVisit
    ? (meta.when ? new Date(meta.when).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "")
    : `₹${Number(meta.amount || 0).toLocaleString("en-IN")}`;
  const statusStr =
    status === "accepted"  ? (isVisit ? "✓ Visit confirmed" : "✓ Offer accepted") :
    status === "declined"  ? "✕ Declined" :
    status === "countered" ? "↺ Countered" :
    isRecipient ? "Pending" : "Awaiting response";
  return (
    <View style={{ alignSelf: "stretch", backgroundColor: C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, borderRadius: 16, padding: 14, marginVertical: 4 }}>
      <Text style={{ color: C.amberText, fontFamily: FONT_MED, fontSize: 12, marginBottom: 6 }}>{isVisit ? "📅 Visit request" : "💰 Offer"}</Text>
      <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 18, letterSpacing: -0.2 }}>{valueStr}</Text>
      {status === "pending" && isRecipient ? (
        <>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Pressable onPress={() => onRespond(m.id, "accepted")} style={{ flex: 1, backgroundColor: C.green, borderRadius: 100, paddingVertical: 9, alignItems: "center" }}>
              <Text style={{ color: "#04210f", fontFamily: FONT_MED, fontSize: 13 }}>Accept</Text>
            </Pressable>
            <Pressable onPress={() => onRespond(m.id, "declined")} style={{ flex: 1, backgroundColor: C.chipBg, borderRadius: 100, paddingVertical: 9, alignItems: "center" }}>
              <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 13 }}>Decline</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => onCounter(m)} style={{ marginTop: 10, alignItems: "center" }}>
            <Text style={{ color: C.amberText, fontFamily: FONT_MED, fontSize: 13 }}>{isVisit ? "Suggest another time" : "Make a counter-offer"}</Text>
          </Pressable>
        </>
      ) : (
        <Text style={{ marginTop: 8, fontFamily: FONT_MED, fontSize: 13, color: status === "accepted" ? C.green : status === "declined" ? C.red : C.fgDim }}>
          {statusStr}
        </Text>
      )}
    </View>
  );
}

// Amount entry for a new offer or a counter-offer.
function OfferModal({ onClose, onPick, counter }) {
  const [amount, setAmount] = useState("");
  const num = Number(amount.replace(/[^\d.]/g, ""));
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 }}>
          <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 20, marginBottom: 14 }}>{counter ? "Counter offer" : "Make an offer"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, borderRadius: 14, paddingHorizontal: 16, marginBottom: 20 }}>
            <Text style={{ color: C.amberText, fontFamily: FONT_HEAD, fontSize: 18 }}>₹</Text>
            <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Amount (e.g. 2400000)" placeholderTextColor={C.fgDim}
              style={{ flex: 1, paddingVertical: 14, color: C.fg, fontFamily: FONT, fontSize: 15 }} />
          </View>
          <Pressable onPress={() => num > 0 && onPick(num)} disabled={!(num > 0)} style={{ backgroundColor: C.amber, borderRadius: 100, paddingVertical: 14, alignItems: "center", opacity: num > 0 ? 1 : 0.4 }}>
            <Text style={{ color: C.ink, fontFamily: FONT_MED, fontSize: 15 }}>{counter ? "Send counter-offer →" : "Send offer →"}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Bottom-sheet picker: choose a day + time slot to propose. No native date picker
// dependency, so it works on web and Expo Go alike.
function VisitModal({ onClose, onPick }) {
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState(1);
  const days = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
  const slots = [{ label: "Morning", h: 10 }, { label: "Afternoon", h: 14 }, { label: "Evening", h: 17 }];
  const confirm = () => { const d = new Date(days[day]); d.setHours(slots[slot].h, 0, 0, 0); onPick(d.toISOString()); };
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 }}>
          <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 20, marginBottom: 14 }}>Propose a visit</Text>
          <Text style={{ color: C.fgDim, fontFamily: FONT, fontSize: 12, marginBottom: 8 }}>DAY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {days.map((d, i) => (
              <Pressable key={i} onPress={() => setDay(i)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, marginRight: 8, backgroundColor: day === i ? C.amber : C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder }}>
                <Text style={{ color: day === i ? C.ink : C.fg, fontFamily: FONT_MED, fontSize: 12 }}>{i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={{ color: C.fgDim, fontFamily: FONT, fontSize: 12, marginBottom: 8 }}>TIME</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            {slots.map((s, i) => (
              <Pressable key={i} onPress={() => setSlot(i)} style={{ flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: "center", backgroundColor: slot === i ? C.amber : C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder }}>
                <Text style={{ color: slot === i ? C.ink : C.fg, fontFamily: FONT_MED, fontSize: 12 }}>{s.label}</Text>
                <Text style={{ color: slot === i ? C.ink : C.fgDim, fontFamily: FONT, fontSize: 10, marginTop: 2 }}>{s.h > 12 ? s.h - 12 : s.h} {s.h >= 12 ? "PM" : "AM"}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={confirm} style={{ backgroundColor: C.amber, borderRadius: 100, paddingVertical: 14, alignItems: "center" }}>
            <Text style={{ color: C.ink, fontFamily: FONT_MED, fontSize: 15 }}>Send visit request →</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function Chat() {
  useTheme();
  const { id, peer } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;               // useApi() isn't referentially stable — pin it in a ref
  const socket = useSocket();

  // Load the REAL property so the header + receiver_id are correct for live
  // listings (UUID ids). Fall back to seed data for the demo listings.
  const [p, setP]               = useState(() => SEED_PROPERTIES.find(x => String(x.id) === String(id)) || null);
  const [messages, setMessages] = useState([]);
  const [msg, setMsg]           = useState("");
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [modal, setModal] = useState(null); // { kind: 'visit'|'offer', mode: 'new'|'counter', counterId? }
  const scrollRef = useRef(null);
  const typingClearRef = useRef(null);
  const typingEmitRef  = useRef(null);

  const markRead = useCallback(() => { if (peer) apiRef.current.markRead(id, peer).catch(() => {}); }, [id, peer]);

  // My identity, stamped on each message I send so the other side sees who wrote it.
  const myName   = user ? ([user.firstName, user.lastName].filter(Boolean).join(" ") || (user.username ? `@${user.username}` : "User")) : "User";
  const myAvatar = user ? (`${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || user.username?.[0]?.toUpperCase() || "U") : "U";
  const myImage  = user?.hasImage ? user.imageUrl : null;

  // Suppress push banners for the chat that's currently open.
  useEffect(() => { setActiveChat(id); return () => setActiveChat(null); }, [id]);

  useEffect(() => {
    api.getProperty(id).then(setP).catch(() => {});
  }, [id]);

  useEffect(() => {
    api.getMessages(id, peer)
      .then(setMessages)
      .catch(() => setMessages([{
        id: "seed", sender_id: "owner",
        text: "Hi! Thanks for your interest. How can I help?",
        created_at: new Date().toISOString(),
      }]))
      .finally(() => setLoading(false));
  }, [id, peer]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // Mark the peer's messages as read once the thread has loaded.
  useEffect(() => { if (!loading) markRead(); }, [loading, markRead]);

  // Real-time: incoming messages, read receipts, and typing signals for THIS thread.
  useEffect(() => {
    if (!socket) return;
    const mine = String(user?.id);
    const inThread = (m) =>
      String(m.property_id) === String(id) &&
      ((String(m.sender_id) === String(peer) && String(m.receiver_id) === mine) ||
       (String(m.sender_id) === mine && String(m.receiver_id) === String(peer)));

    const onMessage = (m) => {
      if (!inThread(m)) return;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      if (String(m.sender_id) === String(peer)) markRead();
    };
    const onRead = (data) => {
      if (String(data.propertyId) === String(id) && String(data.by) === String(peer)) {
        setMessages((prev) => prev.map((x) =>
          (String(x.sender_id) === mine && !x.read_at) ? { ...x, read_at: new Date().toISOString() } : x));
      }
    };
    const onUpdate = (m) => {
      if (!inThread(m)) return;
      setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
    };
    const onTyping = (data) => {
      if (String(data.from) !== String(peer) || String(data.propertyId) !== String(id)) return;
      setPeerTyping(!!data.typing);
      if (data.typing) {
        clearTimeout(typingClearRef.current);
        typingClearRef.current = setTimeout(() => setPeerTyping(false), 3500);
      }
    };
    socket.on("message", onMessage);
    socket.on("read", onRead);
    socket.on("typing", onTyping);
    socket.on("message-update", onUpdate);
    return () => {
      socket.off("message", onMessage);
      socket.off("read", onRead);
      socket.off("typing", onTyping);
      socket.off("message-update", onUpdate);
    };
  }, [socket, id, peer, user?.id, markRead]);

  // Create / respond to / counter a proposal (visit or offer).
  const ident = () => ({ sender_name: myName, sender_avatar: myAvatar, sender_image: myImage });
  const onPickValue = async (value) => {
    const m = modal; setModal(null);
    if (!m) return;
    try {
      if (m.mode === "counter") {
        const { proposal } = await api.counterProposal(m.counterId, { value, ...ident() });
        setMessages((prev) => {
          const withOrig = prev.map((x) => (x.id === m.counterId ? { ...x, meta: { ...(x.meta || {}), status: "countered" } } : x));
          return withOrig.some((x) => x.id === proposal.id) ? withOrig : [...withOrig, proposal];
        });
      } else {
        const receiver = peer || p?.clerk_user_id;
        if (!receiver || String(receiver) === String(user?.id)) return;
        const sent = m.kind === "visit"
          ? await api.proposeVisit(id, { receiver_id: receiver, when: value, ...ident() })
          : await api.proposeOffer(id, { receiver_id: receiver, amount: value, ...ident() });
        setMessages((prev) => (prev.some((x) => x.id === sent.id) ? prev : [...prev, sent]));
      }
    } catch { /* ignore */ }
  };
  const respondProposal = async (messageId, status) => {
    try {
      const updated = await api.respondProposal(messageId, status);
      setMessages((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch { /* ignore */ }
  };
  const openCounter = (m) => setModal({ kind: m.type, mode: "counter", counterId: m.id });

  // Pick + send a photo (reuses the presigned upload + thumbnail pipeline).
  const sendImage = async () => {
    const receiver = peer || p?.clerk_user_id;
    if (!receiver || String(receiver) === String(user?.id)) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Allow photo access to send a photo."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (res.canceled) return;
    const uri = res.assets[0].uri;
    const optimistic = { id: `tmp-${Date.now()}`, sender_id: user?.id, type: "image", meta: { url: uri, thumb: uri }, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const [uploaded] = await api.uploadImages([uri]);   // { url, thumb } (+ optimistic local mapping)
      const sent = await api.sendMessage(id, "📷 Photo", receiver, { ...ident(), image: uploaded });
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? sent : m)));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      Alert.alert("Couldn't send", "The photo failed to upload. Please try again.");
    }
  };

  // Emit typing (debounced off) to the peer as I type.
  const onChangeMsg = (t) => {
    setMsg(t);
    if (!socket || !peer) return;
    socket.emit("typing", { to: peer, propertyId: id, typing: true });
    clearTimeout(typingEmitRef.current);
    typingEmitRef.current = setTimeout(() => socket.emit("typing", { to: peer, propertyId: id, typing: false }), 1500);
  };

  const send = async () => {
    if (!msg.trim() || sending) return;
    // Message the OTHER person (peer). Never address it to yourself.
    const receiver = peer || p?.clerk_user_id || p?.owner_id;
    if (!receiver || String(receiver) === String(user?.id)) return;
    const text = msg.trim();
    setMsg("");
    setSending(true);
    const optimistic = { id: `tmp-${Date.now()}`, sender_id: user?.id, text, created_at: new Date().toISOString(), sender_name: myName, sender_avatar: myAvatar, sender_image: myImage };
    setMessages(prev => [...prev, optimistic]);
    try {
      const sent = await api.sendMessage(id, text, receiver, { sender_name: myName, sender_avatar: myAvatar, sender_image: myImage });
      setMessages(prev => prev.map(m => m.id === optimistic.id ? sent : m));
    } catch {
      /* keep optimistic on failure */
    } finally {
      setSending(false);
    }
  };

  // Who I'm talking to (the peer): the owner if peer is the owner, otherwise the
  // buyer whose identity we stamped onto their messages.
  const peerIsOwner = !!(peer && p?.clerk_user_id && String(peer) === String(p.clerk_user_id));
  const peerMsg     = messages.find(m => String(m.sender_id) === String(peer) && m.sender_name)
                   || messages.find(m => String(m.sender_id) === String(peer));
  const peerName    = peerIsOwner ? (p?.owner_name || "Owner") : (peerMsg?.sender_name || "Buyer");
  const peerAvatar  = peerIsOwner ? (p?.owner_avatar || "??")  : (peerMsg?.sender_avatar || "??");
  const peerImage   = peerIsOwner ? (p?.owner_image || null)   : (peerMsg?.sender_image || null);
  const peerGone    = peerIsOwner && p?.owner_active === false;

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

        <Avatar initials={peerAvatar} size={40} color={p?.color || C.amber} imageUrl={peerImage} />

        <View style={{ flex: 1 }}>
          <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 14 }} numberOfLines={1}>{peerName}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: peerGone ? C.red : C.green }} />
            <Text style={{ color: peerGone ? C.red : peerTyping ? C.amberText : C.fgDim, fontSize: 11, fontFamily: FONT }}>
              {peerGone ? "No longer available" : peerTyping ? "typing…" : "Online"}
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

      {peerGone && (
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
            if (m.type === "visit" || m.type === "offer") {
              return <ProposalCard key={m.id} m={m} mineId={user?.id} onRespond={respondProposal} onCounter={openCounter} />;
            }
            if (m.type === "image") {
              const own = m.sender_id === user?.id;
              const uri = m.meta?.url || m.meta?.thumb;
              return (
                <View key={m.id} style={{ alignSelf: own ? "flex-end" : "flex-start", maxWidth: "70%" }}>
                  <View style={{ width: 220, height: 220, borderRadius: 16, overflow: "hidden", backgroundColor: C.chipBg }}>
                    <SmartImage uri={uri} style={{ width: "100%", height: "100%" }} />
                  </View>
                  <Text style={{ color: own && m.read_at ? C.amberText : C.fgDim, fontSize: 10, marginTop: 4, marginHorizontal: 6, textAlign: own ? "right" : "left", fontFamily: FONT }}>
                    {fmt(m.created_at)}{own ? (m.read_at ? "  ✓✓" : "  ✓") : ""}
                  </Text>
                </View>
              );
            }
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
                  <Text style={{ color: own ? C.ink : C.fg, fontFamily: FONT, fontSize: 14, lineHeight: 20, letterSpacing: 0.3 }}>{m.text}</Text>
                </View>
                <Text style={{ color: own && m.read_at ? C.amberText : C.fgDim, fontSize: 10, marginTop: 4, marginHorizontal: 6, textAlign: own ? "right" : "left", fontFamily: FONT }}>
                  {fmt(m.created_at)}{own ? (m.read_at ? "  ✓✓" : "  ✓") : ""}
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
          {!peerGone && (
            <>
              <Pressable
                onPress={sendImage}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.chipBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, alignItems: "center", justifyContent: "center" }}
              >
                <Icon name="image" size={18} color={C.amberText} />
              </Pressable>
              <Pressable
                onPress={() => setModal({ kind: "visit", mode: "new" })}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.chipBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, alignItems: "center", justifyContent: "center" }}
              >
                <Icon name="clock" size={18} color={C.amberText} />
              </Pressable>
              <Pressable
                onPress={() => setModal({ kind: "offer", mode: "new" })}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.chipBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, alignItems: "center", justifyContent: "center" }}
              >
                <Icon name="tag" size={18} color={C.amberText} />
              </Pressable>
            </>
          )}
          <View style={{
            flex: 1, backgroundColor: C.bg,
            borderRadius: 999,
            paddingHorizontal: 16, paddingVertical: 4,
            borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder,
            flexDirection: "row", alignItems: "center", gap: 8,
          }}>
            <TextInput
              value={msg} onChangeText={onChangeMsg} onSubmitEditing={send}
              placeholder="Type a message…" placeholderTextColor={C.fgDim}
              style={{ flex: 1, paddingVertical: 10, color: C.fg, fontFamily: FONT, fontSize: 14, letterSpacing: 0.3 }}
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

      {modal?.kind === "visit" && <VisitModal onClose={() => setModal(null)} onPick={onPickValue} />}
      {modal?.kind === "offer" && <OfferModal onClose={() => setModal(null)} onPick={onPickValue} counter={modal.mode === "counter"} />}
    </View>
  );
}
