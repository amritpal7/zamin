import { useTheme } from "../src/context/ThemeContext";
import React, { useState } from "react";
import {
  View, Text, ScrollView, Pressable,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { C, FONT, FONT_HEAD } from "../src/theme";
import NeoButton from "../src/components/NeoButton";
import { NeoInput } from "../src/components/ui";

export default function SignUp() {
  useTheme();
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone,    setPhone]    = useState("");
  const [code,     setCode]     = useState("");

  // How the user registers: "username" (username + password, instant) | "phone" (phone + SMS)
  const [method,  setMethod]  = useState("username");
  // stage: "details" | "verify" (verify only used by the phone method)
  const [stage,   setStage]   = useState("details");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const clean = (v) => v.replace(/^@/, "").replace(/[^a-z0-9_.]/gi, "").toLowerCase();

  // Normalise to E.164 (Clerk requires it). Defaults to +91 (India).
  const normalizePhone = (v) => {
    let d = v.replace(/[^\d+]/g, "");
    if (!d.startsWith("+")) d = "+91" + d.replace(/^0+/, "");
    return d;
  };

  const submitDetails = async () => {
    if (!isLoaded) return;
    if (!password.trim() || password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError("");
    try {
      if (method === "username") {
        if (!clean(username)) { setError("Username is required."); setLoading(false); return; }
        const result = await signUp.create({ username: clean(username), password });
        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId });
          router.replace("/(tabs)/discover");
        } else {
          const missing = [...(result.missingFields || []), ...(result.unverifiedFields || [])];
          console.log("[sign-up] incomplete:", result.status, "missing:", missing);
          setError(
            missing.length
              ? `Clerk still requires: ${missing.join(", ")}. In Clerk → User & Authentication, set those to optional (or off).`
              : "Couldn't finish sign up. Check your Clerk identifier settings."
          );
        }
      } else {
        if (!phone.trim()) { setError("Phone number is required."); setLoading(false); return; }
        const result = await signUp.create({ phoneNumber: normalizePhone(phone), password });
        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId });
          router.replace("/(tabs)/discover");
        } else {
          await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
          setStage("verify");
        }
      }
    } catch (e) {
      setError(e.errors?.[0]?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError("");
    try {
      const result = await signUp.attemptPhoneNumberVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)/discover");
      } else {
        setError("Verification incomplete — please try again.");
      }
    } catch (e) {
      setError(e.errors?.[0]?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!isLoaded) return;
    setLoading(true); setError(""); setCode("");
    try {
      await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
    } catch (e) {
      setError(e.errors?.[0]?.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: 60, paddingHorizontal: 24, paddingBottom: 40, backgroundColor: C.bg }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

      {/* Logo pill */}
      <LinearGradient
        colors={[C.amber + "dd", "#F0A65A", "#B86A26"]}
        start={{ x: 0.2, y: 0.2 }} end={{ x: 1, y: 1 }}
        style={{ alignSelf: "flex-start", borderRadius: 100, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 28, shadowColor: C.amber, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 }}
      >
        <Text style={{ fontSize: 20, fontWeight: "400", color: "#1A0A00", fontFamily: FONT_HEAD }}>Zamin.</Text>
      </LinearGradient>

      {/* Heading */}
      <Text style={{ color: C.fg, fontSize: 38, fontWeight: "400", fontFamily: FONT_HEAD, lineHeight: 42, letterSpacing: -1, marginBottom: 6 }}>
        {"Create Your\n"}
        <Text style={{ color: C.fgDim, fontStyle: "italic" }}>Account.</Text>
      </Text>
      <Text style={{ color: C.fgDim, fontSize: 14, fontFamily: FONT, marginBottom: 28 }}>
        Free listings · Zero brokerage
      </Text>

      {/* Error */}
      {!!error && (
        <View style={{ backgroundColor: C.red + "18", borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <Text style={{ color: C.red, fontSize: 13, fontFamily: FONT }}>⚠️ {error}</Text>
        </View>
      )}

      {/* ─ Stage 1: Details ─ */}
      {stage === "details" && (
        <>
          {/* Username / Phone method toggle */}
          <View style={{ flexDirection: "row", gap: 5, marginBottom: 20, backgroundColor: C.cardAlt, padding: 4, borderRadius: 100 }}>
            {[["username", "👤 Username"], ["phone", "📱 Phone"]].map(([key, lbl]) => {
              const active = method === key;
              return (
                <Pressable key={key} onPress={() => { setMethod(key); setError(""); }} style={{ flex: 1, paddingVertical: 10, borderRadius: 100, alignItems: "center", backgroundColor: active ? C.amber : "transparent", shadowColor: active ? C.amber : "transparent", shadowOffset: { width: 0, height: 3 }, shadowOpacity: active ? 0.4 : 0, shadowRadius: 8, elevation: active ? 4 : 0 }}>
                  <Text style={{ fontWeight: active ? "800" : "700", fontSize: 13, fontFamily: FONT, color: active ? C.ink : C.muted }}>{lbl}</Text>
                </Pressable>
              );
            })}
          </View>

          {method === "username" ? (
            /* Username with @ prefix */
            <View style={{ marginBottom: 14 }}>
              <Text style={{ color: C.amberText, fontSize: 12, fontWeight: "700", marginBottom: 6, fontFamily: FONT }}>Username *</Text>
              <View style={{ flexDirection: "row", alignItems: "stretch", backgroundColor: C.card, borderRadius: 14, overflow: "hidden", shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
                <View style={{ paddingHorizontal: 13, paddingVertical: 12, backgroundColor: C.cardAlt, justifyContent: "center" }}>
                  <Text style={{ color: C.amberText, fontWeight: "900", fontSize: 15, fontFamily: FONT }}>@</Text>
                </View>
                <NeoInput value={username} onChangeText={v => setUsername(clean(v))} placeholder="yourhandle" style={{ flex: 1, marginBottom: 0 }} />
              </View>
              <Text style={{ color: C.muted, fontSize: 10, marginTop: 4, fontFamily: FONT }}>Lowercase letters, numbers, _ and . only</Text>
            </View>
          ) : (
            <>
              <NeoInput label="Phone Number *" value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" />
              <Text style={{ color: C.muted, fontSize: 10, marginTop: -8, marginBottom: 14, fontFamily: FONT }}>Include country code. Defaults to +91 (India). We'll text you a 6-digit code.</Text>
            </>
          )}

          <NeoInput label="Password *" value={password} onChangeText={setPassword} placeholder="Min. 8 characters" secureTextEntry />

          <NeoButton full title={loading ? "Please wait…" : (method === "phone" ? "Send code →" : "Create account →")} onPress={submitDetails} disabled={loading} />

          {/* Value props */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 18 }}>
            {["🏠 Free listing", "0% Brokerage", "🔒 Secure"].map(item => (
              <Text key={item} style={{ color: C.muted, fontSize: 10, fontFamily: FONT, fontWeight: "600" }}>{item}</Text>
            ))}
          </View>
        </>
      )}

      {/* ─ Stage 2: Verify (phone SMS only) ─ */}
      {stage === "verify" && (
        <>
          <View style={{ backgroundColor: C.amberDim, borderRadius: 16, padding: 14, marginBottom: 18 }}>
            <Text style={{ color: C.amberText, fontSize: 13, fontFamily: FONT, fontWeight: "600" }}>
              📬 Code sent to {normalizePhone(phone)}
            </Text>
          </View>
          <NeoInput label="6-Digit Code" value={code} onChangeText={setCode} placeholder="123456" keyboardType="numeric" />
          <NeoButton full title={loading ? "Verifying…" : "Verify & Enter Zamin →"} onPress={verify} disabled={loading} />
          <Pressable onPress={resend} disabled={loading} style={{ marginTop: 14, alignItems: "center" }}>
            <Text style={{ color: C.amber, fontSize: 13, fontFamily: FONT, fontWeight: "600" }}>Resend code →</Text>
          </Pressable>
          <Pressable onPress={() => { setStage("details"); setError(""); setCode(""); }} style={{ marginTop: 12, alignItems: "center" }}>
            <Text style={{ color: C.muted, fontSize: 12, fontFamily: FONT }}>← Wrong number?</Text>
          </Pressable>
        </>
      )}

      <Pressable onPress={() => router.push("/sign-in")} style={{ marginTop: 20, alignItems: "center" }}>
        <Text style={{ color: C.amberText, fontSize: 14, fontWeight: "700", fontFamily: FONT }}>Already have an account? Sign In →</Text>
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
