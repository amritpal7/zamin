import React, { useRef } from "react";
import { Pressable, Text, View, Animated } from "react-native";
import { C, FONT } from "../theme";

export default function NeoButton({ title, onPress, fill = C.amber, fg = C.ink, offset = 4, small, full, disabled, style }) {
  const translate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const shadowOp = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    if (disabled) return;
    Animated.parallel([
      Animated.timing(translate, { toValue: { x: offset, y: offset }, duration: 60, useNativeDriver: true }),
      Animated.timing(shadowOp, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };
  const pressOut = () => {
    if (disabled) return;
    Animated.parallel([
      Animated.timing(translate, { toValue: { x: 0, y: 0 }, duration: 80, useNativeDriver: true }),
      Animated.timing(shadowOp, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={[{ alignSelf: full ? "stretch" : "flex-start" }, style]}>
      <Animated.View style={{ position: "absolute", left: offset, top: offset, right: -offset, bottom: -offset, backgroundColor: disabled ? "transparent" : C.ink, borderRadius: 12, opacity: shadowOp }} />
      <Animated.View style={{ transform: [{ translateX: translate.x }, { translateY: translate.y }] }}>
        <Pressable onPress={disabled ? null : onPress} onPressIn={pressIn} onPressOut={pressOut}
          style={{ backgroundColor: disabled ? C.dim : fill, borderColor: C.ink, borderWidth: 2.5, borderRadius: 12, paddingVertical: small ? 8 : 13, paddingHorizontal: small ? 16 : 22, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: disabled ? C.muted : fg, fontSize: small ? 13 : 15, fontWeight: "700", fontFamily: FONT }}>{title}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
