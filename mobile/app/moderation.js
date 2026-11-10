// mobile/app/moderation.js — admin moderation queue: reported listings + reported users.
// Visible from Me → Moderation only for admins (server enforces ADMIN_USER_IDS on every call).
import React, { useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, FONT, FONT_MED, FONT_HEAD } from "../src/theme";
import { useTheme } from "../src/context/ThemeContext";
import { Icon } from "../src/components/Icon";
import { useApi } from "../src/hooks/useApi";
import SmartImage from "../src/components/SmartImage";
import ConfirmModal from "../src/components/ConfirmModal";
import { timeAgo } from "../src/utils/time";

function Pill({ label, color }) {
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: color + "22", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color, fontFamily: FONT_MED, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function Action({ label, onPress, danger, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
        backgroundColor: danger ? C.red + "1F" : C.chipBg,
        borderWidth: StyleSheet.hairlineWidth, borderColor: danger ? C.red + "55" : C.glassBorder,
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      <Text style={{ color: danger ? C.red : C.fg, fontFamily: FONT_MED, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

function Card({ children }) {
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, padding: 14, marginBottom: 12 }}>
      {children}
    </View>
  );
}

const reasonText = (reasons) => (reasons || []).filter(Boolean).join(", ") || "no reason given";

export default function Moderation() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;                // useApi() isn't referentially stable — pin it
  useTheme();

  const [data, setData] = useState({ listings: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(null);         // id currently being actioned
  const [banTarget, setBanTarget] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setData(await apiRef.current.getReports());
    } catch (e) {
      setError(e.message === "Admins only" ? "This screen is for admins only." : (e.message || "Couldn't load reports."));
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const act = async (id, fn) => {
    setBusy(id);
    try { await fn(); await load(); }
    catch (e) { Alert.alert("Action failed", e.message || "Please try again."); }
    finally { setBusy(null); }
  };

  const confirmBan = async () => {
    const u = banTarget;
    setBanTarget(null);
    await act(u.user_id, () => apiRef.current.moderateUser(u.user_id, u.banned ? "unban" : "ban"));
  };

  const empty = !data.listings.length && !data.users.length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/profile"); }}
          accessibilityLabel="Back"
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="back" size={18} color={C.fg} />
        </Pressable>
        <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 18 }}>Moderation</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.amber} />}
      >
        {loading ? (
          <View style={{ paddingTop: 60, alignItems: "center" }}><ActivityIndicator color={C.amber} /></View>
        ) : error ? (
          <Text style={{ color: C.fgDim, fontFamily: FONT, textAlign: "center", marginTop: 40 }}>{error}</Text>
        ) : empty ? (
          <View style={{ alignItems: "center", paddingTop: 60, gap: 8 }}>
            <Icon name="check" size={28} color={C.green} />
            <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 18 }}>All clear.</Text>
            <Text style={{ color: C.fgDim, fontFamily: FONT, fontSize: 12 }}>No open reports.</Text>
          </View>
        ) : (
          <>
            {data.listings.length > 0 && (
              <Text style={{ color: C.fgDim, fontFamily: FONT, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
                Reported listings · {data.listings.length}
              </Text>
            )}
            {data.listings.map((l) => (
              <Card key={l.id}>
                <Pressable onPress={() => router.push(`/property/${l.id}`)} style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 14, overflow: "hidden", backgroundColor: C.chipBg, alignItems: "center", justifyContent: "center" }}>
                    {l.thumb || l.image
                      ? <SmartImage uri={l.thumb || l.image} style={StyleSheet.absoluteFill} />
                      : <Icon name="home" size={22} color={C.fgDim} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 14 }}>{l.title}</Text>
                    <Text numberOfLines={1} style={{ color: C.fgDim, fontFamily: FONT, fontSize: 11, marginTop: 2 }}>
                      {l.owner_username ? `@${l.owner_username}` : l.owner_name || "Owner"} · {l.location || "—"}
                    </Text>
                    <Text numberOfLines={2} style={{ color: C.fgDim, fontFamily: FONT, fontSize: 11, marginTop: 4 }}>
                      {l.reporters} report{l.reporters === 1 ? "" : "s"} · {reasonText(l.reasons)}{l.last_reported_at ? ` · ${timeAgo(l.last_reported_at)}` : ""}
                    </Text>
                  </View>
                  {l.owner_banned
                    ? <Pill label="Owner banned" color={C.red} />
                    : l.flagged ? <Pill label="Hidden" color={C.red} /> : <Pill label="Visible" color={C.green} />}
                </Pressable>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {l.flagged
                    ? <Action label="Restore" disabled={busy === l.id} onPress={() => act(l.id, () => apiRef.current.moderateListing(l.id, "restore"))} />
                    : <Action label="Hide listing" danger disabled={busy === l.id} onPress={() => act(l.id, () => apiRef.current.moderateListing(l.id, "hide"))} />}
                  <Action label="Dismiss reports" disabled={busy === l.id} onPress={() => act(l.id, () => apiRef.current.moderateListing(l.id, "dismiss"))} />
                </View>
              </Card>
            ))}

            {data.users.length > 0 && (
              <Text style={{ color: C.fgDim, fontFamily: FONT, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginVertical: 10 }}>
                Reported users · {data.users.length}
              </Text>
            )}
            {data.users.map((u) => (
              <Card key={u.user_id}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 14 }}>
                      {u.username ? `@${u.username}` : u.name || (u.exists === false ? "Deleted account" : "User")}
                    </Text>
                    <Text numberOfLines={2} style={{ color: C.fgDim, fontFamily: FONT, fontSize: 11, marginTop: 4 }}>
                      {u.reporters} report{u.reporters === 1 ? "" : "s"} · {reasonText(u.reasons)}{u.last_reported_at ? ` · ${timeAgo(u.last_reported_at)}` : ""}
                    </Text>
                  </View>
                  {u.banned && <Pill label="Banned" color={C.red} />}
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {u.exists !== false && (
                    <Action label={u.banned ? "Unban" : "Ban user"} danger={!u.banned} disabled={busy === u.user_id} onPress={() => setBanTarget(u)} />
                  )}
                  <Action label="Dismiss reports" disabled={busy === u.user_id} onPress={() => act(u.user_id, () => apiRef.current.moderateUser(u.user_id, "dismiss"))} />
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      {banTarget && (
        <ConfirmModal
          visible
          title={banTarget.banned ? "Unban this user?" : "Ban this user?"}
          message={banTarget.banned
            ? "They'll be able to sign in again and their listings will be visible."
            : "They won't be able to sign in, and all their listings will be hidden. You can unban them later."}
          confirmLabel={banTarget.banned ? "Unban" : "Ban"}
          confirmColor={banTarget.banned ? C.green : C.red}
          onConfirm={confirmBan}
          onCancel={() => setBanTarget(null)}
        />
      )}
    </View>
  );
}
