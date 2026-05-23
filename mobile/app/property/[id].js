import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Linking, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { C, FONT } from "../../src/theme";
import NeoBox from "../../src/components/NeoBox";
import NeoButton from "../../src/components/NeoButton";
import { Tag, Avatar } from "../../src/components/ui";
import { useApi } from "../../src/hooks/useApi";
import { SEED_PROPERTIES } from "../../src/data/properties";

const StatBox = ({ children }) => (
  <View style={{ backgroundColor: C.bg, borderColor: C.ink, borderWidth: 2.5, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 7 }}>
    <Text style={{ color: C.amber, fontSize: 12, fontWeight: "700", fontFamily: FONT }}>{children}</Text>
  </View>
);

export default function PropertyDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const api = useApi();
  const [p, setP] = useState(() => SEED_PROPERTIES.find(x => String(x.id) === String(id)) || null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(!p);

  useEffect(() => {
    api.getProperty(id).then(setP).catch(() => {}).finally(() => setLoading(false));
    if (isSignedIn) api.getSaved().then(list => setSaved(list.some(x => String(x.id) === String(id)))).catch(() => {});
  }, [id, isSignedIn]);

  const toggleSave = async () => {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    setSaved(v => !v);
    try { saved ? await api.unsaveProperty(id) : await api.saveProperty(id); }
    catch { setSaved(v => !v); }
  };

  const call = () => {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    const phone = p?.owner_phone?.replace(/\s/g, "");
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert("Call", `Calling ${p.owner_phone}...`));
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.amber} size="large" /></View>;
  if (!p) return null;

  const color = p.color || C.amber;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Hero */}
        <View style={{ height: 200, backgroundColor: color + "25", alignItems: "center", justifyContent: "center", borderBottomWidth: 3, borderBottomColor: C.ink }}>
          <Text style={{ fontSize: 84 }}>{p.img || "🏠"}</Text>
          <View style={{ position: "absolute", top: 54, right: 16, flexDirection: "row", gap: 8 }}>
            <Pressable onPress={toggleSave} style={{ width: 40, height: 40, backgroundColor: C.card, borderColor: C.ink, borderWidth: 2.5, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 16 }}>{saved ? "❤️" : "🤍"}</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, backgroundColor: C.red, borderColor: C.ink, borderWidth: 2.5, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: C.ink, fontFamily: FONT }}>×</Text>
            </Pressable>
          </View>
          <View style={{ position: "absolute", bottom: 14, left: 16 }}>
            <Tag color={p.status === "For Sale" ? C.green : C.blue} solid>{p.status}</Tag>
          </View>
        </View>

        <View style={{ padding: 20 }}>
          {/* Title + price */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: C.text, fontFamily: FONT }}>{p.title}</Text>
              <Text style={{ color: C.muted, fontSize: 13, marginTop: 5, fontFamily: FONT }}>📍 {p.location}</Text>
            </View>
            <NeoBox offset={4} bg={C.amber} radius={12}>
              <View style={{ paddingHorizontal: 12, paddingVertical: 7 }}>
                <Text style={{ fontSize: 18, fontWeight: "900", color: C.ink, fontFamily: FONT }}>{p.price}</Text>
              </View>
            </NeoBox>
          </View>

          {/* Stats */}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <StatBox>📐 {p.area}</StatBox>
            {p.beds  ? <StatBox>🛏 {p.beds} Beds</StatBox>  : null}
            {p.baths ? <StatBox>🚿 {p.baths} Baths</StatBox> : null}
          </View>

          {/* Tags */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
            {(p.tags || []).map(t => <Tag key={t}>{t}</Tag>)}
          </View>

          {/* Description */}
          <Text style={{ color: C.muted, fontSize: 14, lineHeight: 24, marginBottom: 22, fontFamily: FONT }}>{p.description}</Text>

          {/* Location — gated */}
          <View style={{ marginBottom: 22 }}>
            <NeoBox offset={5} shadowColor={color} fullWidth>
              <View>
                <View style={{ paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 2.5, borderBottomColor: C.ink, backgroundColor: C.cardAlt, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: C.text, fontWeight: "700", fontSize: 14, fontFamily: FONT }}>📍 Location</Text>
                  {!isSignedIn && <Tag color={C.red}>🔒 Login required</Tag>}
                </View>
                <View style={{ height: 150, alignItems: "center", justifyContent: "center", backgroundColor: isSignedIn ? "#0d1b14" : C.cardAlt }}>
                  {isSignedIn ? (
                    <>
                      <Text style={{ fontSize: 30 }}>📍</Text>
                      <Text style={{ color: C.amber, fontWeight: "700", fontSize: 13, marginTop: 4, fontFamily: FONT }}>{p.location}</Text>
                      <Text style={{ color: C.muted, fontSize: 11, marginTop: 4, fontFamily: FONT }}>Tap to open in Maps</Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontSize: 28 }}>🔒</Text>
                      <Text style={{ color: C.muted, fontSize: 13, marginVertical: 8, fontFamily: FONT }}>Sign in to view location</Text>
                      <NeoButton title="Sign In" small onPress={() => router.push("/sign-in")} />
                    </>
                  )}
                </View>
              </View>
            </NeoBox>
          </View>

          {/* Owner */}
          <NeoBox offset={4} bg={C.cardAlt} fullWidth>
            <View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Avatar initials={p.owner_avatar || "??"} color={color} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 15, fontFamily: FONT }}>
                  {p.owner_name}{p.verified ? "  ✓" : ""}
                </Text>
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 2, fontFamily: FONT }}>Property Owner</Text>
              </View>
            </View>
          </NeoBox>

          {/* Actions */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <NeoButton full title="💬 Chat with Owner"
              onPress={() => { if (!isSignedIn) { router.push("/sign-in"); return; } router.push(`/chat/${p.id}`); }}
              style={{ flex: 1 }} />
            <NeoButton title="📞" fill={C.green} onPress={call} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
