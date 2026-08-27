import { useTheme } from "../../src/context/ThemeContext";
import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, RefreshControl, StyleSheet, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, FONT, FONT_MED, FONT_HEAD, FONT_HEAD_ITALIC } from "../../src/theme";
import { Icon } from "../../src/components/Icon";
import SmartImage from "../../src/components/SmartImage";
import PropertyCard from "../../src/components/PropertyCard";
import { Avatar } from "../../src/components/ui";
import { SEED_PROPERTIES } from "../../src/data/properties";
import { useApi } from "../../src/hooks/useApi";

const TYPE_FILTERS   = ["All", "House", "Apartment", "Land", "Commercial"];
const STATUS_FILTERS = ["All", "For Sale", "For Rent"];

function Chip({ label, active, onPress }) {
  const { mode } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? C.fg : C.glassBg,
          borderColor: active ? "transparent" : C.glassBorder,
        },
      ]}
    >
      <Text style={[styles.chipLabel, { color: active ? C.bg : C.fg, fontFamily: FONT_MED }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SmallCard({ property: p, onPress }) {
  const ambientColor = p.color || C.amber;
  return (
    <Pressable onPress={onPress} style={[styles.smallCard, { backgroundColor: C.glassBg, borderColor: C.glassBorder }]}>
      {/* mini hero */}
      <View style={styles.smallHero}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: ambientColor + "45" }]} />
        {p.images?.length
          ? <SmartImage uri={p.thumbnails?.[0] || p.images[0]} style={StyleSheet.absoluteFill} />
          : <Text style={styles.smallEmoji}>{p.img || "🏠"}</Text>}
      </View>
      <View style={styles.smallBody}>
        <View style={styles.smallRegionRow}>
          <Icon name="pin" size={11} color={C.fgDim} />
          <Text style={[styles.smallRegion, { color: C.fgDim, fontFamily: FONT }]}>
            {p.location?.split(",")[0] || "India"}
          </Text>
        </View>
        <Text style={[styles.smallTitle, { color: C.fg, fontFamily: FONT_HEAD }]} numberOfLines={2}>
          {p.title}
        </Text>
        <View style={styles.smallMeta}>
          <View style={styles.ratingRow}>
            <Icon name="star" size={11} color={C.amber} />
            <Text style={[styles.metaText, { color: C.fgDim, fontFamily: FONT }]}>
              {p.beds ? `${p.beds} bed` : p.type || "Property"}
            </Text>
          </View>
          <Text style={[styles.priceText, { color: C.fg, fontFamily: FONT_MED }]}>₹{p.price}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function Discover() {
  useTheme();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const api     = useApi();
  const apiRef  = useRef(api);
  apiRef.current = api;

  const [properties, setProperties] = useState(SEED_PROPERTIES);
  const [saved,      setSaved]      = useState([]);
  const [type,       setType]       = useState("All");
  const [status,     setStatus]     = useState("All");
  const [search,     setSearch]     = useState("");
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [geo,        setGeo]        = useState(null);  // { lat, lng } when "Near me" active
  const [locating,   setLocating]   = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const data = await apiRef.current.getProperties({
        type, status, search,
        ...(geo ? { lat: geo.lat, lng: geo.lng, radius: 25 } : {}),
      });
      setProperties(data);
    } catch {
      setProperties(SEED_PROPERTIES);
    } finally { setLoading(false); setRefreshing(false); }
  }, [type, status, search, geo]);

  // Reload the list on mount, when filters change, AND whenever Home regains
  // focus (e.g. returning after editing/posting) so cards show fresh images.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn) return;
      apiRef.current.getSaved().then(d => setSaved(d.map(p => p.id))).catch(() => {});
    }, [isSignedIn])
  );

  const toggleNearMe = async () => {
    if (geo) { setGeo(null); return; }
    try {
      setLocating(true);
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== "granted") { Alert.alert("Location needed", "Allow location access to find nearby listings."); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGeo({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      Alert.alert("Couldn't get location", "Please try again.");
    } finally {
      setLocating(false);
    }
  };

  const saveSearch = async () => {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    try {
      await apiRef.current.createSavedSearch({ type, status, search });
      Alert.alert("Search saved", "We'll notify you when new listings match this search.");
    } catch {
      Alert.alert("Couldn't save", "Please try again.");
    }
  };

  const toggleSave = async (p) => {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    const isSaved = saved.includes(p.id);
    setSaved(prev => isSaved ? prev.filter(id => id !== p.id) : [...prev, p.id]);
    try { isSaved ? await api.unsaveProperty(p.id) : await api.saveProperty(p.id); }
    catch { setSaved(prev => isSaved ? [...prev, p.id] : prev.filter(id => id !== p.id)); }
  };

  const filtered = properties.filter(p =>
    (type === "All" || p.type === type) &&
    (status === "All" || p.status === status)
  );

  const featured  = filtered[0];
  const rest      = filtered.slice(1);
  // Username-first accounts have no first/last name — fall back to the username.
  const username  = user?.username ?? user?.unsafeMetadata?.username ?? null;
  const firstName = user?.firstName || username || "there";
  const initials  = user ? (`${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || username?.[0]?.toUpperCase() || "ME") : "?";
  const ambientTone = featured?.color || C.amber;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>

      {/* ── Ambient tinted background ── */}
      <View style={styles.ambientWrap} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: ambientTone + "35" }]} />
        <LinearGradient
          colors={["transparent", C.bg]}
          locations={[0, 0.88]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.amber} colors={[C.amber]} />
        }
      >

        {/* ── Header row ── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => isSignedIn ? router.navigate("/(tabs)/profile") : router.push("/sign-in")}
            style={[styles.greeting, { backgroundColor: C.glassBg, borderColor: C.glassBorder }]}
          >
            {isSignedIn
              ? (
                user?.hasImage ? (
                  <Image source={{ uri: user.imageUrl }} style={styles.greetAvatar} contentFit="cover" />
                ) : (
                  <LinearGradient
                    colors={[C.amber + "cc", C.accent?.deep || "#B86A26"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.greetAvatar}
                  >
                    <Text style={[styles.greetAvatarTxt, { fontFamily: FONT_HEAD }]}>{initials[0]}</Text>
                  </LinearGradient>
                )
              )
              : (
                <View style={[styles.greetAvatar, { backgroundColor: C.chipBg }]}>
                  <Icon name="user" size={16} color={C.fgDim} />
                </View>
              )
            }
            <Text style={[styles.greetTxt, { color: C.fg, fontFamily: FONT }]}>
              {isSignedIn ? `Hello, ${firstName}` : "Welcome"}
            </Text>
            <Icon name="chevD" size={14} color={C.fgDim} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => router.push("/notifications")}
            style={[styles.iconBtn, { backgroundColor: C.glassBg, borderColor: C.glassBorder }]}
          >
            <Icon name="bell" size={18} color={C.fg} />
          </Pressable>
        </View>

        {/* ── Serif headline ── */}
        <View style={styles.headlineWrap}>
          <Text style={[styles.h1, { color: C.fg, fontFamily: FONT_HEAD }]}>
            Find your
          </Text>
          <Text style={[styles.h1, { color: C.fgDim, fontFamily: FONT_HEAD_ITALIC, fontStyle: "italic" }]}>
            dream home.
          </Text>
        </View>

        {/* ── Search bar ── */}
        <Pressable
          style={[styles.search, { backgroundColor: C.glassBg, borderColor: C.glassBorder }]}
          onPress={() => {}}
        >
          <Icon name="mic" size={18} color={C.fgDim} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => load()}
            placeholder="Search city, area, landmark…"
            placeholderTextColor={C.fgDim}
            returnKeyType="search"
            style={[styles.searchInput, { color: C.fg, fontFamily: FONT }]}
          />
          {loading
            ? <ActivityIndicator size="small" color={C.amber} style={{ marginRight: 4 }} />
            : (
              <LinearGradient
                colors={[C.amber + "dd", "#F0A65A", "#B86A26"]}
                start={{ x: 0.2, y: 0.2 }} end={{ x: 1, y: 1 }}
                style={styles.sendDisc}
              >
                <Icon name="send" size={15} color="#1A0A00" strokeWidth={1.8} />
              </LinearGradient>
            )
          }
        </Pressable>

        {/* ── Filter chips ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {TYPE_FILTERS.map(f => (
            <Chip key={f} label={f} active={type === f} onPress={() => setType(f)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingTop: 8 }]}>
          {STATUS_FILTERS.map(f => (
            <Chip key={f} label={f} active={status === f} onPress={() => setStatus(f)} />
          ))}
        </ScrollView>

        {/* Near me toggle */}
        <View style={{ flexDirection: "row", paddingHorizontal: 18, paddingTop: 12 }}>
          <Pressable
            onPress={toggleNearMe}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: geo ? C.amber : C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: geo ? "transparent" : C.glassBorder, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }}
          >
            {locating
              ? <ActivityIndicator size="small" color={geo ? C.ink : C.amber} />
              : <Icon name="pin" size={14} color={geo ? C.ink : C.amberText} />}
            <Text style={{ color: geo ? C.ink : C.amberText, fontFamily: FONT_MED, fontSize: 13 }}>{geo ? "Near me · on" : "Near me"}</Text>
          </Pressable>
        </View>

        {/* Save this search → get alerts on new matches */}
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingTop: 12 }}>
          <Pressable
            onPress={saveSearch}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, borderRadius: 999, paddingVertical: 11 }}
          >
            <Icon name="bell" size={15} color={C.amberText} />
            <Text style={{ color: C.amberText, fontFamily: FONT_MED, fontSize: 13 }}>Save this search · get alerts</Text>
          </Pressable>
          <Pressable
            onPress={() => (isSignedIn ? router.push("/saved-searches") : router.push("/sign-in"))}
            style={{ width: 46, alignItems: "center", justifyContent: "center", backgroundColor: C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, borderRadius: 999 }}
          >
            <Icon name="bookmark" size={16} color={C.fg} />
          </Pressable>
        </View>

        {/* ── Featured card ── */}
        {featured && (
          <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
            <PropertyCard
              property={featured}
              featured
              saved={saved.includes(featured.id)}
              isOwn={!!userId && featured.clerk_user_id === userId}
              onPress={() => router.push(`/property/${featured.id}`)}
              onSave={() => toggleSave(featured)}
            />
          </View>
        )}

        {/* ── More listings ── */}
        {rest.length > 0 && (
          <>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: C.fg, fontFamily: FONT_HEAD }]}>More listings</Text>
              <Text style={[styles.seeAll, { color: C.fgDim, fontFamily: FONT }]}>{rest.length} found</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {rest.slice(0, 6).map(p => (
                <SmallCard
                  key={p.id}
                  property={p}
                  onPress={() => router.push(`/property/${p.id}`)}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* ── Market insights strip ── */}
        <View style={{ paddingHorizontal: 18, paddingTop: 24 }}>
          <View style={[styles.insightsCard, { backgroundColor: C.glassBg, borderColor: C.glassBorder }]}>
            <LinearGradient
              colors={[C.amber + "cc", "#B86A26"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.sparkBox}
            >
              <Icon name="sparkle" size={18} color="#1A0A00" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.aiTitle, { color: C.fg, fontFamily: FONT_MED }]}>
                {filtered.length} listings · No brokerage
              </Text>
              <Text style={[styles.aiSub, { color: C.fgDim, fontFamily: FONT }]}>
                Direct owner listings, free to browse
              </Text>
            </View>
            <Icon name="chevR" size={18} color={C.fgDim} />
          </View>
        </View>

        {/* ── All remaining ── */}
        {rest.length > 0 && (
          <View style={{ paddingHorizontal: 18, paddingTop: 28 }}>
            <Text style={[styles.sectionTitle, { color: C.fg, fontFamily: FONT_HEAD, marginBottom: 16 }]}>
              All properties
            </Text>
            {rest.map(p => (
              <PropertyCard
                key={p.id}
                property={p}
                saved={saved.includes(p.id)}
                isOwn={!!userId && p.clerk_user_id === userId}
                onPress={() => router.push(`/property/${p.id}`)}
                onSave={() => toggleSave(p)}
              />
            ))}
          </View>
        )}

        {filtered.length === 0 && !loading && (
          <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 40 }}>
            <Text style={{ fontSize: 46, marginBottom: 16 }}>🏘</Text>
            <Text style={{ color: C.fgDim, fontSize: 15, fontFamily: FONT, textAlign: "center", lineHeight: 22 }}>
              No properties found.{"\n"}Try a different search.
            </Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, position: "relative" },
  ambientWrap: { position: "absolute", top: 0, left: 0, right: 0, height: 500 },

  header: { paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 10 },
  greeting: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 5, paddingRight: 14, borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  greetAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  greetAvatarTxt: { color: "#1A0A00", fontSize: 16 },
  greetTxt: { fontSize: 13 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },

  headlineWrap: { paddingHorizontal: 22, paddingTop: 28 },
  h1: { fontSize: 44, lineHeight: 44, letterSpacing: -1.4 },

  search: {
    marginHorizontal: 18, marginTop: 22,
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingLeft: 14, padding: 6,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 14, height: 38 },
  sendDisc: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },

  chips: { paddingHorizontal: 18, paddingTop: 18, gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chipLabel: { fontSize: 13 },

  sectionHead: {
    paddingHorizontal: 22, paddingTop: 24,
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 22, letterSpacing: -0.4 },
  seeAll: { fontSize: 12 },

  row: { paddingHorizontal: 18, paddingTop: 14, gap: 12 },

  smallCard: { width: 168, borderRadius: 22, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  smallHero: { height: 150, alignItems: "center", justifyContent: "center" },
  smallEmoji: { fontSize: 52 },
  smallBody: { padding: 14 },
  smallRegionRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  smallRegion: { fontSize: 11 },
  smallTitle: { fontSize: 17, letterSpacing: -0.2, lineHeight: 20 },
  smallMeta: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 11 },
  priceText: { fontSize: 11 },

  insightsCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 16, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth,
  },
  sparkBox: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  aiTitle: { fontSize: 13 },
  aiSub: { fontSize: 11, marginTop: 2 },
});
