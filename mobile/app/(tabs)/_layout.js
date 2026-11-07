import React from "react";
import { StyleSheet, Platform } from "react-native";
import Constants from "expo-constants";
import { Tabs } from "expo-router";
import { C, FONT_MED } from "../../src/theme";
import { Icon } from "../../src/components/Icon";
import { useTheme } from "../../src/context/ThemeContext";

// Native tabs (real UITabBar → iOS 26 Liquid Glass / Material BottomNavigation) require a dev build
// and aren't available in Expo Go or on web. So: use native tabs on iOS/Android dev builds, and fall
// back to this clean JS tab bar in Expo Go + web. The native module is lazy-required so Expo Go never
// evaluates it. (To go native-only once you ship dev builds, just render <NativeTabsLayout/> always.)
const USE_NATIVE_TABS =
  Platform.OS !== "web" && Constants.executionEnvironment !== "storeClient";
const NativeTabsLayout = USE_NATIVE_TABS
  ? require("../../src/navigation/NativeTabsLayout").default
  : null;

const TABS = {
  discover: { icon: "home",     label: "Home"  },
  map:      { icon: "compass",  label: "Map"   },
  post:     { icon: "plus",     label: "Post"  },
  saved:    { icon: "bookmark", label: "Saved" },
  profile:  { icon: "user",     label: "Me"    },
};

// Clean JS tab bar — simple icon + label on an opaque surface. Used in Expo Go + web.
function JsTabsLayout() {
  useTheme(); // re-render tab colors on light/dark toggle
  return (
    <Tabs
      screenOptions={({ route }) => {
        const tab = TABS[route.name] || {};
        return {
          headerShown: false,
          tabBarActiveTintColor: C.amber,
          tabBarInactiveTintColor: C.fgDim,
          tabBarLabel: tab.label,
          tabBarLabelStyle: { fontFamily: FONT_MED, fontSize: 11 },
          tabBarStyle: {
            backgroundColor: C.card,
            borderTopColor: C.line,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
          tabBarIcon: ({ color, focused }) => (
            <Icon name={tab.icon} size={22} color={color} strokeWidth={focused ? 2 : 1.5} />
          ),
        };
      }}
    >
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="post" />
      <Tabs.Screen name="saved" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

export default function TabsLayout() {
  if (NativeTabsLayout) return <NativeTabsLayout />;
  return <JsTabsLayout />;
}
