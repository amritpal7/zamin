import { useTheme } from "../../src/context/ThemeContext";
import React, { useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, FONT, FONT_HEAD } from "../../src/theme";
import { Icon } from "../../src/components/Icon";
import NeoButton from "../../src/components/NeoButton";
import PropertyCard from "../../src/components/PropertyCard";
import { useApi } from "../../src/hooks/useApi";

export default function Saved() {
  useTheme();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const api      = useApi();
  const apiRef   = useRef(api);
  apiRef.current = api;

  const [saved,   setSaved]   = useState([]);
  const [loading, setLoading] = useState(false);

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
        <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 22, paddingBottom: 24 }}>
          <Text style={{ fontFamily: FONT, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", color: C.fgDim, marginBottom: 8 }}>
            Your collection
          </Text>
          <Text style={{ fontFamily: FONT_HEAD, fontSize: 38, fontWeight: "400", letterSpacing: -1, color: C.fg, lineHeight: 40 }}>
            Saved.
          </Text>
        </View>
        <View style={{ alignItems: "center", paddingTop: 40, paddingHorizontal: 40 }}>
          <View style={{ marginBottom: 16, opacity: 0.5 }}>
            <Icon name="heart" size={46} color={C.fgDim} strokeWidth={1.2} />
          </View>
          <Text style={{ fontFamily: FONT_HEAD, fontSize: 24, fontWeight: "400", color: C.fg, marginBottom: 8, textAlign: "center", letterSpacing: -0.4 }}>
            Sign in to save properties
          </Text>
          <Text style={{ color: C.fgDim, fontSize: 14, fontFamily: FONT, marginBottom: 24, textAlign: "center", lineHeight: 22 }}>
            Bookmark your favourite listings and revisit them anytime.
          </Text>
          <NeoButton title="Sign In →" onPress={() => router.push("/sign-in")} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 22, paddingBottom: 8 }}>
        <Text style={{ fontFamily: FONT, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", color: C.fgDim, marginBottom: 8 }}>
          Your collection
        </Text>
        <Text style={{ fontFamily: FONT_HEAD, fontSize: 38, fontWeight: "400", letterSpacing: -1, color: C.fg, lineHeight: 40 }}>
          Saved.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 130 }}>
        {loading && <ActivityIndicator color={C.amber} style={{ marginTop: 40 }} />}

        {!loading && saved.length === 0 && (
          <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 20 }}>
              <View style={{ marginBottom: 16, opacity: 0.4 }}>
              <Icon name="heart" size={46} color={C.fgDim} strokeWidth={1.2} />
            </View>
            <Text style={{ color: C.fgDim, fontSize: 14, fontFamily: FONT, textAlign: "center", lineHeight: 22 }}>
              No saved properties yet.{"\n"}Tap the heart on any listing to save it.
            </Text>
          </View>
        )}

        {saved.map(p => (
          <PropertyCard
            key={p.id}
            property={p}
            saved
            onSave={() => unsave(p)}
            onPress={() => router.push(`/property/${p.id}`)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
