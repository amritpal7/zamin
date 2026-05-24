import React, { useRef } from "react";
import { Pressable, Text, Animated } from "react-native";
import { C, FONT } from "../theme";
import { useTheme } from "../context/ThemeContext";

export default function NeoButton({
  title, onPress,
  fill, fg,
  small, full, disabled, style,
  offset,
}) {
  useTheme();
  const activeFill = fill || C.amber;
  const activeFg   = fg   || C.ink;

  const scale = useRef(new Animated.Value(1)).current;
  const pressIn  = () => { if (!disabled) Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50, bounciness: 4 }).start(); };
  const pressOut = () => { if (!disabled) Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 6 }).start(); };

  return (
    <Animated.View style={[{ alignSelf: full ? "stretch" : "flex-start", transform: [{ scale }] }, style]}>
      <Pressable
        onPress={disabled ? null : onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={{
          backgroundColor: disabled ? C.dim : activeFill,
          borderRadius: 100,
          paddingVertical:   small ? 9  : 14,
          paddingHorizontal: small ? 20 : 28,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: disabled ? "transparent" : activeFill,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: disabled ? 0 : 6,
        }}
      >
        <Text style={{
          color:      disabled ? C.muted : activeFg,
          fontSize:   small ? 13 : 15,
          fontWeight: "700",
          fontFamily: FONT,
          letterSpacing: 0.2,
        }}>
          {title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
