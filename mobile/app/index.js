// mobile/app/index.js — splash. Editorial brand mark, soft gradient, no emoji shapes.

import { useTheme } from "../src/context/ThemeContext";
import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Circle } from "react-native-svg";
import { C, FONT, FONT_HEAD, FONT_HEAD_ITALIC } from "../src/theme";

export default function Splash() {
  useTheme();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();

  const opacity = useRef(new Animated.Value(0)).current;
  const lift    = useRef(new Animated.Value(20)).current;
  const dot     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(lift,    { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.sequence([
      Animated.timing(dot, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(dot, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();

    const t = setTimeout(() => {
      if (!isLoaded) return;
      router.replace(isSignedIn ? "/(tabs)/discover" : "/sign-in");
    }, 1800);
    return () => clearTimeout(t);
  }, [isLoaded, isSignedIn]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Soft warm ambient */}
      <LinearGradient
        colors={[C.amber + "26", "transparent"]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Dashed curve — subtle */}
      <Svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.18 }} pointerEvents="none">
        <Path d="M-20,500 Q 150,200 420,40" stroke={C.amber} strokeWidth={1.2} strokeDasharray="2 6" fill="none" />
        <Circle cx={420} cy={40} r={3} fill={C.amber} />
      </Svg>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Animated.View style={{ opacity, transform: [{ translateY: lift }], alignItems: "center" }}>
          {/* Brand chip */}
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 8,
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
            backgroundColor: C.glassBg,
            borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder,
            marginBottom: 28,
          }}>
            <LinearGradient
              colors={[C.amber + "ee", "#8326b8"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ width: 18, height: 18, borderRadius: 9 }}
            />
            <Text style={{ color: C.fg, fontFamily: FONT, fontSize: 12, letterSpacing: 0.3 }}>
              direct · no brokerage
            </Text>
          </View>

          {/* Wordmark */}
          <Text style={{
            color: C.fg, fontFamily: FONT_HEAD,
            fontSize: 84, lineHeight: 84, letterSpacing: -2.5, fontWeight: "400",
          }}>
            Zamin<Text style={{ color: C.amberText }}>.</Text>
          </Text>

          {/* Tagline */}
          <Text style={{
            color: C.fgDim, fontFamily: FONT_HEAD_ITALIC, fontStyle: "italic",
            fontSize: 18, marginTop: 4, letterSpacing: -0.2,
          }}>
            land that finds you.
          </Text>
        </Animated.View>

        {/* Loading dot */}
        <Animated.View style={{
          position: "absolute", bottom: 60,
          flexDirection: "row", alignItems: "center", gap: 8,
          opacity,
        }}>
          <Animated.View style={{
            width: 6, height: 6, borderRadius: 3, backgroundColor: C.amber,
            opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
          }} />
          <Text style={{ color: C.fgFaint, fontFamily: FONT, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>
            getting things ready
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}
