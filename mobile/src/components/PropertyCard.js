import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, FONT, FONT_HEAD } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { Icon } from "./Icon";
import SmartImage from "./SmartImage";
import { Avatar } from "./ui";
import { pricePerSqft, estimateEMI } from "../utils/property";

export default function PropertyCard({ property: p, onPress, onSave, saved, isOwn, featured }) {
  useTheme();

  const color      = p.color || C.amber;
  const heroHeight = featured ? 340 : 220;
  const ppsf       = pricePerSqft(p.price, p.area);
  const emi        = estimateEMI(p.price, p.status);

  return (
    <Pressable onPress={onPress} style={{ marginBottom: 16 }}>
      <View style={{
        backgroundColor: C.glassBg,
        borderRadius: 28,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: C.glassBorder,
        shadowColor: C.shadow,
        shadowOffset: { width: 0, height: featured ? 12 : 6 },
        shadowOpacity: featured ? 0.18 : 0.10,
        shadowRadius: featured ? 28 : 16,
        elevation: featured ? 10 : 5,
        overflow: "hidden",
      }}>

        {/* ── Hero ── */}
        <View style={{ height: heroHeight, overflow: "hidden" }}>

          {/* Coloured ambient bg */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: color + "45" }]} />

          {/* Cover photo (thumbnail for speed) when available, else emoji */}
          {p.images?.length ? (
            <SmartImage uri={p.thumbnails?.[0] || p.images[0]} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: featured ? 100 : 68 }}>{p.img || "🏠"}</Text>
            </View>
          )}


          {/* Gradient overlay */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.08)", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.52)", "rgba(0,0,0,0.72)"]}
            locations={[0, 0.3, 0.55, 0.8, 1]}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: heroHeight * 0.72 }}
          />

          {/* Date/region label — top left (reference style) */}
          <View style={{ position: "absolute", top: 16, left: 16 }}>
            <View style={{
              backgroundColor: "rgba(10,14,26,0.55)",
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderWidth: 1,
              borderColor: "rgba(255,236,210,0.18)",
            }}>
              <Text style={{ color: "#F5EFE6", fontSize: 11, fontFamily: FONT, fontWeight: "500" }}>
                {p.status}
              </Text>
            </View>
          </View>

          {/* Save + price — top right */}
          <View style={{ position: "absolute", top: 12, right: 12, alignItems: "flex-end", gap: 8 }}>
            <Pressable
              onPress={onSave}
              style={{
                width: 36, height: 36,
                backgroundColor: "rgba(10,14,26,0.45)",
                borderRadius: 18,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,236,210,0.18)",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Icon name="heart" size={16} color={saved ? "#FF4757" : "#F5EFE6"} fill={saved ? "#FF4757" : "none"} strokeWidth={1.6} />
            </Pressable>
            <View style={{
              backgroundColor: "rgba(255,255,255,0.90)",
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 5,
            }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: color, fontFamily: FONT }}>₹{p.price}</Text>
            </View>
          </View>

          {/* Bottom text overlay */}
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 18 }}>
            <Text style={{ color: "rgba(245,239,230,0.62)", fontSize: 10, fontFamily: FONT, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
              {p.location}
            </Text>
            <Text
              style={{
                color: "#F5EFE6",
                fontSize: featured ? 28 : 20,
                fontFamily: FONT_HEAD,
                lineHeight: featured ? 32 : 24,
                letterSpacing: featured ? -0.8 : -0.3,
                fontWeight: "400",
              }}
              numberOfLines={2}
            >
              {p.title}
            </Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={{ paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", gap: 14 }}>
            {p.area  && <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT }}>📐 {p.area}</Text>}
            {p.beds  && <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT }}>🛏 {p.beds}</Text>}
            {p.baths && <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT }}>🚿 {p.baths}</Text>}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Avatar initials={isOwn ? "ME" : (p.owner_avatar || "??")} size={26} color={color} imageUrl={p.owner_image} />
            <Text style={{ color: !isOwn && p.owner_active === false ? C.red : C.fgDim, fontSize: 11, fontFamily: FONT }}>
              {isOwn ? "Me" : p.owner_name}{p.verified && !isOwn ? " ✓" : ""}
            </Text>
            {!isOwn && p.owner_active === false && (
              <View style={{ backgroundColor: C.red + "18", borderRadius: 100, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ color: C.red, fontSize: 9, fontFamily: FONT, fontWeight: "700" }}>Unavailable</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Insights ── */}
        {(ppsf || emi) && (
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingBottom: 14 }}>
            {ppsf && (
              <View style={{ backgroundColor: C.chipBg, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.glassBorder }}>
                <Text style={{ color: C.amberText, fontSize: 11, fontWeight: "600", fontFamily: FONT }}>📊 {ppsf}</Text>
              </View>
            )}
            {emi && (
              <View style={{ backgroundColor: C.chipBg, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.glassBorder }}>
                <Text style={{ color: C.green, fontSize: 11, fontWeight: "600", fontFamily: FONT }}>🏦 {emi}</Text>
              </View>
            )}
          </View>
        )}

      </View>
    </Pressable>
  );
}
