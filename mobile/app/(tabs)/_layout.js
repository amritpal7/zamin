import React, { useRef, useEffect, useState } from "react";
import { View, Text, Pressable, Animated, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import LiquidGlass, { NATIVE_GLASS } from "../../src/components/LiquidGlass";
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

  // ── Liquid "water bubble" active-tab indicator ───────────────────────────
  // A single glassy bubble slides between tab centers; a softer blob trails
  // behind it (the "water" wake), it squashes/stretches mid-travel like a
  // droplet, and a ripple ring pulses out where it lands.
  const [bar, setBar] = useState({ w: 0, h: 0 });      // measured content box
  const pos    = useRef(new Animated.Value(state.index)).current; // bubble x
  const trail  = useRef(new Animated.Value(state.index)).current; // lagging wake
  const wobble = useRef(new Animated.Value(0)).current;           // squash/stretch
  const ripple = useRef(new Animated.Value(0)).current;           // landing pulse

  useEffect(() => {
    Animated.spring(pos,   { toValue: state.index, useNativeDriver: true, friction: 9,  tension: 80 }).start();
    Animated.spring(trail, { toValue: state.index, useNativeDriver: true, friction: 16, tension: 55 }).start();
    wobble.setValue(0);
    Animated.sequence([
      Animated.timing(wobble, { toValue: 1, duration: 130, useNativeDriver: true }),
      Animated.spring(wobble, { toValue: 0, friction: 5, tension: 120, useNativeDriver: true }),
    ]).start();
    ripple.setValue(0);
    Animated.timing(ripple, { toValue: 1, duration: 440, useNativeDriver: true }).start();
  }, [state.index]);

  const pad = 6;                                        // row padding (styles.row)
  const n = TABS.length;
  const tabW = bar.w > 0 ? (bar.w - pad * 2) / n : 0;
  const bubbleW = Math.max(0, tabW - 10);
  const bubbleH = Math.max(0, bar.h - pad * 2);
  // left edge of the bubble when centered on tab i  →  pad + tabW*i + (tabW-bubbleW)/2
  const xAt = (i) => pad + tabW * i + (tabW - bubbleW) / 2;
  const range = { inputRange: [0, Math.max(1, n - 1)], outputRange: [xAt(0), xAt(n - 1)] };
  const showBubble = bar.w > 0;

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
      <LiquidGlass
        radius={32}
        interactive
        glassStyle="regular"
        sheen={false}
        intensity={50}
        tint={isDark ? "dark" : "light"}
        fillColor={isDark ? "rgba(13,18,32,0.94)" : "rgba(248,250,253,0.94)"}
      >
        <View
          style={styles.row}
          onLayout={(e) => setBar({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
        {/* Water wake — a softer, larger blob that lags behind the bubble (the trail). */}
        {showBubble && (
          <Animated.View pointerEvents="none" style={{
            position: "absolute", top: pad - 2, height: bubbleH + 4, width: bubbleW + 10, borderRadius: 30,
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.40)",
            transform: [{ translateX: trail.interpolate(range) }, { scale: 1.04 }],
          }} />
        )}
        {/* The water bubble + its landing ripple, sharing one x-translation. */}
        {showBubble && (
          <Animated.View pointerEvents="none" style={{
            position: "absolute", top: pad, height: bubbleH, width: bubbleW,
            transform: [{ translateX: pos.interpolate(range) }],
          }}>
            {/* ripple ring pulsing out where the bubble lands */}
            <Animated.View style={{
              position: "absolute", left: bubbleW / 2 - bubbleH / 2, top: 0, width: bubbleH, height: bubbleH, borderRadius: bubbleH / 2,
              borderWidth: 2, borderColor: C.amber,
              opacity: ripple.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] }),
              transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.7] }) }],
            }} />
            {/* the glassy droplet — squashes/stretches as it travels between icons */}
            <Animated.View style={{
              ...StyleSheet.absoluteFillObject, borderRadius: 26,
              backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.60)",
              borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder,
              transform: [
                { scaleX: wobble.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }) },
                { scaleY: wobble.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] }) },
              ],
            }} />
          </Animated.View>
        )}
        {/* Liquid-glass specular sheen along the top edge — fallback only; real iOS-26
            glass renders its own specular highlight, so drawing our own would double it. */}
        {!NATIVE_GLASS && (
          <LinearGradient
            colors={[C.glass?.highlight || "rgba(255,255,255,0.5)", "transparent"]}
            locations={[0, 0.8]}
            pointerEvents="none"
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: 18, borderTopLeftRadius: 32, borderTopRightRadius: 32 }}
          />
        )}
        {state.routes.map((route, i) => {
          const tab    = TABS.find(t => t.name === route.name);
          if (!tab) return null;
          const isPost = tab.name === "post";
          const active = state.index === i;
          const a      = anims[i]; // 0 = inactive, 1 = active (spring)

          const tint = isPost ? C.ink : active ? C.fg : C.fgDim;

          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              style={styles.tab}
            >
              {/* Post is a persistent amber CTA pill; the active-tab highlight for every
                  other tab is the traveling water bubble rendered behind the row. */}
              {isPost && (
                <View style={[StyleSheet.absoluteFill, styles.pill, {
                  backgroundColor: C.amber,
                  shadowColor: C.amber, shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
                }]} />
              )}

              {/* Icon gives a small lift + scale as its tab becomes active. */}
              <Animated.View style={{
                transform: [
                  { scale: isPost ? 1 : a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
                  { translateY: isPost ? 0 : a.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
                ],
              }}>
                <Icon name={tab.icon} size={20} color={tint} strokeWidth={active ? 1.9 : 1.5} />
              </Animated.View>

              <Animated.Text
                style={[
                  styles.label,
                  {
                    color: tint,
                    fontFamily: FONT_MED,
                    opacity: isPost ? 1 : a.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }),
                  },
                ]}
              >
                {tab.label}
              </Animated.Text>
            </Pressable>
          );
        })}
        </View>
      </LiquidGlass>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 6,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 26,
    gap: 3,
  },
  pill: {
    borderRadius: 26,
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
