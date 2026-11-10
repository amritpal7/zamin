// Small banner shown while an API request has been pending for a while — on the free host the
// first request after ~15 min idle wakes the server (~up to a minute). Explains the wait instead
// of leaving testers staring at a spinner.
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, FONT_MED, elevate } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { onServerSlow } from "../utils/serverStatus";

export default function ServerWakeBanner() {
  useTheme();
  const insets = useSafeAreaInsets();
  const [slow, setSlow] = useState(false);
  useEffect(() => onServerSlow(setSlow), []);
  if (!slow) return null;
  return (
    // Rendered as a sibling of the navigation <Stack>: on Android, native screen containers draw
    // above later JS siblings unless the overlay has a higher ELEVATION (zIndex alone isn't enough).
    <View pointerEvents="none" style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, alignItems: "center", zIndex: 1000, elevation: 1000 }}>
      <View
        accessibilityRole="alert"
        accessibilityLabel="Waking up the server. The first load can take up to a minute."
        style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderColor: C.glassBorder, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, ...elevate(3) }}
      >
        <ActivityIndicator size="small" color={C.amber} />
        <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 12 }}>Waking up the server… first load can take up to a minute</Text>
      </View>
    </View>
  );
}
