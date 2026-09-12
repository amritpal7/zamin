import React from "react";
import { View, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";
import { useTheme } from "../context/ThemeContext";

// Liquid-glass surface (iOS-26 style): a frosted blur layer + a translucent fill + a
// specular highlight along the top edge + soft depth shadow. Rounded and clips its blur.
// Content is rendered on top of the material. Tokens come from theme `C.glass`.
//
// Use for sheets / drawers / floating chrome — NOT for every row in a long scroll list
// (many simultaneous blurs are a perf cost). `radius` rounds all corners; pass
// `topOnly` for a bottom-anchored sheet (rounds only the top).
export default function GlassSurface({ children, style, radius = 24, topOnly = false, fill = false, intensity, tint }) {
  useTheme(); // re-read C.glass on theme change
  const g = C.glass || {};
  const corners = topOnly
    ? { borderTopLeftRadius: radius, borderTopRightRadius: radius }
    : { borderRadius: radius };

  return (
    <View
      style={[
        corners,
        {
          shadowColor: g.shadow || C.shadow,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.18,
          shadowRadius: 24,
          elevation: 12,
        },
        style,
      ]}
    >
      <View style={[corners, { overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: g.border || C.glassBorder }, fill && { flex: 1 }]}>
        <BlurView intensity={intensity ?? g.intensity ?? 40} tint={tint ?? g.tint ?? "default"} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: g.fill || C.glassBg }]} />
        {/* Specular top-edge sheen — the hallmark liquid-glass highlight. */}
        <LinearGradient
          colors={[g.highlight || "rgba(255,255,255,0.6)", "transparent"]}
          locations={[0, 0.6]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: radius * 1.5 }}
          pointerEvents="none"
        />
        {children}
      </View>
    </View>
  );
}
