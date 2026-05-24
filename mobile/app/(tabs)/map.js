import { useTheme } from "../../src/context/ThemeContext";
import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Platform, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, FONT, FONT_MED, FONT_HEAD } from "../../src/theme";
import { Icon } from "../../src/components/Icon";
import NeoButton from "../../src/components/NeoButton";
import { SEED_PROPERTIES } from "../../src/data/properties";

let MapView, Marker;
if (Platform.OS !== "web") {
  const Maps = require("react-native-maps");
  MapView = Maps.default;
  Marker  = Maps.Marker;
}

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
  const [selected, setSelected] = useState(null);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Inline header */}
      <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 24, paddingBottom: 16 }}>
        <Text style={{ color: C.fgDim, fontSize: 13, fontFamily: FONT, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Explore</Text>
        <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 38, fontWeight: "400", letterSpacing: -1, lineHeight: 40 }}>Map View.</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 130 }}>
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
              style={{ flex: 1 }}
              initialRegion={{ latitude: 16.5, longitude: 75, latitudeDelta: 9, longitudeDelta: 9 }}
            >
              {SEED_PROPERTIES.map(p => (
                <Marker
                  key={p.id}
                  coordinate={{ latitude: p.lat, longitude: p.lng }}
                  title={p.title}
                  description={p.price}
                  onPress={() => router.push(`/property/${p.id}`)}
                />
              ))}
            </MapView>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
              <Icon name="map" size={44} color={isSignedIn ? C.amber : C.fgDim} strokeWidth={1.2} />
              <Text style={{ color: isSignedIn ? C.amber : C.fgDim, fontFamily: FONT_MED, textAlign: "center" }}>
                {isSignedIn ? `${SEED_PROPERTIES.length} properties on map` : "Sign in to unlock map"}
              </Text>
              {Platform.OS === "web" && (
                <Text style={{ color: C.fgDim, fontSize: 11, fontFamily: FONT }}>(Native map on device)</Text>
              )}
            </View>
          )}
        </View>

        {/* Property list */}
        <Text style={{ color: C.fg, fontSize: 22, letterSpacing: -0.4, fontFamily: FONT_HEAD, marginBottom: 12 }}>
          {SEED_PROPERTIES.length} Properties
        </Text>
        <View style={{ gap: 10 }}>
          {SEED_PROPERTIES.map(p => {
            const active = selected === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => { setSelected(p.id); router.push(`/property/${p.id}`); }}
                style={[glassCard(), {
                  padding: 14, flexDirection: "row", alignItems: "center", gap: 12,
                  backgroundColor: active ? C.amber : C.glassBg,
                }]}
              >
                <Text style={{ fontSize: 28 }}>{p.img}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: active ? C.ink : C.fg, fontFamily: FONT_MED }}>{p.title}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Icon name="pin" size={11} color={active ? C.ink : C.fgDim} />
                    <Text style={{ fontSize: 12, color: active ? C.ink : C.fgDim, fontFamily: FONT }}>{p.location}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 14, color: active ? C.ink : C.amber, fontFamily: FONT_MED }}>₹{p.price}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
