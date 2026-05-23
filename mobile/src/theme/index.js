import { Platform } from "react-native";

export const C = {
  bg: "#0a0a0f",
  card: "#13131f",
  cardAlt: "#1a1a2a",
  amber: "#f0a500",
  amberDim: "#f0a50018",
  orange: "#ff6b35",
  text: "#e8e8f0",
  muted: "#7a7a98",
  dim: "#26263a",
  green: "#00d084",
  red: "#ff4757",
  blue: "#4da6ff",
  purple: "#9b59b6",
  ink: "#000000",
};

export const FONT = Platform.select({
  ios: "Trebuchet MS",
  android: "sans-serif-medium",
  web: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  default: "System",
});

export const R = 14; // default border radius
