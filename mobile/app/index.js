import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { C, FONT } from "../src/theme";

function FloatShape({ emoji, color, style, delay = 0 }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -12, duration: 2000, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={[{ position: "absolute", transform: [{ translateY: y }] }, style]}>
      <View style={{ position: "absolute", left: 4, top: 4, width: 56, height: 56, backgroundColor: C.ink, borderRadius: 14 }} />
      <View style={{ width: 56, height: 56, backgroundColor: color, borderColor: C.ink, borderWidth: 2.5, borderRadius: 14, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 28 }}>{emoji}</Text>
      </View>
    </Animated.View>
  );
}

export default function Splash() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => {
      if (!isLoaded) return;
      router.replace(isSignedIn ? "/(tabs)/discover" : "/sign-in");
    }, 1800);
    return () => clearTimeout(t);
  }, [isLoaded, isSignedIn]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
      <FloatShape emoji="🌾" color={C.green} style={{ top: "20%", left: "12%" }} delay={0} />
      <FloatShape emoji="🏢" color={C.blue} style={{ top: "26%", right: "14%" }} delay={500} />
      <FloatShape emoji="📍" color={C.orange} style={{ bottom: "22%", left: "18%" }} delay={250} />

      <Animated.View style={{ transform: [{ scale }, { rotate: "-2deg" }], opacity, alignItems: "center" }}>
        <View>
          <View style={{ position: "absolute", left: 8, top: 8, right: -8, bottom: -8, backgroundColor: C.ink, borderRadius: 22 }} />
          <View style={{ backgroundColor: C.amber, borderColor: C.ink, borderWidth: 3, borderRadius: 22, paddingHorizontal: 38, paddingVertical: 22 }}>
            <Text style={{ fontSize: 48, fontWeight: "900", color: C.ink, fontFamily: FONT, letterSpacing: -1 }}>Zamin.</Text>
          </View>
        </View>
        <Text style={{ marginTop: 24, color: C.amber, fontSize: 14, fontWeight: "700", fontFamily: FONT }}>No brokerage · Direct connect 🤝</Text>
      </Animated.View>
    </View>
  );
}
