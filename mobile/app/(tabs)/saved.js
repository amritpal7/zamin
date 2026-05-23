import React, { useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { C, FONT } from "../../src/theme";
import Header from "../../src/components/Header";
import NeoButton from "../../src/components/NeoButton";
import PropertyCard from "../../src/components/PropertyCard";
import { useApi } from "../../src/hooks/useApi";

export default function Saved() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(false);

  // Refetch every time the tab gains focus so additions from other screens appear immediately.
  // apiRef avoids putting api in deps (Clerk's getToken isn't stable, causing infinite loops).
  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn) return;
      setLoading(true);
      apiRef.current.getSaved().then(setSaved).catch(() => {}).finally(() => setLoading(false));
    }, [isSignedIn])
  );

  const unsave = async (p) => {
    setSaved(prev => prev.filter(x => x.id !== p.id));
    api.unsaveProperty(p.id).catch(() => setSaved(prev => [...prev, p]));
  };

  if (!isSignedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Header />
        <View style={{ alignItems: "center", paddingTop: 60 }}>
          <Text style={{ fontSize: 46, marginBottom: 16 }}>❤️</Text>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", fontFamily: FONT, marginBottom: 16 }}>Sign in to save properties</Text>
          <NeoButton title="Sign In →" onPress={() => router.push("/sign-in")} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: C.text, fontFamily: FONT, marginBottom: 16 }}>Saved Properties</Text>
        {loading && <ActivityIndicator color={C.amber} style={{ marginTop: 40 }} />}
        {!loading && saved.length === 0 && (
          <Text style={{ textAlign: "center", paddingTop: 50, color: C.muted, fontSize: 13, fontFamily: FONT }}>No saved properties yet. Tap ❤️ to save.</Text>
        )}
        {saved.map(p => (
          <PropertyCard key={p.id} property={p} saved onSave={() => unsave(p)} onPress={() => router.push(`/property/${p.id}`)} />
        ))}
      </ScrollView>
    </View>
  );
}
