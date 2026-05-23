import React, { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { C, FONT } from "../src/theme";
import NeoBox from "../src/components/NeoBox";
import NeoButton from "../src/components/NeoButton";
import { NeoInput } from "../src/components/ui";

export default function SignUp() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState("form"); // "form" | "verify"
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!isLoaded) return;
    try {
      setLoading(true);
      setError("");
      await signUp.create({ emailAddress: email, password, firstName: name.split(" ")[0], lastName: name.split(" ").slice(1).join(" ") });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStage("verify");
    } catch (e) {
      setError(e.errors?.[0]?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (!isLoaded) return;
    try {
      setLoading(true);
      setError("");
      const result = await signUp.attemptEmailAddressVerification({ code });
      await setActive({ session: result.createdSessionId });
      router.replace("/(tabs)/discover");
    } catch (e) {
      setError(e.errors?.[0]?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20, backgroundColor: C.bg }}>
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
            <Pressable onPress={() => router.push("/sign-in")} style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" }}>
              <Text style={{ fontWeight: "700", fontSize: 14, fontFamily: FONT, color: C.muted }}>Sign In</Text>
            </Pressable>
            <View style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: C.amber, borderWidth: 2, borderColor: C.ink, alignItems: "center" }}>
              <Text style={{ fontWeight: "700", fontSize: 14, fontFamily: FONT, color: C.ink }}>Register</Text>
            </View>
          </View>

          {error ? (
            <View style={{ borderColor: C.red, borderWidth: 2.5, borderRadius: 10, padding: 10, marginBottom: 16 }}>
              <Text style={{ color: C.red, fontSize: 13, fontFamily: FONT }}>⚠️ {error}</Text>
            </View>
          ) : null}

          {stage === "form" ? (
            <>
              <NeoInput label="Full Name" value={name} onChangeText={setName} placeholder="Your full name" />
              <NeoInput label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
              <NeoInput label="Password" value={password} onChangeText={setPassword} placeholder="Min. 8 characters" secureTextEntry />
              <NeoButton full title={loading ? "Creating account..." : "Create Account →"} onPress={submit} disabled={loading} />
            </>
          ) : (
            <>
              <View style={{ backgroundColor: C.amberDim, borderColor: C.amber, borderWidth: 2, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <Text style={{ color: C.amber, fontSize: 13, fontFamily: FONT, fontWeight: "600" }}>
                  📧 We sent a 6-digit code to {email}. Enter it below.
                </Text>
              </View>
              <NeoInput label="Verification Code" value={code} onChangeText={setCode} placeholder="123456" keyboardType="numeric" />
              <NeoButton full title={loading ? "Verifying..." : "Verify & Continue →"} onPress={verify} disabled={loading} />
            </>
          )}
        </View>
      </NeoBox>

      <Pressable onPress={() => router.push("/sign-in")} style={{ marginTop: 16, alignItems: "center" }}>
        <Text style={{ color: C.amber, fontSize: 13, fontWeight: "700", fontFamily: FONT }}>Already have an account? Sign In →</Text>
      </Pressable>
    </ScrollView>
  );
}
