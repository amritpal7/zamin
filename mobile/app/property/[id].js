import { useTheme } from "../../src/context/ThemeContext";
import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, Dimensions,
  Linking, Alert, ActivityIndicator, Share, StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { C, FONT, FONT_MED, FONT_HEAD } from "../../src/theme";
import { Icon } from "../../src/components/Icon";
import SmartImage from "../../src/components/SmartImage";
import { Avatar, Tag } from "../../src/components/ui";
import { useApi } from "../../src/hooks/useApi";
import { SEED_PROPERTIES } from "../../src/data/properties";
import { pricePerSqft, estimateEMI } from "../../src/utils/property";

// ── Reusable chips ────────────────────────────────────────────────────────
function Chip({ label, color, bg }) {
  return (
    <View style={{ backgroundColor: bg || (color + "18"), borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6 }}>
      <Text style={{ color: color || C.amber, fontSize: 12, fontWeight: "700", fontFamily: FONT }}>{label}</Text>
    </View>
  );
}

function GlassCard({ children, style }) {
  return (
    <View style={[{
      backgroundColor: C.glassBg,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.glassBorder,
      shadowColor: C.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.14,
      shadowRadius: 18,
      elevation: 5,
      marginBottom: 14,
    }, style]}>
      {children}
    </View>
  );
}

