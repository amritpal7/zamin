import { Platform } from "react-native";

const ACCENT = { hex: "#E7A552", soft: "#FFDCA0", deep: "#B07A24" };

const LIGHT = {
  bg:          "#F5F7FB",
  bgDeep:      "#E8ECF4",
  fg:          "#0E1320",
  text:        "#0E1320",
  fgDim:       "rgba(14,19,32,0.60)",
  muted:       "rgba(14,19,32,0.60)",
  fgFaint:     "rgba(14,19,32,0.34)",
  line:        "rgba(14,19,32,0.09)",
  dim:         "rgba(14,19,32,0.09)",
  card:        "rgba(255,255,255,0.85)",
  cardAlt:     "rgba(248,250,253,0.90)",
  glassBg:     "rgba(255,255,255,0.55)",
  glassBorder: "rgba(14,19,32,0.10)",
  chipBg:      "rgba(14,19,32,0.05)",
  shadow:      "#1B2740",
  accent:      ACCENT,
  amber:       "#E09A33",
  amberDim:    "#E09A3315",
  amberText:   "#9C6A16",
  orange:      "#DB8C2E",
  green:       "#129E6B",
  red:         "#E03050",
  blue:        "#2D74CB",
  purple:      "#6A45C0",
  ink:         "#0E1320",
  // Liquid-glass material tokens (iOS-26 style): a frosted blur + translucent fill + a
  // specular top-edge highlight + soft depth. Consumed by <GlassSurface>.
  glass: {
    intensity: 34,               // BlurView intensity
    tint:      "light",          // BlurView tint
    fill:      "rgba(255,255,255,0.42)", // translucent layer over the blur
    border:    "rgba(255,255,255,0.65)", // rim
    highlight: "rgba(255,255,255,0.95)", // top-edge sheen
    shadow:    "#1B2740",
  },
};

const DARK = {
  bg:          "#0A0E1A",
  bgDeep:      "#070A12",
  fg:          "#EEF1F7",
  text:        "#EEF1F7",
  fgDim:       "rgba(238,241,247,0.58)",
  muted:       "rgba(238,241,247,0.58)",
  fgFaint:     "rgba(238,241,247,0.34)",
  line:        "rgba(200,212,240,0.11)",
  dim:         "rgba(200,212,240,0.11)",
  card:        "rgba(19,26,43,0.85)",
  cardAlt:     "rgba(26,35,56,0.90)",
  glassBg:     "rgba(18,25,42,0.60)",
  glassBorder: "rgba(180,200,255,0.12)",
  chipBg:      "rgba(200,215,255,0.08)",
  shadow:      "#000000",
  accent:      ACCENT,
  amber:       "#E7A552",
  amberDim:    "#E7A55222",
  amberText:   "#E7A552",
  orange:      "#E7A552",
  green:       "#00C880",
  red:         "#FF5A66",
  blue:        "#4DA6FF",
  purple:      "#9B59B6",
  ink:         "#0A0E1A",
  glass: {
    intensity: 40,
    tint:      "dark",
    fill:      "rgba(16,22,38,0.52)",
    border:    "rgba(180,200,255,0.16)",
    highlight: "rgba(200,220,255,0.30)",
    shadow:    "#000000",
  },
};

// Opaque Material surfaces — applied on ALL platforms. Liquid glass was retired app-wide
// (2026-10): iOS and Android both render clean opaque cards. These override the translucent
// base "glass" tokens with solid fills and drop the white specular sheen (`highlight`).
const IS_ANDROID = Platform.OS === "android";
const LIGHT_OPAQUE = {
  glassBg:     "#FFFFFF",
  card:        "#FFFFFF",
  cardAlt:     "#FFFFFF",
  chipBg:      "#EDF1F7",
  glassBorder: "rgba(14,19,32,0.10)",
  glass: { intensity: 0, tint: "light", fill: "#FFFFFF", border: "rgba(14,19,32,0.10)", highlight: "transparent", shadow: "#1B2740" },
};
const DARK_OPAQUE = {
  glassBg:     "#141C2E",
  card:        "#141C2E",
  cardAlt:     "#1B2440",
  chipBg:      "#1B2440",
  glassBorder: "rgba(180,200,255,0.14)",
  glass: { intensity: 0, tint: "dark", fill: "#141C2E", border: "rgba(180,200,255,0.14)", highlight: "transparent", shadow: "#000000" },
};

export const C = { ...LIGHT, ...LIGHT_OPAQUE };
export function applyTheme(s) {
  Object.assign(C, s === "dark" ? DARK : LIGHT);
  Object.assign(C, s === "dark" ? DARK_OPAQUE : LIGHT_OPAQUE);
}

// ── Cross-platform depth ──────────────────────────────────────────────────
// iOS shadow props (shadowColor/Offset/Opacity/Radius) are NO-OPS on Android — only
// `elevation` casts a shadow there. Worse, mixing iOS shadow props + `elevation` +
// `overflow:"hidden"` on the SAME node makes Android paint a hard grey rectangular plate
// instead of a soft rounded shadow (the outline provider can't round the shadow). So:
//   • Android → emit ONLY `elevation` (Material-style), kept on a node WITHOUT
//     overflow:"hidden" (put the clip on an inner child).
//   • iOS/web → emit a soft layered shadow tuned per level.
// `level` ≈ Material elevation (1 = resting card, 3 = raised, 4 = floating/featured).
export function elevate(level = 2) {
  if (IS_ANDROID) return { elevation: level };
  const s = {
    1: { height: 2,  radius: 8,  opacity: 0.10 },
    2: { height: 6,  radius: 16, opacity: 0.12 },
    3: { height: 10, radius: 24, opacity: 0.16 },
    4: { height: 14, radius: 30, opacity: 0.20 },
  }[level] || { height: 6, radius: 16, opacity: 0.12 };
  return {
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: s.height },
    shadowOpacity: s.opacity,
    shadowRadius: s.radius,
  };
}

// Mono display type — GeistMono across the board (matches the app2 reference)
export const FONT      = "GeistMono_400Regular";
export const FONT_MED  = "GeistMono_500Medium";
export const FONT_HEAD = "GeistMono_600SemiBold";
export const FONT_HEAD_ITALIC = "GeistMono_500Medium";
export const FONT_MONO = "GeistMono_400Regular";

export const R = 26;
