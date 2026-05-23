import React from "react";
import { View } from "react-native";
import { C, R } from "../theme";

/**
 * Fakes CSS box-shadow with a solid backing View offset by `offset` px.
 * Works identically on iOS, Android, and Web.
 */
export default function NeoBox({
  children, offset = 5, shadowColor = C.ink,
  borderColor = C.ink, borderWidth = 2.5,
  radius = R, bg = C.card, style, fullWidth,
}) {
  return (
    <View style={[{ alignSelf: fullWidth ? "stretch" : "flex-start" }, style]}>
      <View style={{ position: "absolute", left: offset, top: offset, right: -offset, bottom: -offset, backgroundColor: shadowColor, borderRadius: radius }} />
      <View style={{ backgroundColor: bg, borderColor, borderWidth, borderRadius: radius, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}
