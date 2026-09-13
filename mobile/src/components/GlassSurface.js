import React from "react";
import LiquidGlass from "./LiquidGlass";

// Liquid-glass surface for sheets / drawers / floating chrome. Thin wrapper over
// `LiquidGlass` so all existing call sites (property-detail drawers, modals) transparently
// get Apple's real Liquid Glass on iOS 26 and the BlurView faux-glass everywhere else.
// NOT for every row in a long scroll list (many simultaneous glass layers are a perf cost).
export default function GlassSurface({ children, style, radius = 24, topOnly = false, fill = false, intensity, tint }) {
  return (
    <LiquidGlass style={style} radius={radius} topOnly={topOnly} fill={fill} intensity={intensity} tint={tint}>
      {children}
    </LiquidGlass>
  );
}
