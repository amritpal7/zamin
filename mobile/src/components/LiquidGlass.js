import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { C } from "../theme";
import { useTheme } from "../context/ThemeContext";

// The ONE decision point for glass in the app.
// - iOS 26+  → Apple's real Liquid Glass (expo-glass-effect GlassView).
// - iOS < 26 / web → BlurView faux-glass (blur + translucent fill + specular sheen).
// - Android → CLEAN OPAQUE surfaces (expo-blur doesn't truly blur on Android → the glass
//   looked muddy/washed-out). Pass `androidBlur` to opt a single element (the nav bar) into a
//   real Android blur via `experimentalBlurMethod`.
// So the whole app upgrades/degrades together — see docs/ARCHITECTURE.md.
export const NATIVE_GLASS = Platform.OS === "ios" && isLiquidGlassAvailable();
const IS_ANDROID = Platform.OS === "android";

export default function LiquidGlass({
  children,
  style,
  radius = 24,
  topOnly = false,
  fill = false,
  // native GlassView knobs (iOS 26)
  glassStyle = "regular",
  interactive = false,
  tintColor,
  // fallback (BlurView) knobs
  intensity,
  tint,
  fillColor,
  sheen = true,
  // Android: opt into a real blur (used by the nav bar). Default = solid.
  androidBlur = false,
}) {
  const { scheme } = useTheme();
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

  // ── Android ──────────────────────────────────────────────────────────────
  if (IS_ANDROID) {
    // Nav bar: a genuinely-blurred bar (dimezis method actually blurs on Android).
    if (androidBlur) {
      return (
        <View style={[corners, shadow, style]}>
          <View style={[corners, { overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder }, fill && { flex: 1 }]}>
            <BlurView
              intensity={intensity ?? 30}
              tint={scheme === "dark" ? "dark" : "light"}
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: scheme === "dark" ? "rgba(10,14,26,0.55)" : "rgba(255,255,255,0.62)" }]} />
            {children}
          </View>
        </View>
      );
    }
    // Everything else: clean opaque Material surface (tokens are opaque on Android).
    return (
      <View style={[corners, shadow, style]}>
        <View style={[corners, { overflow: "hidden", backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder }, fill && { flex: 1 }]}>
          {children}
        </View>
      </View>
    );
  }

  // ── iOS 26: real Liquid Glass ────────────────────────────────────────────
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

  // ── iOS < 26 / web: BlurView faux-glass ──────────────────────────────────
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
