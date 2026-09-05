import { useTheme } from "../../src/context/ThemeContext";
import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Platform, StyleSheet, Modal, Linking } from "react-native";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, FONT, FONT_MED, FONT_HEAD } from "../../src/theme";
import { Icon } from "../../src/components/Icon";
import NeoButton from "../../src/components/NeoButton";
import { SEED_PROPERTIES } from "../../src/data/properties";
import { useApi } from "../../src/hooks/useApi";
import { clusterProperties, withCoords } from "../../src/utils/cluster";

let MapView, Marker, Circle;
if (Platform.OS !== "web") {
  const Maps = require("react-native-maps");
  MapView = Maps.default;
  Marker  = Maps.Marker;
  Circle  = Maps.Circle;
}

// India-wide starting view; clustering re-computes as the user pans/zooms.
const INITIAL_REGION = { latitude: 16.5, longitude: 75, latitudeDelta: 9, longitudeDelta: 9 };

// Compact price label for a map pin. Stored prices are usually strings ("₹85 L").
const priceLabel = (p) => {
  const v = p?.price;
  if (v == null || v === "") return "—";
  return typeof v === "number" ? `₹${v}` : String(v);
};

const glassCard = () => ({
  backgroundColor: C.glassBg,
  borderRadius: 20,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: C.glassBorder,
  shadowColor: C.shadow,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.12,
  shadowRadius: 16,
  elevation: 4,
});

