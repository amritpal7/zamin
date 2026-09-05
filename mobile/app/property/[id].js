import { useTheme } from "../../src/context/ThemeContext";
import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, Dimensions, Platform,
  Linking, Alert, ActivityIndicator, Share, StyleSheet, Modal,
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

// ── "What's nearby" via OpenStreetMap Overpass (free, no key). Best-effort. ──
const NEARBY_RADIUS_M = 1200;
function metresBetween(aLat, aLng, bLat, bLng) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function categorize(tags = {}) {
  const a = tags.amenity, s = tags.shop, r = tags.railway, pt = tags.public_transport;
  if (["school", "college", "university"].includes(a)) return { icon: "🎓", cat: "School" };
  if (["hospital", "clinic", "doctors"].includes(a))   return { icon: "🏥", cat: "Hospital" };
  if (a === "pharmacy")                                  return { icon: "💊", cat: "Pharmacy" };
  if (["bank", "atm"].includes(a))                       return { icon: "🏦", cat: "Bank" };
  if (["restaurant", "cafe", "fast_food"].includes(a))  return { icon: "🍽", cat: "Food" };
  if (["supermarket", "mall"].includes(s))              return { icon: "🛒", cat: "Shopping" };
  if (r === "station" || r === "subway_entrance" || pt === "station") return { icon: "🚉", cat: "Transit" };
  return null;
}
async function fetchNearby(lat, lng) {
  const q = `[out:json][timeout:15];(` +
    `node(around:${NEARBY_RADIUS_M},${lat},${lng})[amenity~"^(school|college|university|hospital|clinic|doctors|pharmacy|bank|atm|restaurant|cafe|fast_food)$"];` +
    `node(around:${NEARBY_RADIUS_M},${lat},${lng})[shop~"^(supermarket|mall)$"];` +
    `node(around:${NEARBY_RADIUS_M},${lat},${lng})[railway~"^(station|subway_entrance)$"];` +
    `node(around:${NEARBY_RADIUS_M},${lat},${lng})[public_transport=station];` +
    `);out body 80;`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST", body: "data=" + encodeURIComponent(q),
      headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: ctrl.signal,
    });
    const json = await res.json();
    const seen = new Set();
    const items = [];
    for (const el of json.elements || []) {
      const name = el.tags?.name; if (!name) continue;
      const c = categorize(el.tags); if (!c) continue;
      const key = c.cat + "|" + name; if (seen.has(key)) continue; seen.add(key);
      const m = metresBetween(lat, lng, el.lat, el.lon);
      items.push({ name, icon: c.icon, cat: c.cat, m, dist: m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km` });
    }
    items.sort((a, b) => a.m - b.m);
    return items.slice(0, 8);
  } finally { clearTimeout(timer); }
}

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

// Slot picker for requesting a viewing (day + time-of-day → ISO). Mirrors the
// chat VisitModal, but books a first-class visit via POST /visits.
function VisitBookingModal({ onClose, onSubmit }) {
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const days = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
  const slots = [{ label: "Morning", h: 10 }, { label: "Afternoon", h: 14 }, { label: "Evening", h: 17 }];
  const confirm = async () => {
    const d = new Date(days[day]); d.setHours(slots[slot].h, 0, 0, 0);
    setBusy(true);
    try { await onSubmit(d.toISOString(), note.trim()); } finally { setBusy(false); }
  };
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 }}>
          <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 20, marginBottom: 14 }}>Schedule a visit</Text>
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
          <Pressable disabled={busy} onPress={confirm} style={{ backgroundColor: C.amber, borderRadius: 100, paddingVertical: 14, alignItems: "center", opacity: busy ? 0.6 : 1 }}>
            <Text style={{ color: C.ink, fontFamily: FONT_MED, fontSize: 15 }}>{busy ? "Sending…" : "Request visit →"}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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
  const [nearby,  setNearby]  = useState([]);
  const [visitOpen, setVisitOpen] = useState(false);

  // Re-fetch whenever the screen regains focus (e.g. returning from the editor),
  // so edits show up immediately on the already-open detail screen.
  useFocusEffect(
    useCallback(() => {
      api.getProperty(id).then(setP).catch(() => {}).finally(() => setLoading(false));
      if (isSignedIn)
        api.getSaved().then(list => setSaved(list.some(x => String(x.id) === String(id)))).catch(() => {});
    }, [id, isSignedIn])
  );

  // Load "what's nearby" once we have (shown) coordinates. Best-effort; silent on failure.
  useEffect(() => {
    const lat = p?.latitude ?? p?.lat, lng = p?.longitude ?? p?.lng;
    if (!isSignedIn || p?.location_precision === "hidden" || lat == null || lng == null) { setNearby([]); return; }
    let cancelled = false;
    fetchNearby(lat, lng).then(items => { if (!cancelled) setNearby(items); }).catch(() => { if (!cancelled) setNearby([]); });
    return () => { cancelled = true; };
  }, [p?.latitude, p?.longitude, p?.location_precision, isSignedIn]);

  const toggleSave = async () => {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    setSaved(v => !v);
    try { saved ? await api.unsaveProperty(id) : await api.saveProperty(id); }
    catch { setSaved(v => !v); }
  };

  const bookVisit = async (slot, note) => {
    try {
      await api.createVisit(p.id, slot, note);
      setVisitOpen(false);
      Alert.alert("Visit requested", "The owner will confirm your viewing. Track it under Visits.", [
        { text: "View my visits", onPress: () => router.push("/visits") },
        { text: "OK" },
      ]);
    } catch (e) {
      Alert.alert("Couldn't request visit", e.message || "Please try again.");
    }
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

  // Show the listing's location. On device → jump to the in-app Map tab and center on the
  // pin. On web (map is stubbed) → open Google Maps. Uses coords when the owner shares them
  // (exact/approximate), else falls back to a locality text search on the external map.
  const openInMaps = () => {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    if (p?.location_precision === "hidden") return; // owner hid the exact spot
    const lat = p?.latitude ?? p?.lat, lng = p?.longitude ?? p?.lng;
    const hasCoords = lat != null && lng != null;

    if (Platform.OS !== "web" && hasCoords) {
      // Jump to the Map tab and locate this property (t forces a re-focus on repeat taps).
      router.push({ pathname: "/(tabs)/map", params: { lat: String(lat), lng: String(lng), focus: String(p.id), t: String(Date.now()) } });
      return;
    }
    const query = hasCoords ? `${lat},${lng}` : encodeURIComponent(p?.location || "");
    if (!query) { Alert.alert("No location", "This listing has no map location yet."); return; }
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() =>
      Alert.alert("Maps", "Couldn't open Maps.")
    );
  };

  // Turn-by-turn directions to the listing in the device Maps app.
  const getDirections = () => {
    const lat = p?.latitude ?? p?.lat, lng = p?.longitude ?? p?.lng;
    if (lat == null || lng == null) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`).catch(() =>
      Alert.alert("Directions", "Couldn't open Maps.")
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
                {p.on_site_verified
                  ? <Chip label="📍 On-site verified" color={C.green} />
                  : (!isSignedIn && <Chip label="🔒 Sign in to view" color={C.red} />)}
              </View>

              {isSignedIn ? (
                <Pressable
                  onPress={openInMaps}
                  disabled={p.location_precision === "hidden"}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                >
                  <Text style={{ fontSize: 28 }}>📍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: "700", fontSize: 14, fontFamily: FONT }}>{p.location}</Text>
                    <Text style={{ color: p.location_precision === "hidden" ? C.muted : C.amberText, fontSize: 11, fontFamily: FONT, marginTop: 2 }}>
                      {p.location_precision === "hidden"
                        ? "Exact location hidden by owner"
                        : p.location_precision === "approximate"
                          ? "Approximate area — tap to view on map"
                          : "Tap to view on map"}
                    </Text>
                  </View>
                  {p.location_precision !== "hidden" && <Icon name="forward" size={16} color={C.amberText} />}
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => router.push("/sign-in")}
                  style={{ backgroundColor: C.amber, borderRadius: 100, paddingVertical: 10, alignItems: "center" }}
                >
                  <Text style={{ color: C.ink, fontWeight: "800", fontSize: 13, fontFamily: FONT }}>Sign In to View Location</Text>
                </Pressable>
              )}

              {isSignedIn && p.location_precision !== "hidden" && (p.latitude ?? p.lat) != null && (
                <Pressable
                  onPress={getDirections}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, backgroundColor: C.chipBg, borderRadius: 100, paddingVertical: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder }}
                >
                  <Icon name="compass" size={16} color={C.fg} strokeWidth={2} />
                  <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 13 }}>Get directions</Text>
                </Pressable>
              )}
            </View>
          </GlassCard>

          {/* What's nearby */}
          {isSignedIn && nearby.length > 0 && (
            <GlassCard>
              <View style={{ padding: 18 }}>
                <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", fontFamily: FONT, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>What's nearby</Text>
                <View style={{ gap: 10 }}>
                  {nearby.map((n, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Text style={{ fontSize: 18 }}>{n.icon}</Text>
                      <Text style={{ flex: 1, color: C.text, fontSize: 13, fontFamily: FONT }} numberOfLines={1}>{n.name}</Text>
                      <Text style={{ color: C.muted, fontSize: 12, fontFamily: FONT }}>{n.dist}</Text>
                    </View>
                  ))}
                </View>
                <Text style={{ color: C.fgFaint || C.muted, fontSize: 10, fontFamily: FONT, marginTop: 12 }}>Nearby places from OpenStreetMap · approximate</Text>
              </View>
            </GlassCard>
          )}

          {/* Owner */}
          <GlassCard>
            <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Avatar initials={isOwn ? "ME" : (p.owner_avatar || "??")} size={50} color={color} imageUrl={p.owner_image} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={{ color: C.text, fontWeight: "800", fontSize: 15, fontFamily: FONT }}>
                    {isOwn ? "Me" : p.owner_name}
                  </Text>
                  {!isOwn && p.verified && (
                    <View style={{ backgroundColor: C.amber + "22", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: C.amberText, fontSize: 11, fontFamily: FONT_MED }}>✓ Verified</Text>
                    </View>
                  )}
                </View>
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

          {/* Schedule a visit — non-owners, active owner only */}
          {!isOwn && p.owner_active !== false && (
            <Pressable
              onPress={() => { if (!isSignedIn) { router.push("/sign-in"); return; } setVisitOpen(true); }}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, borderRadius: 16, paddingVertical: 14, marginBottom: 14 }}
            >
              <Icon name="clock" size={17} color={C.amberText} strokeWidth={1.7} />
              <Text style={{ color: C.amberText, fontSize: 15, fontFamily: FONT_MED }}>Schedule a visit</Text>
            </Pressable>
          )}

        </View>
      </ScrollView>

      {visitOpen && <VisitBookingModal onClose={() => setVisitOpen(false)} onSubmit={bookVisit} />}

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
