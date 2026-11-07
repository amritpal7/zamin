// mobile/app/help.js — Help & FAQ. Plain answers about how Zamin works; reached from
// Profile → Help & Support and Settings → About.
import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, FONT, FONT_MED, FONT_HEAD } from "../src/theme";
import { useTheme } from "../src/context/ThemeContext";
import { Icon } from "../src/components/Icon";

const FAQ = [
  { q: "Is Zamin really free?",
    a: "Yes. Posting, browsing and chatting are free, and there is no brokerage — you deal directly with the owner." },
  { q: "How do I post a property?",
    a: "Tap Post in the tab bar and go through the four steps: Details, Amenities, Location and Review. Add up to 8 photos; the first one is the cover." },
  { q: "How do I contact an owner?",
    a: "Open a listing and tap Chat with Owner, or use the phone / WhatsApp buttons if the owner added a number. You can also schedule a visit from the listing." },
  { q: "Who can see my exact location?",
    a: "You choose. In Settings → Location on the map pick Exact, Approx (~400 m area) or Hidden. It applies to all your listings and you can change it per listing when posting." },
  { q: "How do I edit or remove a listing?",
    a: "Go to Me → My Listings and use the Edit or Delete button on the listing." },
  { q: "What does “Verified owner” mean?",
    a: "The owner has verified an email or phone number on their account." },
  { q: "Someone is misusing the app. What can I do?",
    a: "Open the listing and tap Report listing, or block the user from the chat. Listings reported by several people are hidden automatically for review." },
  { q: "How do I change my password or photo?",
    a: "Settings → Change password. Tap your picture at the top of Settings to change your profile photo." },
];

function Item({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((o) => !o)}
      style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ flex: 1, color: C.fg, fontFamily: FONT_MED, fontSize: 14 }}>{q}</Text>
        <Icon name={open ? "chevD" : "chevR"} size={16} color={C.fgDim} />
      </View>
      {open && <Text style={{ color: C.fgDim, fontFamily: FONT, fontSize: 13, lineHeight: 20, marginTop: 8 }}>{a}</Text>}
    </Pressable>
  );
}

export default function Help() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/discover"); }}
          accessibilityLabel="Back"
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="back" size={18} color={C.fg} />
        </Pressable>
        <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 18 }}>Help & FAQ</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}>
        <View style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, overflow: "hidden" }}>
          {FAQ.map((f) => <Item key={f.q} {...f} />)}
        </View>
      </ScrollView>
    </View>
  );
}