export default function MapScreen() {
  useTheme();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;
  const mapRef = useRef(null);

  const [selected, setSelected] = useState(null);
  const [properties, setProperties] = useState(SEED_PROPERTIES);
  const [region, setRegion] = useState(INITIAL_REGION);
  const [sheet, setSheet] = useState(null); // property tapped on the map → action sheet
  const [mapType, setMapType] = useState("standard"); // standard | satellite (good for Land)
  const scrollRef = useRef(null);          // page scroll — for list↔map sync
  const listTop   = useRef(0);             // Y offset of the list container within the scroll
  const cardY     = useRef({});            // per-listing Y within the list container

  // A listing's "view on map" deep-links here with lat/lng (+ t nonce for repeat taps).
  const params = useLocalSearchParams();
  const focusLat = parseFloat(params.lat), focusLng = parseFloat(params.lng);
  const hasFocus = Number.isFinite(focusLat) && Number.isFinite(focusLng);

  // Load real listings on focus; fall back to seed if the API is unreachable.
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRef.current.getProperties();
        if (!cancelled && Array.isArray(data) && data.length) setProperties(data);
      } catch {
        if (!cancelled) setProperties(SEED_PROPERTIES);
      }
    })();
    return () => { cancelled = true; };
  }, []));

  const points   = useMemo(() => withCoords(properties), [properties]);
  const clusters = useMemo(() => clusterProperties(points, region), [points, region]);

  // Tapping a cluster zooms into its area so the group splits apart.
  const zoomToCluster = (c) => {
    const next = {
      latitude: c.lat,
      longitude: c.lng,
      latitudeDelta: Math.max(region.latitudeDelta / 2.5, 0.02),
      longitudeDelta: Math.max(region.longitudeDelta / 2.5, 0.02),
    };
    setRegion(next);
    mapRef.current?.animateToRegion(next, 350);
  };

  // "Locate on map" — center + zoom the map onto a single property's pin.
  const locateOnMap = (p) => {
    const lat = p.lat ?? p.latitude, lng = p.lng ?? p.longitude;
    setSheet(null);
    if (lat == null || lng == null) return;
    const next = { latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    setRegion(next);
    mapRef.current?.animateToRegion(next, 450);
  };

  const openDetails = (p) => { setSheet(null); router.push(`/property/${p.id}`); };

  // Open turn-by-turn directions to the pin in the device Maps app.
  const getDirections = (p) => {
    setSheet(null);
    const lat = p.lat ?? p.latitude, lng = p.lng ?? p.longitude;
    if (lat == null || lng == null) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`).catch(() => {});
  };

  // Scroll the page to a listing's card (used to sync map pin → list).
  const scrollToCard = (id) => {
    const y = cardY.current[id];
    if (y != null && scrollRef.current) scrollRef.current.scrollTo({ y: listTop.current + y - 16, animated: true });
  };

  // Tapping a pin opens the action sheet AND highlights + scrolls to its list card.
  const onPinTap = (p) => { setSelected(p.id); scrollToCard(p.id); setSheet(p); };

  // "Search this area" — re-query listings near the current map center. Radius ≈ half the
  // visible span (deg → km). Falls back silently if the API is unreachable.
  const [searching, setSearching] = useState(false);
  const searchThisArea = async () => {
    try {
      setSearching(true);
      const radiusKm = Math.min(500, Math.max(1, Math.round(region.latitudeDelta * 111 / 2)));
      const data = await apiRef.current.getProperties({ lat: region.latitude, lng: region.longitude, radius: radiusKm });
      setProperties(Array.isArray(data) ? data : []);
    } catch { /* keep current results */ } finally {
      setSearching(false);
    }
  };

  // Center on the pin when arriving from a listing's "view on map". The timeout lets the
  // MapView mount on the first navigation into the tab; repeat taps re-fire via the `t` nonce.
  useEffect(() => {
    if (!hasFocus) return;
    const r = { latitude: focusLat, longitude: focusLng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    setRegion(r);
    const id = setTimeout(() => mapRef.current?.animateToRegion(r, 500), 350);
    return () => clearTimeout(id);
  }, [params.lat, params.lng, params.t]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Inline header */}
      <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 24, paddingBottom: 16 }}>
        <Text style={{ color: C.fgDim, fontSize: 13, fontFamily: FONT, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Explore</Text>
        <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 38, fontWeight: "400", letterSpacing: -1, lineHeight: 40 }}>Map View.</Text>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 130 }}>
        {/* Signed-out notice */}
        {!isSignedIn && (
          <View style={[glassCard(), { padding: 14, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 12, borderColor: C.red + "40" }]}>
            <Text style={{ fontSize: 22 }}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 14, fontFamily: FONT }}>Sign in to view locations</Text>
              <Text style={{ color: C.muted, fontSize: 12, fontFamily: FONT }}>Exact pins visible after login</Text>
            </View>
            <NeoButton title="Sign In" small onPress={() => router.push("/sign-in")} />
          </View>
        )}

        {/* Map card */}
        <View style={[glassCard(), { marginBottom: 18, overflow: "hidden", height: 320 }]}>
          {isSignedIn && MapView ? (
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              mapType={mapType}
              initialRegion={hasFocus ? { latitude: focusLat, longitude: focusLng, latitudeDelta: 0.01, longitudeDelta: 0.01 } : INITIAL_REGION}
              onRegionChangeComplete={setRegion}
            >
              {clusters.map((c) =>
                c.type === "cluster" ? (
                  <Marker
                    key={c.key}
                    coordinate={{ latitude: c.lat, longitude: c.lng }}
                    onPress={() => zoomToCluster(c)}
                  >
                    <View style={styles.clusterBubble}>
                      <Text style={styles.clusterCount}>{c.count}</Text>
                    </View>
                  </Marker>
                ) : (
                  // Single listing → a price-bubble pin (approximate also draws its area circle).
                  <React.Fragment key={c.key}>
                    {c.property.location_precision === "approximate" && (
                      <Circle
                        center={{ latitude: c.lat, longitude: c.lng }}
                        radius={c.property.location_radius_m || 400}
                        strokeColor={C.amber}
                        fillColor={C.amber + "33"}
                        strokeWidth={1.5}
                      />
                    )}
                    <Marker
                      coordinate={{ latitude: c.lat, longitude: c.lng }}
                      anchor={{ x: 0.5, y: 1 }}
                      onPress={() => onPinTap(c.property)}
                    >
                      <View style={styles.priceBubble}>
                        <Text style={styles.priceText} numberOfLines={1}>{priceLabel(c.property)}</Text>
                      </View>
                    </Marker>
                  </React.Fragment>
                )
              )}
            </MapView>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
              <Icon name="map" size={44} color={isSignedIn ? C.amber : C.fgDim} strokeWidth={1.2} />
              <Text style={{ color: isSignedIn ? C.amber : C.fgDim, fontFamily: FONT_MED, textAlign: "center" }}>
                {isSignedIn ? `${points.length} properties on map` : "Sign in to unlock map"}
              </Text>
              {Platform.OS === "web" && (
                <Text style={{ color: C.fgDim, fontSize: 11, fontFamily: FONT }}>(Native map on device)</Text>
              )}
            </View>
          )}

          {/* Search-this-area — re-query listings around the current map center */}
          {isSignedIn && MapView && (
            <Pressable
              onPress={searchThisArea}
              disabled={searching}
              style={{
                position: "absolute", top: 12, alignSelf: "center",
                flexDirection: "row", alignItems: "center", gap: 6,
                backgroundColor: C.bg, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8,
                borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder,
                shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 4,
              }}
            >
              <Icon name="search" size={14} color={C.amber} strokeWidth={2} />
              <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 12 }}>
                {searching ? "Searching…" : "Search this area"}
              </Text>
            </Pressable>
          )}

          {/* Satellite / standard toggle — satellite is handy for Land/plots */}
          {isSignedIn && MapView && (
            <Pressable
              onPress={() => setMapType(t => (t === "standard" ? "satellite" : "standard"))}
              style={{
                position: "absolute", top: 12, right: 12,
                backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
                borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder,
                shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
              }}
            >
              <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 11 }}>
                {mapType === "standard" ? "🛰 Satellite" : "🗺 Standard"}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Property list */}
        <Text style={{ color: C.fg, fontSize: 22, letterSpacing: -0.4, fontFamily: FONT_HEAD, marginBottom: 12 }}>
          {properties.length} Properties
        </Text>
        <View style={{ gap: 10 }} onLayout={e => { listTop.current = e.nativeEvent.layout.y; }}>
          {properties.map(p => {
            const active = selected === p.id;
            return (
              <Pressable
                key={p.id}
                onLayout={e => { cardY.current[p.id] = e.nativeEvent.layout.y; }}
                onPress={() => { setSelected(p.id); setSheet(p); }}
                style={[glassCard(), {
                  padding: 14, flexDirection: "row", alignItems: "center", gap: 12,
                  backgroundColor: active ? C.amber : C.glassBg,
                }]}
              >
                <Text style={{ fontSize: 28 }}>{p.img || "🏠"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: active ? C.ink : C.fg, fontFamily: FONT_MED }}>{p.title}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Icon name="pin" size={11} color={active ? C.ink : C.fgDim} />
                    <Text style={{ fontSize: 12, color: active ? C.ink : C.fgDim, fontFamily: FONT }}>{p.location}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 14, color: active ? C.ink : C.amber, fontFamily: FONT_MED }}>
                  {typeof p.price === "number" ? `₹${p.price}` : p.price}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Map pin tap → action sheet: view details or locate on map */}
      {sheet && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setSheet(null)}>
          <Pressable onPress={() => setSheet(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
            <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 20, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder }}>
              <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassBorder, marginBottom: 4 }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <Text style={{ fontSize: 26 }}>{sheet.img || "🏠"}</Text>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 15 }}>{sheet.title}</Text>
                  <Text numberOfLines={1} style={{ color: C.fgDim, fontFamily: FONT, fontSize: 12, marginTop: 2 }}>{sheet.location}</Text>
                </View>
                <Text style={{ color: C.amber, fontFamily: FONT_MED, fontSize: 14 }}>
                  {typeof sheet.price === "number" ? `₹${sheet.price}` : sheet.price}
                </Text>
              </View>

              <Pressable onPress={() => openDetails(sheet)} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.amber, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16 }}>
                <Icon name="search" size={18} color={C.ink} strokeWidth={2} />
                <Text style={{ color: C.ink, fontFamily: FONT_MED, fontSize: 14 }}>View more details</Text>
              </Pressable>

              {((sheet.lat ?? sheet.latitude) != null && (sheet.lng ?? sheet.longitude) != null) && (
                <>
                  <Pressable onPress={() => locateOnMap(sheet)} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.chipBg, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder }}>
                    <Icon name="pin" size={18} color={C.fg} strokeWidth={2} />
                    <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 14 }}>Locate on map</Text>
                  </Pressable>
                  <Pressable onPress={() => getDirections(sheet)} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.chipBg, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder }}>
                    <Icon name="compass" size={18} color={C.fg} strokeWidth={2} />
                    <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 14 }}>Get directions</Text>
                  </Pressable>
                </>
              )}

              <Pressable onPress={() => setSheet(null)} style={{ alignItems: "center", paddingVertical: 8 }}>
                <Text style={{ color: C.fgDim, fontFamily: FONT, fontSize: 13 }}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  clusterBubble: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 8,
    borderRadius: 19,
    backgroundColor: C.amber,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  clusterCount: {
    color: C.ink,
    fontFamily: FONT_MED,
    fontSize: 14,
    fontWeight: "700",
  },
  priceBubble: {
    backgroundColor: C.amber,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: "#fff",
    maxWidth: 120,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 4,
    elevation: 4,
  },
  priceText: {
    color: C.ink,
    fontFamily: FONT_MED,
    fontSize: 12,
    fontWeight: "700",
  },
});