function ImageSlider({ images, color }) {
  const [idx, setIdx] = useState(0);
  const W = Dimensions.get("window").width - 44; // 22px margin each side
  return (
    <View style={{
      marginHorizontal: 22, borderRadius: 28, height: 260, overflow: "hidden", marginBottom: 22,
      shadowColor: color, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 28, elevation: 10,
    }}>
      <ScrollView
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setIdx(Math.round(e.nativeEvent.contentOffset.x / W))}
      >
        {images.map((uri, i) => (
          <SmartImage key={i} uri={uri} style={{ width: W, height: 260 }} />
        ))}
      </ScrollView>

      {/* gradient for legibility */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.45)"]}
        locations={[0.55, 1]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 110 }}
        pointerEvents="none"
      />

      {/* counter */}
      {images.length > 1 && (
        <View style={{ position: "absolute", top: 14, right: 14, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ color: "#fff", fontSize: 11, fontFamily: FONT_MED }}>{idx + 1}/{images.length}</Text>
        </View>
      )}

      {/* dots */}
      {images.length > 1 && (
        <View style={{ position: "absolute", bottom: 14, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 }}>
          {images.map((_, i) => (
            <View key={i} style={{ width: i === idx ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === idx ? "#fff" : "rgba(255,255,255,0.5)" }} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function PropertyDetail() {
  useTheme();
  const { id }  = useLocalSearchParams();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { isSignedIn, userId } = useAuth();
  const api     = useApi();

  const [p,       setP]       = useState(() => SEED_PROPERTIES.find(x => String(x.id) === String(id)) || null);
  const [saved,   setSaved]   = useState(false);
  const [loading, setLoading] = useState(!p);

  // Re-fetch whenever the screen regains focus (e.g. returning from the editor),
  // so edits show up immediately on the already-open detail screen.
  useFocusEffect(
    useCallback(() => {
      api.getProperty(id).then(setP).catch(() => {}).finally(() => setLoading(false));
      if (isSignedIn)
        api.getSaved().then(list => setSaved(list.some(x => String(x.id) === String(id)))).catch(() => {});
    }, [id, isSignedIn])
  );

  const toggleSave = async () => {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    setSaved(v => !v);
    try { saved ? await api.unsaveProperty(id) : await api.saveProperty(id); }
    catch { setSaved(v => !v); }
  };

  const call = () => {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    const phone = p?.owner_phone?.replace(/\s/g, "");
    if (!phone) { Alert.alert("No number", "Owner hasn't added a phone number."); return; }
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert("Call", `Calling ${p.owner_phone}…`));
  };

  const whatsapp = () => {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    const phone = (p?.owner_phone || "").replace(/\D/g, "");
    const num   = phone.length === 10 ? `91${phone}` : phone;
    if (!num) { Alert.alert("No number", "Owner hasn't added a WhatsApp number."); return; }
    const text = encodeURIComponent(`Hi! I saw "${p.title}" on Zamin and I'm interested. Is it still available?`);
    Linking.openURL(`https://wa.me/${num}?text=${text}`).catch(() =>
      Alert.alert("WhatsApp", "Could not open WhatsApp.")
    );
  };

  const share = async () => {
    try {
      await Share.share({
        title:   p?.title,
        message: `🏠 ${p?.title}\n📍 ${p?.location}\n💰 ${p?.price}\n\nFound on Zamin · Free · No brokerage`,
      });
    } catch {}
  };

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={C.amber} size="large" />
    </View>
  );
  if (!p) return null;

  const color    = p.color || C.amber;
  const ppsf     = pricePerSqft(p.price, p.area);
  const emi      = estimateEMI(p.price, p.status);
  const hasPhone = !!(p.owner_phone?.replace(/\D/g, "").length);
  const isOwn    = !!userId && p.clerk_user_id === userId;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>

      {/* ──────── Scrollable body ──────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
      >

        {/* ── Top nav row ── */}
        <View style={{
          paddingTop: insets.top + 14,
          paddingHorizontal: 22,
          paddingBottom: 10,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <Pressable onPress={() => router.back()} style={navBtnStyle()}>
            <Icon name="back" size={20} color={C.fg} strokeWidth={1.8} />
          </Pressable>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={share} style={navBtnStyle()}>
              <Icon name="send" size={17} color={C.fg} strokeWidth={1.6} />
            </Pressable>
            <Pressable onPress={toggleSave} style={[navBtnStyle(), saved && { backgroundColor: C.red + "18" }]}>
              <Icon name="heart" size={17} color={saved ? "#FF4757" : C.fg} fill={saved ? "#FF4757" : "none"} strokeWidth={1.6} />
            </Pressable>
          </View>
        </View>

        {/* ── Title section — ABOVE hero (Screen 3 layout) ── */}
        <View style={{ paddingHorizontal: 22, paddingBottom: 16 }}>
          <Text style={{ color: C.fg, fontSize: 28, fontFamily: FONT_HEAD, lineHeight: 32, letterSpacing: -0.6, marginBottom: 6 }}>
            {p.title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14 }}>
            <Icon name="pin" size={13} color={C.fgDim} />
            <Text style={{ color: C.fgDim, fontSize: 13, fontFamily: FONT }}>
              {p.location}
            </Text>
          </View>

          {/* Status + price row */}
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Chip
              label={p.status}
              color={p.status === "For Sale" ? C.green : C.blue}
            />
            <View style={{
              backgroundColor: color,
              borderRadius: 100,
              paddingHorizontal: 16,
              paddingVertical: 6,
              shadowColor: color,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 5,
            }}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900", fontFamily: FONT }}>{p.price}</Text>
            </View>
            {p.type ? (
              <Chip label={p.type} color={C.muted} bg={C.dim} />
            ) : null}
          </View>
        </View>

        {/* ── Hero: photo slider when images exist, else emoji card ── */}
        {p.images?.length ? (
          <ImageSlider images={p.images} color={color} />
        ) : (
          <View style={{
            marginHorizontal: 22,
            borderRadius: 28,
            height: 240,
            overflow: "hidden",
            marginBottom: 22,
            shadowColor: color,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.22,
            shadowRadius: 28,
            elevation: 10,
          }}>
            {/* Coloured bg */}
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: color + "55" }]} />

            {/* Emoji centered */}
            <View style={[StyleSheet.absoluteFillObject, styles.center]}>
              <Text style={{ fontSize: 110 }}>{p.img || "🏠"}</Text>
            </View>

            {/* Gradient */}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.08)", "rgba(0,0,0,0.30)", "rgba(0,0,0,0.55)"]}
              locations={[0, 0.4, 0.7, 1]}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 130 }}
            />

            {/* Location text overlay at bottom */}
            <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="pin" size={11} color="rgba(245,239,230,0.72)" />
              <Text style={{ color: "rgba(245,239,230,0.80)", fontSize: 12, fontFamily: FONT }}>
                {p.location}
              </Text>
            </View>
          </View>
        )}

        {/* ── Stats chips ── */}
        <View style={{ paddingHorizontal: 22, marginBottom: 16 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label={`📐 ${p.area}`} color={C.amber} />
            {p.beds  ? <Chip label={`🛏 ${p.beds} Beds`}  color={C.blue}   /> : null}
            {p.baths ? <Chip label={`🚿 ${p.baths} Baths`} color={C.purple} /> : null}
            {ppsf    ? <Chip label={`📊 ${ppsf}`}          color={C.amber}  /> : null}
            {emi     ? <Chip label={`🏦 ${emi}`}           color={C.green}  /> : null}
          </ScrollView>
          {emi && (
            <Text style={{ color: C.muted, fontSize: 10, fontFamily: FONT, marginTop: 6 }}>
              * EMI estimate at 9% p.a. over 20 yrs. Actual may vary.
            </Text>
          )}
        </View>

        <View style={{ paddingHorizontal: 22 }}>

          {/* Tags */}
          {(p.tags || []).length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
              {(p.tags || []).map(t => <Tag key={t}>{t}</Tag>)}
            </View>
          )}

          {/* Description */}
          {!!p.description && (
            <GlassCard>
              <View style={{ padding: 18 }}>
                <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", fontFamily: FONT, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>About</Text>
                <Text style={{ color: C.text, fontSize: 14, lineHeight: 24, fontFamily: FONT }}>{p.description}</Text>
              </View>
            </GlassCard>
          )}

          {/* Location */}
          <GlassCard>
            <View style={{ padding: 18 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", fontFamily: FONT, letterSpacing: 1, textTransform: "uppercase" }}>Location</Text>
                {!isSignedIn && <Chip label="🔒 Sign in to view" color={C.red} />}
              </View>

              {isSignedIn ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontSize: 28 }}>📍</Text>
                  <View>
                    <Text style={{ color: C.text, fontWeight: "700", fontSize: 14, fontFamily: FONT }}>{p.location}</Text>
                    <Text style={{ color: C.muted, fontSize: 11, fontFamily: FONT, marginTop: 2 }}>Tap to open in Maps</Text>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => router.push("/sign-in")}
                  style={{ backgroundColor: C.amber, borderRadius: 100, paddingVertical: 10, alignItems: "center" }}
                >
                  <Text style={{ color: C.ink, fontWeight: "800", fontSize: 13, fontFamily: FONT }}>Sign In to View Location</Text>
                </Pressable>
              )}
            </View>
          </GlassCard>

          {/* Owner */}
          <GlassCard>
            <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Avatar initials={isOwn ? "ME" : (p.owner_avatar || "??")} size={50} color={color} imageUrl={p.owner_image} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "800", fontSize: 15, fontFamily: FONT }}>
                  {isOwn ? "Me" : (p.owner_name + (p.verified ? "  ✓" : ""))}
                </Text>
                <Text style={{ color: (!isOwn && p.owner_active === false) ? C.red : C.muted, fontSize: 12, marginTop: 2, fontFamily: FONT }}>
                  {isOwn ? "Your listing" : (p.owner_active === false ? "⚠ No longer available" : "Property Owner")}
                </Text>
              </View>
              {isOwn && (
                <Pressable
                  onPress={() => router.push(`/property/edit/${p.id}`)}
                  style={{ backgroundColor: C.amber, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 8 }}
                >
                  <Text style={{ color: C.ink, fontWeight: "800", fontSize: 13, fontFamily: FONT }}>✏️ Edit</Text>
                </Pressable>
              )}
            </View>
          </GlassCard>

        </View>
      </ScrollView>

      {/* ── Sticky dark action panel (Screen 3) ── */}
      <View style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        backgroundColor: "#10172A",
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingTop: 16,
        paddingHorizontal: 18,
        paddingBottom: Math.max(insets.bottom, 14) + 8,
        shadowColor: C.shadow,
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.22,
        shadowRadius: 28,
        elevation: 28,
      }}>
        {isOwn ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => router.push(`/property/edit/${p.id}`)}
              style={[styles.primaryAction, { backgroundColor: C.amber }]}
            >
              <Icon name="edit" size={17} color={C.ink} strokeWidth={1.8} />
              <Text style={{ color: C.ink, fontSize: 15, fontFamily: FONT_MED }}>Edit Listing</Text>
            </Pressable>
            <Pressable onPress={share} style={styles.iconAction}>
              <Icon name="send" size={18} color="#fff" strokeWidth={1.7} />
            </Pressable>
          </View>
        ) : p.owner_active === false ? (
          <View style={{ alignItems: "center", paddingVertical: 6, gap: 4 }}>
            <Text style={{ color: "#fff", fontSize: 14, fontFamily: FONT_MED }}>Owner no longer available</Text>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: FONT, textAlign: "center" }}>
              This account has been removed. You can't contact this owner.
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Pressable
              onPress={() => { if (!isSignedIn) { router.push("/sign-in"); return; } router.push(`/chat/${p.id}?peer=${p.clerk_user_id}`); }}
              style={[styles.primaryAction, { backgroundColor: C.amber }]}
            >
              <Icon name="chat" size={18} color={C.ink} strokeWidth={1.7} />
              <Text style={{ color: C.ink, fontSize: 15, fontFamily: FONT_MED }}>Chat with Owner</Text>
            </Pressable>
            {hasPhone ? (
              <>
                <Pressable onPress={call} style={styles.iconAction}>
                  <Icon name="phone" size={19} color="#fff" strokeWidth={1.7} />
                </Pressable>
                <Pressable onPress={whatsapp} style={[styles.iconAction, { backgroundColor: "#25D366", borderColor: "transparent" }]}>
                  <Icon name="whatsapp" size={23} color="#fff" />
                </Pressable>
              </>
            ) : (
              <Pressable onPress={share} style={styles.iconAction}>
                <Icon name="send" size={18} color="#fff" strokeWidth={1.7} />
              </Pressable>
            )}
          </View>
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  primaryAction: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  iconAction: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
});

const navBtnStyle = () => ({
  width: 42, height: 42,
  backgroundColor: C.glassBg,
  borderRadius: 100,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: C.glassBorder,
  shadowColor: C.shadow,
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.14,
  shadowRadius: 8,
  elevation: 3,
});
