import React, { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { C, FONT } from "../src/theme";
import NeoBox from "../src/components/NeoBox";
import NeoButton from "../src/components/NeoButton";
import { NeoInput } from "../src/components/ui";

export default function SignIn() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!isLoaded) return;
    try {
      setLoading(true);
      setError("");
      const result = await signIn.create({ identifier: email, password });
      await setActive({ session: result.createdSessionId });
      router.replace("/(tabs)/discover");
    } catch (e) {
      setError(e.errors?.[0]?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20, backgroundColor: C.bg }}>
      {/* Logo */}
      <View style={{ alignSelf: "flex-start", marginBottom: 24, transform: [{ rotate: "-2deg" }] }}>
        <NeoBox offset={5} bg={C.amber} radius={16}>
          <View style={{ paddingHorizontal: 22, paddingVertical: 12 }}>
            <Text style={{ fontSize: 30, fontWeight: "900", color: C.ink, fontFamily: FONT }}>Zamin.</Text>
          </View>
        </NeoBox>
      </View>

      <NeoBox offset={7} fullWidth>
        <View style={{ padding: 26 }}>
          {/* Tab row */}
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 22, backgroundColor: C.bg, padding: 5, borderRadius: 12, borderWidth: 2.5, borderColor: C.ink }}>
            <View style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: C.amber, borderWidth: 2, borderColor: C.ink, alignItems: "center" }}>
              <Text style={{ fontWeight: "700", fontSize: 14, fontFamily: FONT, color: C.ink }}>Sign In</Text>
            </View>
            <Pressable onPress={() => router.push("/sign-up")} style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" }}>
              <Text style={{ fontWeight: "700", fontSize: 14, fontFamily: FONT, color: C.muted }}>Register</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={{ borderColor: C.red, borderWidth: 2.5, borderRadius: 10, padding: 10, marginBottom: 16 }}>
              <Text style={{ color: C.red, fontSize: 13, fontFamily: FONT }}>⚠️ {error}</Text>
            </View>
          ) : null}

          <NeoInput label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
          <NeoInput label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />

          <NeoButton full title={loading ? "Signing in..." : "Sign In →"} onPress={submit} disabled={loading} />

          <Text style={{ textAlign: "center", marginVertical: 16, color: C.muted, fontSize: 13, fontFamily: FONT }}>— or —</Text>

          <Pressable onPress={() => router.replace("/(tabs)/discover")} style={{ borderWidth: 2.5, borderColor: C.muted, borderStyle: "dashed", borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ color: C.muted, fontSize: 13, fontWeight: "600", fontFamily: FONT }}>Browse as Guest (limited access)</Text>
          </Pressable>
        </View>
      </NeoBox>

      <Pressable onPress={() => router.push("/sign-up")} style={{ marginTop: 16, alignItems: "center" }}>
        <Text style={{ color: C.amber, fontSize: 13, fontWeight: "700", fontFamily: FONT }}>Don't have an account? Register →</Text>
      </Pressable>
    </ScrollView>
  );
}
