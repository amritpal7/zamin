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
};

export const C = { ...LIGHT };
export function applyTheme(s) { Object.assign(C, s === "dark" ? DARK : LIGHT); }

// Mono display type — GeistMono across the board (matches the app2 reference)
export const FONT      = "GeistMono_400Regular";
export const FONT_MED  = "GeistMono_500Medium";
export const FONT_HEAD = "GeistMono_600SemiBold";
export const FONT_HEAD_ITALIC = "GeistMono_500Medium";
export const FONT_MONO = "GeistMono_400Regular";

export const R = 26;
