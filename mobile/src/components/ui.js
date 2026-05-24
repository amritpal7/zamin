import React from "react";
import { View, Text, TextInput } from "react-native";
import { C, FONT, FONT_HEAD } from "../theme";
import { useTheme } from "../context/ThemeContext";

export const Tag = ({ children, color, solid }) => {
  useTheme();
  const c = color || C.amber;
  return (
    <View style={{
      backgroundColor: solid ? c : C.chipBg,
      borderRadius: 100,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: solid ? "transparent" : C.glassBorder,
    }}>
      <Text style={{ color: solid ? C.ink : c, fontSize: 11, fontWeight: "600", fontFamily: FONT }}>
        {children}
      </Text>
    </View>
  );
};

export const Avatar = ({ initials, size = 38, color }) => {
  useTheme();
  const c = color || C.amber;
  return (
    <View style={{
      width: size, height: size,
      borderRadius: size / 2,
      backgroundColor: c + "28",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: c,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 3,
    }}>
      <Text style={{ color: c, fontSize: size * 0.38, fontWeight: "600", fontFamily: FONT_HEAD }}>{initials}</Text>
    </View>
  );
};

export const NeoInput = ({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, multiline, autoCapitalize, style }) => {
  useTheme();
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? (
        <Text style={{
          color: C.fgDim, fontSize: 11, fontWeight: "600", marginBottom: 6,
          fontFamily: FONT, letterSpacing: 0.8, textTransform: "uppercase",
        }}>
          {label}
        </Text>
      ) : null}
      <View style={{
        backgroundColor: C.glassBg,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.glassBorder,
        shadowColor: C.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.fgFaint}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          autoCapitalize={autoCapitalize}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 13,
            color: C.fg,
            fontSize: 14,
            fontFamily: FONT,
            minHeight: multiline ? 90 : undefined,
            textAlignVertical: multiline ? "top" : "center",
          }}
        />
      </View>
    </View>
  );
};
