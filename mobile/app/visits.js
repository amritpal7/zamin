// mobile/app/visits.js — in-app visit scheduling: my viewing requests, as a
// requester (I asked to view) and as an owner (someone wants to view my listing).

import React, { useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { C, FONT, FONT_MED, FONT_HEAD, FONT_HEAD_ITALIC } from "../src/theme";
import { useTheme } from "../src/context/ThemeContext";
import { Icon } from "../src/components/Icon";
import { useApi } from "../src/hooks/useApi";

const STATUS = {
  pending:   { label: "Pending",   fg: C.amberText, bg: C.amber + "22" },
  confirmed: { label: "Confirmed", fg: C.green,     bg: C.green + "22" },
  declined:  { label: "Declined",  fg: C.red,       bg: C.red + "22" },
  cancelled: { label: "Cancelled", fg: C.fgDim,     bg: C.chipBg },
};

function whenLabel(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

export default function Visits() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;
  useTheme();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // visit id being acted on

  const load = useCallback(() => {
    if (!isSignedIn) { setLoading(false); return; }
    return apiRef.current.getVisits().then(setRows).catch(() => setRows([]));
  }, [isSignedIn]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    Promise.resolve(load()).finally(() => setLoading(false));
  }, [load]));

  const act = async (id, fn) => {
    setBusy(id);
    try { const updated = await fn(); setRows((prev) => prev.map((v) => (v.id === id ? { ...v, ...updated } : v))); }
    catch { load(); }
    finally { setBusy(null); }
  };
  const respond = (id, status) => act(id, () => apiRef.current.respondVisit(id, status));
  const cancel  = (id)         => act(id, () => apiRef.current.cancelVisit(id));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/discover"); }}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="back" size={18} color={C.fg} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", fontFamily: FONT_MED, fontSize: 14, color: C.fg }}>Visits</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 20 }}>
          <Text style={{ color: C.fgDim, fontFamily: FONT, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Scheduled</Text>
          <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 34, lineHeight: 38, letterSpacing: -1 }}>
            Your{" "}
            <Text style={{ color: C.fgDim, fontFamily: FONT_HEAD_ITALIC, fontStyle: "italic" }}>visits.</Text>
          </Text>
        </View>

        {loading ? (
          <View style={{ paddingTop: 40, alignItems: "center" }}><ActivityIndicator color={C.amber} /></View>
        ) : rows.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 50, paddingHorizontal: 40, gap: 8 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.chipBg, alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
              <Icon name="clock" size={20} color={C.fgDim} strokeWidth={1.4} />
            </View>
            <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 18 }}>No visits yet.</Text>
            <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT, textAlign: "center", lineHeight: 18 }}>
              Open a listing and tap “Schedule a visit” to request a viewing. Requests you receive as an owner show up here too.
            </Text>
          </View>
        ) : (
          rows.map((v, i) => {
            const st = STATUS[v.status] || STATUS.pending;
            const isOwner = v.role === "owner";
            const canRespond = isOwner && v.status === "pending";
            const canCancel = v.status === "pending" || v.status === "confirmed";
            return (
              <View key={v.id} style={{ paddingHorizontal: 22, paddingVertical: 16, borderBottomWidth: i < rows.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: C.line }}>
                <Pressable onPress={() => router.push(`/property/${v.property_id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.chipBg, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 20 }}>{v.property_img || "🏠"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 14 }} numberOfLines={1}>{v.property_title || "Listing"}</Text>
                    <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT, marginTop: 2 }}>
                      {whenLabel(v.slot)} · {isOwner ? "Requested from you" : "Your request"}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: st.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ color: st.fg, fontSize: 11, fontFamily: FONT_MED }}>{st.label}</Text>
                  </View>
                </Pressable>

                {v.note ? (
                  <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT, marginTop: 8, marginLeft: 54, fontStyle: "italic" }} numberOfLines={2}>“{v.note}”</Text>
                ) : null}

                {(canRespond || canCancel) && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 12, marginLeft: 54 }}>
                    {canRespond && (
                      <>
                        <Pressable disabled={busy === v.id} onPress={() => respond(v.id, "confirmed")} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.amber, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                          <Icon name="check" size={13} color={C.ink} />
                          <Text style={{ color: C.ink, fontSize: 12, fontFamily: FONT_MED }}>Confirm</Text>
                        </Pressable>
                        <Pressable disabled={busy === v.id} onPress={() => respond(v.id, "declined")} style={{ backgroundColor: C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                          <Text style={{ color: C.fg, fontSize: 12, fontFamily: FONT_MED }}>Decline</Text>
                        </Pressable>
                      </>
                    )}
                    {canCancel && (
                      <Pressable disabled={busy === v.id} onPress={() => cancel(v.id)} style={{ backgroundColor: C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                        <Text style={{ color: C.red, fontSize: 12, fontFamily: FONT_MED }}>Cancel</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
