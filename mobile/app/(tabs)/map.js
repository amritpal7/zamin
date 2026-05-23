import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { C, FONT } from "../../src/theme";
import Header from "../../src/components/Header";
import NeoBox from "../../src/components/NeoBox";
import NeoButton from "../../src/components/NeoButton";
import { SEED_PROPERTIES } from "../../src/data/properties";

let MapView, Marker;
if (Platform.OS !== "web") {
  const Maps = require("react-native-maps");
  MapView = Maps.default;
  Marker = Maps.Marker;
}

export default function MapScreen() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [selected, setSelected] = useState(null);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 }}>
        {!isSignedIn && (
          <View style={{ borderColor: C.red, borderWidth: 2.5, borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 22 }}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 14, fontFamily: FONT }}>Sign in to view locations</Text>
              <Text style={{ color: C.muted, fontSize: 12, fontFamily: FONT }}>Exact pins visible after login</Text>
            </View>
            <NeoButton title="Sign In" small onPress={() => router.push("/sign-in")} />
          </View>
        )}

        <NeoBox offset={8} shadowColor={C.amber} radius={18} fullWidth>
          <View style={{ height: 320, backgroundColor: "#0d1b14", borderRadius: 16, overflow: "hidden" }}>
            {isSignedIn && MapView ? (
              <MapView style={{ flex: 1 }} initialRegion={{ latitude: 16.5, longitude: 75, latitudeDelta: 9, longitudeDelta: 9 }}>
                {SEED_PROPERTIES.map(p => (
                  <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} title={p.title} description={p.price} onPress={() => router.push(`/property/${p.id}`)} />
                ))}
              </MapView>
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 40 }}>🗺️</Text>
                <Text style={{ color: isSignedIn ? C.amber : C.muted, fontFamily: FONT, marginTop: 12, fontWeight: "700", textAlign: "center" }}>
                  {isSignedIn ? `${SEED_PROPERTIES.length} properties on map` : "Sign in to unlock map"}
                </Text>
                {Platform.OS === "web" && <Text style={{ color: C.muted, fontSize: 11, marginTop: 6, fontFamily: FONT }}>(Native map on device)</Text>}
              </View>
            )}
          </View>
        </NeoBox>

        {/* List below map */}
        <View style={{ marginTop: 16, gap: 10 }}>
          {SEED_PROPERTIES.map(p => {
            const active = selected === p.id;
            return (
              <Pressable key={p.id} onPress={() => { setSelected(p.id); router.push(`/property/${p.id}`); }}
                style={{ backgroundColor: active ? C.amber : C.card, borderColor: C.ink, borderWidth: 2.5, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text style={{ fontSize: 28 }}>{p.img}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", fontSize: 14, color: active ? C.ink : C.text, fontFamily: FONT }}>{p.title}</Text>
                  <Text style={{ fontSize: 12, color: active ? C.ink : C.muted, fontFamily: FONT }}>📍 {p.location}</Text>
                </View>
                <Text style={{ fontWeight: "900", color: active ? C.ink : C.amber, fontFamily: FONT }}>{p.price}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
