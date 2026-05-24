import React, { useRef, useEffect } from "react";
import { View, Text, Pressable, Animated, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, FONT, FONT_MED } from "../../src/theme";
import { Icon } from "../../src/components/Icon";
import { useTheme } from "../../src/context/ThemeContext";

const TABS = [
  { name: "discover", icon: "home",     label: "Home"    },
  { name: "map",      icon: "compass",  label: "Map"     },
  { name: "post",     icon: "plus",     label: "Post"    },
  { name: "saved",    icon: "bookmark", label: "Saved"   },
  { name: "profile",  icon: "user",     label: "Me"      },
];

function TabBar({ state, navigation }) {
  const insets  = useSafeAreaInsets();
  const { scheme } = useTheme();
  const isDark  = scheme === "dark";

  // Per-tab fade anim: 0 = inactive, 1 = active
  const anims = useRef(
    TABS.map((_, i) => new Animated.Value(state.index === i ? 1 : 0))
  ).current;

  useEffect(() => {
    TABS.forEach((_, i) => {
      Animated.spring(anims[i], {
        toValue: state.index === i ? 1 : 0,
        useNativeDriver: true,
        friction: 10,
        tension: 200,
      }).start();
    });
  }, [state.index]);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0, right: 0, bottom: 0,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: Math.max(insets.bottom, 14),
        backgroundColor: "transparent",
      }}
    >
      <BlurView
        intensity={50}
        tint={isDark ? "dark" : "light"}
        style={[
          styles.bar,
          {
            backgroundColor: isDark ? "rgba(13,18,32,0.94)" : "rgba(248,250,253,0.94)",
            borderColor: C.glassBorder,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: isDark ? 0.5 : 0.14,
            shadowRadius: 24,
            elevation: 14,
          },
        ]}
      >
        {state.routes.map((route, i) => {
          const tab    = TABS.find(t => t.name === route.name);
          if (!tab) return null;
          const isPost = tab.name === "post";
          const active = state.index === i;

          // Post is a persistent amber CTA. Regular tabs get a soft warm pill when active (app2 style).
          const pillBg = isPost
            ? C.amber
            : active ? C.chipBg : "transparent";
          const pillBorder = isPost
            ? "transparent"
            : active ? C.glassBorder : "transparent";
          const tint = isPost
            ? C.ink
            : active ? C.fg : C.fgDim;

          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              style={[
                styles.tab,
                {
                  backgroundColor: pillBg,
                  borderColor: pillBorder,
                  borderWidth: (isPost || active) ? StyleSheet.hairlineWidth : 0,
                },
                isPost && {
                  shadowColor: C.amber,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                  elevation: 6,
                },
              ]}
            >
              <Icon
                name={tab.icon}
                size={20}
                color={tint}
                strokeWidth={active ? 1.9 : 1.5}
              />
              <Animated.Text
                style={[
                  styles.label,
                  {
                    color: tint,
                    fontFamily: FONT_MED,
                    opacity: isPost ? 1 : anims[i],
                  },
                ]}
              >
                {tab.label}
              </Animated.Text>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 6,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 26,
    gap: 3,
  },
  label: {
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
});

export default function TabsLayout() {
  return (
    <Tabs tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="post" />
      <Tabs.Screen name="saved" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
