import React from "react";
import { Platform } from "react-native";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { C } from "../theme";
import { useTheme } from "../context/ThemeContext";

// Native platform tab bar: a real UITabBar on iOS (→ system Liquid Glass on iOS 26) and a
// Material BottomNavigation on Android. Rendered only in a DEV/prod build — native tabs are NOT
// available in Expo Go, so app/(tabs)/_layout.js falls back to a JS tab bar there and on web.
//
// Icons are declared per-platform: `sf` = SF Symbols (iOS, with a filled "selected" variant),
// `md` = Material Symbols glyph name (Android). Labels + the amber selected tint are shared.
const TABS = [
  { name: "discover", label: "Home",  sf: "house",       sfSel: "house.fill",       md: "home" },
  { name: "map",      label: "Map",   sf: "map",         sfSel: "map.fill",         md: "map" },
  { name: "post",     label: "Post",  sf: "plus.circle", sfSel: "plus.circle.fill", md: "add_circle" },
  { name: "saved",    label: "Saved", sf: "bookmark",    sfSel: "bookmark.fill",    md: "bookmark" },
  { name: "profile",  label: "Me",    sf: "person",      sfSel: "person.fill",      md: "person" },
];

export default function NativeTabsLayout() {
  useTheme(); // re-render colors on light/dark toggle

  return (
    <NativeTabs
      backgroundColor={C.card}
      iconColor={C.fgDim}
      // Android Material draws a pill behind the active icon; its default pale periwinkle made
      // the amber icon invisible in dark mode. Amber pill + dark ink icon reads in both themes.
      indicatorColor={C.amber}
      selectedIconColor={Platform.OS === "android" ? C.ink : C.amber}
      labelStyle={{ color: C.fgDim }}
    >
      {TABS.map((t) => (
        <NativeTabs.Trigger key={t.name} name={t.name}>
          <NativeTabs.Trigger.Icon sf={{ default: t.sf, selected: t.sfSel }} md={t.md} />
          <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
