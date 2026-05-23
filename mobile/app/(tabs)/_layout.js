import React from "react";
import { View, Text, Pressable } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, FONT } from "../../src/theme";

const TABS = [
  { name: "discover", icon: "🔍", label: "Find" },
  { name: "map",      icon: "🗺️", label: "Map"  },
  { name: "post",     icon: "➕", label: "Post" },
  { name: "saved",    icon: "❤️", label: "Saved" },
  { name: "profile",  icon: "👤", label: "Me"   },
];

function NeoTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: "row", backgroundColor: C.card, borderTopWidth: 3, borderTopColor: C.ink, paddingTop: 6, paddingBottom: insets.bottom || 8 }}>
      {state.routes.map((route, i) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;
        const focused = state.index === i;
        return (
          <Pressable key={route.key} onPress={() => navigation.navigate(route.name)} style={{ flex: 1, alignItems: "center", gap: 3, paddingVertical: 6 }}>
            {/* Neo chip on active tab */}
            <View style={{
              width: focused ? 44 : undefined,
              height: focused ? 34 : undefined,
              backgroundColor: focused ? C.amber : "transparent",
              borderColor: focused ? C.ink : "transparent",
              borderWidth: focused ? 2.5 : 0,
              borderRadius: 10,
              // backing shadow
              ...(focused ? { shadowColor: C.ink, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0 } : {}),
              alignItems: "center", justifyContent: "center",
              paddingHorizontal: focused ? 0 : 4,
            }}>
              <Text style={{ fontSize: tab.name === "post" ? 20 : 18 }}>{tab.icon}</Text>
            </View>
            <Text style={{ fontSize: 10, fontWeight: "700", fontFamily: FONT, color: focused ? C.amber : C.muted }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <NeoTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="post" />
      <Tabs.Screen name="saved" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
