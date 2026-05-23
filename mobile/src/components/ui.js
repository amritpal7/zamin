import React from "react";
import { View, Text, TextInput } from "react-native";
import { C, FONT } from "../theme";

export const Tag = ({ children, color = C.amber, solid }) => (
  <View style={{ borderColor: color, borderWidth: 2, backgroundColor: solid ? color : "transparent", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, alignSelf: "flex-start" }}>
    <Text style={{ color: solid ? C.ink : color, fontSize: 11, fontWeight: "700", fontFamily: FONT }}>{children}</Text>
  </View>
);

export const Avatar = ({ initials, size = 38, color = C.amber }) => (
  <View>
    <View style={{ position: "absolute", left: 2.5, top: 2.5, width: size, height: size, backgroundColor: C.ink, borderRadius: size > 50 ? 16 : 10 }} />
    <View style={{ width: size, height: size, backgroundColor: color, borderColor: C.ink, borderWidth: 2.5, borderRadius: size > 50 ? 16 : 10, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: C.ink, fontSize: size * 0.38, fontWeight: "800", fontFamily: FONT }}>{initials}</Text>
    </View>
  </View>
);

export const NeoInput = ({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, multiline, style }) => (
  <View style={[{ marginBottom: 14 }, style]}>
    {label ? <Text style={{ color: C.amber, fontSize: 12, fontWeight: "700", marginBottom: 6, fontFamily: FONT }}>{label}</Text> : null}
    <TextInput
      value={value} onChangeText={onChangeText} placeholder={placeholder}
      placeholderTextColor={C.muted} secureTextEntry={secureTextEntry}
      keyboardType={keyboardType} multiline={multiline}
      style={{ backgroundColor: C.bg, borderColor: "#2e2e44", borderWidth: 2.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 14, fontFamily: FONT, minHeight: multiline ? 90 : undefined, textAlignVertical: multiline ? "top" : "center" }}
    />
  </View>
);
