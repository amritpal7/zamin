import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { C } from "../theme";
import { useTheme } from "../context/ThemeContext";

// The ONE decision point for glass in the app. On iOS 26+ this renders Apple's real
// Liquid Glass (`expo-glass-effect`'s GlassView — a live, refractive, specular material
// that samples what's behind it). Everywhere else (iOS < 26, Android, web) it falls back
// to our previous BlurView faux-glass: frosted blur + translucent fill + top-edge sheen.
// Because it's one component, the whole app (navbar, sheets, drawers) upgrades/degrades
// together — see docs/ARCHITECTURE.md. Ref: expo.dev/blog/liquid-glass-app-with-expo-ui.
export const NATIVE_GLASS = Platform.OS === "ios" && isLiquidGlassAvailable();

export default function LiquidGlass({
  children,
  style,
  radius = 24,
  topOnly = false,
  fill = false,
  // native GlassView knobs
  glassStyle = "regular", // 'regular' | 'clear' | 'none'
  interactive = false,    // glass reacts to touch/press (great for the nav bar)
  tintColor,
  // fallback (BlurView) knobs — kept so existing call sites look identical pre-iOS-26
  intensity,
  tint,
  fillColor,
  sheen = true,
}) {
  const { scheme } = useTheme(); // re-read tokens + drive GlassView colorScheme on toggle
  const g = C.glass || {};
  const corners = topOnly
    ? { borderTopLeftRadius: radius, borderTopRightRadius: radius }
    : { borderRadius: radius };
  const shadow = {
    shadowColor: g.shadow || C.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  };

  // Real Liquid Glass: let the native material own the fill/border/highlight.
  if (NATIVE_GLASS) {
    return (
      <View style={[corners, shadow, style]}>
        <GlassView
          glassEffectStyle={glassStyle}
          isInteractive={interactive}
          colorScheme={scheme === "dark" ? "dark" : "light"}
          tintColor={tintColor}
          style={[corners, { overflow: "hidden" }, fill && { flex: 1 }]}
        >
          {children}
        </GlassView>
      </View>
    );
  }

  // Fallback material (unchanged look): frosted blur + fill + specular top sheen.
  return (
    <View style={[corners, shadow, style]}>
      <View
        style={[
          corners,
          { overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: g.border || C.glassBorder },
          fill && { flex: 1 },
        ]}
      >
        <BlurView intensity={intensity ?? g.intensity ?? 40} tint={tint ?? g.tint ?? "default"} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fillColor || g.fill || C.glassBg }]} />
        {sheen && (
          <LinearGradient
            colors={[g.highlight || "rgba(255,255,255,0.6)", "transparent"]}
            locations={[0, 0.6]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: radius * 1.5 }}
            pointerEvents="none"
          />
        )}
        {children}
      </View>
    </View>
  );
}
