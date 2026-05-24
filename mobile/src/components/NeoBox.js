import React from "react";
import { View } from "react-native";
import { C, R } from "../theme";
import { useTheme } from "../context/ThemeContext";

export default function NeoBox({
  children,
  shadowColor,
  radius = R,
  bg,
  style,
  fullWidth,
  offset, borderColor, borderWidth,
}) {
  useTheme();
  const sc  = shadowColor || C.shadow;
  const bgc = bg || C.card;

  return (
    <View style={[
      {
        alignSelf: fullWidth ? "stretch" : "flex-start",
        borderRadius: radius,
        shadowColor: sc,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 22,
        elevation: 6,
      },
      style,
    ]}>
      <View style={{
        backgroundColor: bgc,
        borderRadius: radius,
        borderWidth: 1,
        borderColor: C.glassBorder,
        overflow: "hidden",
      }}>
        {children}
      </View>
    </View>
  );
}
