import React from "react";
import { View, Text, Pressable } from "react-native";
import { C, FONT } from "../theme";
import NeoBox from "./NeoBox";
import { Tag, Avatar } from "./ui";

export default function PropertyCard({ property: p, onPress, onSave, saved }) {
  return (
    <Pressable onPress={onPress} style={{ marginBottom: 18 }}>
      <NeoBox offset={5} fullWidth>
        {/* Hero */}
        <View style={{ height: 120, backgroundColor: (p.color || C.amber) + "22", alignItems: "center", justifyContent: "center", borderBottomWidth: 2.5, borderBottomColor: C.ink }}>
          <Text style={{ fontSize: 48 }}>{p.img || "🏠"}</Text>

          <View style={{ position: "absolute", top: 10, left: 10 }}>
            <Tag color={p.status === "For Sale" ? C.green : C.blue} solid>{p.status}</Tag>
          </View>

          <Pressable onPress={onSave} style={{ position: "absolute", top: 10, right: 10, width: 32, height: 32, backgroundColor: C.card, borderColor: C.ink, borderWidth: 2.5, borderRadius: 10, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 14 }}>{saved ? "❤️" : "🤍"}</Text>
          </Pressable>

          <View style={{ position: "absolute", bottom: 10, right: 10 }}>
            <View style={{ backgroundColor: C.amber, borderColor: C.ink, borderWidth: 2.5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: "900", color: C.ink, fontFamily: FONT }}>{p.price}</Text>
            </View>
          </View>
        </View>

        {/* Body */}
        <View style={{ padding: 15 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: C.text, fontFamily: FONT }}>{p.title}</Text>
          <Text style={{ color: C.muted, fontSize: 12, marginTop: 5, marginBottom: 11, fontFamily: FONT }}>📍 {p.location}</Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 11 }}>
            <Text style={{ color: C.muted, fontSize: 12, fontFamily: FONT }}>📐 {p.area}</Text>
            {p.beds  ? <Text style={{ color: C.muted, fontSize: 12, fontFamily: FONT }}>🛏 {p.beds} Beds</Text>  : null}
            {p.baths ? <Text style={{ color: C.muted, fontSize: 12, fontFamily: FONT }}>🚿 {p.baths} Baths</Text> : null}
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 2, borderTopColor: C.dim, paddingTop: 11 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Avatar initials={p.owner_avatar || "??"} size={26} color={p.color || C.amber} />
              <Text style={{ color: C.muted, fontSize: 12, fontFamily: FONT }}>
                {p.owner_name}{p.verified ? " ✓" : ""}
              </Text>
            </View>
            <Text style={{ color: C.dim, fontSize: 11, fontFamily: FONT }}>{p.posted || ""}</Text>
          </View>
        </View>
      </NeoBox>
    </Pressable>
  );
}
