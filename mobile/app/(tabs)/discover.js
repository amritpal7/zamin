import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { C, FONT } from "../../src/theme";
import Header from "../../src/components/Header";
import NeoBox from "../../src/components/NeoBox";
import PropertyCard from "../../src/components/PropertyCard";
import { SEED_PROPERTIES } from "../../src/data/properties";
import { useApi } from "../../src/hooks/useApi";

function Chip({ label, active, color, onPress }) {
  return active ? (
    <Pressable onPress={onPress} style={{ marginRight: 8 }}>
      <View>
        <View style={{ position: "absolute", left: 3, top: 3, right: -3, bottom: -3, backgroundColor: C.ink, borderRadius: 10 }} />
        <View style={{ backgroundColor: color, borderColor: C.ink, borderWidth: 2.5, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: C.ink, fontFamily: FONT }}>{label}</Text>
        </View>
      </View>
    </Pressable>
  ) : (
    <Pressable onPress={onPress} style={{ backgroundColor: C.card, borderColor: C.ink, borderWidth: 2.5, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7, marginRight: 8 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: C.muted, fontFamily: FONT }}>{label}</Text>
    </Pressable>
  );
}

export default function Discover() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;
  const [properties, setProperties] = useState(SEED_PROPERTIES);
  const [saved, setSaved] = useState([]);
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getProperties({ type, status, search });
      setProperties(data);
    } catch {
      setProperties(SEED_PROPERTIES); // fallback to seed
    } finally {
      setLoading(false);
    }
  }, [type, status, search]);

  useEffect(() => { load(); }, [load]);

  // Refresh saved IDs on focus so heart icons are correct after saves/unsaves on other screens.
  // Only refreshes IDs — property list is already filter-driven via useEffect([load]).
  // apiRef avoids putting api in deps (Clerk's getToken isn't stable, causing infinite loops).
  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn) return;
      apiRef.current.getSaved().then(data => setSaved(data.map(p => p.id))).catch(() => {});
    }, [isSignedIn])
  );

  const toggleSave = async (p) => {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    const isSaved = saved.includes(p.id);
    setSaved(prev => isSaved ? prev.filter(id => id !== p.id) : [...prev, p.id]);
    try {
      isSaved ? await api.unsaveProperty(p.id) : await api.saveProperty(p.id);
    } catch {
      setSaved(prev => isSaved ? [...prev, p.id] : prev.filter(id => id !== p.id)); // rollback
    }
  };

  const filtered = properties.filter(p =>
    (type === "All" || p.type === type) && (status === "All" || p.status === status)
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Search */}
        <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
          <NeoBox offset={4} fullWidth>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, paddingVertical: 11 }}>
              <Text style={{ fontSize: 16 }}>🔍</Text>
              <TextInput value={search} onChangeText={setSearch} onSubmitEditing={load} placeholder="Search city, locality, landmark..." placeholderTextColor={C.muted} style={{ flex: 1, color: C.text, fontSize: 14, fontFamily: FONT }} returnKeyType="search" />
            </View>
          </NeoBox>
        </View>

        {/* Type filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingTop: 14 }} contentContainerStyle={{ paddingHorizontal: 18 }}>
          {["All","House","Apartment","Land"].map(f => <Chip key={f} label={f} active={type===f} color={C.amber} onPress={() => setType(f)} />)}
        </ScrollView>

        {/* Status filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingTop: 8, paddingBottom: 4 }} contentContainerStyle={{ paddingHorizontal: 18 }}>
          {["All","For Sale","For Rent"].map(f => <Chip key={f} label={f} active={status===f} color={C.blue} onPress={() => setStatus(f)} />)}
        </ScrollView>

        <View style={{ paddingHorizontal: 18, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: C.amber, fontSize: 13, fontWeight: "700", fontFamily: FONT }}>{filtered.length} properties found</Text>
          {loading && <ActivityIndicator size="small" color={C.amber} />}
        </View>

        <View style={{ paddingHorizontal: 18 }}>
          {filtered.map(p => (
            <PropertyCard key={p.id} property={p} saved={saved.includes(p.id)} onPress={() => router.push(`/property/${p.id}`)} onSave={() => toggleSave(p)} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
