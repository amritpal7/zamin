import React from "react";
import { View, StyleSheet } from "react-native";
import { C, elevate } from "../theme";
import { useTheme } from "../context/ThemeContext";

// Opaque Material surface primitive.
//
// Liquid glass was retired app-wide (2026-10) — iOS and Android now both render clean opaque
// cards. This used to branch per platform (iOS 26 GlassView / BlurView faux-glass / Android
// opaque); it's now a single opaque surface everywhere. Structure is a shadow wrapper (NO
// overflow:hidden, so Android rounds the elevation shadow) around an inner clip that holds the
// fill + border. Depth is cross-platform via `elevate()`.
//
// Legacy glass-era props (glassStyle/interactive/tintColor/intensity/tint/sheen/androidBlur)
// are accepted and ignored so existing call sites keep working.
export default function LiquidGlass({
  children,
  style,
  radius = 24,
  topOnly = false,
  fill = false,
  fillColor,
  level = 3,
  // accepted-but-ignored legacy glass knobs:
  glassStyle, interactive, tintColor, intensity, tint, sheen, androidBlur,
}) {
  useTheme(); // re-render on light/dark toggle
  const corners = topOnly
    ? { borderTopLeftRadius: radius, borderTopRightRadius: radius }
    : { borderRadius: radius };

  return (
    <View style={[corners, elevate(level), style]}>
      <View
        style={[
          corners,
          {
            overflow: "hidden",
            backgroundColor: fillColor || C.card,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: C.glassBorder,
          },
          fill && { flex: 1 },
        ]}
      >
        {children}
      </View>
    </View>
  );
}
