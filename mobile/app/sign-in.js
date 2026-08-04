import { useTheme } from "../src/context/ThemeContext";
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, Pressable,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { C, FONT, FONT_HEAD } from "../src/theme";
import NeoButton from "../src/components/NeoButton";
import { NeoInput } from "../src/components/ui";

const RESEND_COOLDOWN = 30;

export default function SignIn() {
  useTheme();
  const { signIn, setActive, isLoaded } = useSignIn();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [username,     setUsername]     = useState("");
  const [password,     setPassword]     = useState("");
  const [phone,        setPhone]        = useState("");
  // How the user signs in: "username" (username + password) | "phone" (SMS code)
  const [method,       setMethod]       = useState("username");
  const [code,         setCode]         = useState("");
  const [phoneHint,    setPhoneHint]    = useState("");
  // stage: "credentials" | "phoneCode"
  const [stage,        setStage]        = useState("credentials");
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const factorRef   = useRef(null);
  const cooldownRef = useRef(null);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const clean = (v) => v.replace(/^@/, "").replace(/[^a-z0-9_.]/gi, "").toLowerCase();

  // Normalise to E.164 (Clerk requires it). Defaults to +91 (India).
  const normalizePhone = (v) => {
    let d = v.replace(/[^\d+]/g, "");
    if (!d.startsWith("+")) d = "+91" + d.replace(/^0+/, "");
    return d;
  };

  const startCooldown = () => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setResendCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Username + password sign-in ──
  const submitUsername = async () => {
    if (!isLoaded) return;
    if (!clean(username)) { setError("Please enter your username."); return; }
    try {
      setLoading(true);
      setError("");
      const created = await signIn.create({ identifier: clean(username) });
      const result  = await created.attemptFirstFactor({ strategy: "password", password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)/discover");
      } else {
        setError("Sign in could not be completed. Please try again.");
      }
    } catch (e) {
      setError(e.errors?.[0]?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Passwordless phone sign-in (SMS code) ──
  const startPhoneSignIn = async () => {
    if (!isLoaded) return;
    if (!phone.trim()) { setError("Please enter your phone number."); return; }
    try {
      setLoading(true);
      setError("");
      const created = await signIn.create({ identifier: normalizePhone(phone) });
      const factor  = (created.supportedFirstFactors ?? []).find(f => f.strategy === "phone_code");
      if (!factor) { setError("No account uses this number for SMS sign-in."); return; }
      await created.prepareFirstFactor({ strategy: "phone_code", phoneNumberId: factor.phoneNumberId });
      factorRef.current = factor;
      setPhoneHint(factor.safeIdentifier ?? normalizePhone(phone));
      setCode("");
      startCooldown();
      setStage("phoneCode");
    } catch (e) {
      setError(e.errors?.[0]?.message || "Could not start phone sign-in");
    } finally {
      setLoading(false);
    }
  };

  const submitPhoneCode = async () => {
    if (!isLoaded) return;
    try {
      setLoading(true);
      setError("");
      const result = await signIn.attemptFirstFactor({ strategy: "phone_code", code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)/discover");
      } else {
        setError("Verification failed. Please try again.");
      }
    } catch (e) {
      setError(e.errors?.[0]?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const resendPhoneCode = async () => {
    if (!isLoaded || resendCooldown > 0 || !factorRef.current) return;
    try {
      setLoading(true); setError(""); setCode("");
      await signIn.prepareFirstFactor({ strategy: "phone_code", phoneNumberId: factorRef.current.phoneNumberId });
      startCooldown();
    } catch (e) {
      setError(e.errors?.[0]?.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 24, paddingHorizontal: 24, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* Logo pill */}
        <LinearGradient
          colors={[C.amber + "dd", "#F0A65A", "#B86A26"]}
          start={{ x: 0.2, y: 0.2 }} end={{ x: 1, y: 1 }}
          style={{ alignSelf: "flex-start", borderRadius: 100, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 32, shadowColor: C.amber, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 }}
        >
          <Text style={{ fontSize: 20, fontWeight: "400", color: "#1A0A00", fontFamily: FONT_HEAD }}>Zamin.</Text>
        </LinearGradient>

        {/* Heading */}
        <Text style={{ color: C.fg, fontSize: 38, fontWeight: "400", fontFamily: FONT_HEAD, lineHeight: 42, letterSpacing: -1, marginBottom: 8 }}>
          {"Welcome\n"}
          <Text style={{ color: C.fgDim, fontStyle: "italic" }}>Back.</Text>
        </Text>
        <Text style={{ color: C.fgDim, fontSize: 14, fontFamily: FONT, marginBottom: 36 }}>
          Sign in to browse and list properties
        </Text>

        {/* Error */}
        {!!error && (
          <View style={{ backgroundColor: C.red + "18", borderRadius: 16, padding: 14, marginBottom: 20 }}>
            <Text style={{ color: C.red, fontSize: 13, fontFamily: FONT }}>⚠️ {error}</Text>
          </View>
        )}

        {stage === "credentials" && (
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
              <>
                {/* Username with @ prefix */}
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ color: C.fgDim, fontSize: 11, fontWeight: "600", marginBottom: 6, fontFamily: FONT, letterSpacing: 0.8, textTransform: "uppercase" }}>Username</Text>
                  <View style={{ flexDirection: "row", alignItems: "stretch", backgroundColor: C.card, borderRadius: 14, overflow: "hidden", shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
                    <View style={{ paddingHorizontal: 13, paddingVertical: 12, backgroundColor: C.cardAlt, justifyContent: "center" }}>
                      <Text style={{ color: C.amberText, fontWeight: "900", fontSize: 15, fontFamily: FONT }}>@</Text>
                    </View>
                    <NeoInput value={username} onChangeText={v => setUsername(clean(v))} placeholder="yourhandle" style={{ flex: 1, marginBottom: 0 }} />
                  </View>
                </View>
                <NeoInput label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry />
                <NeoButton full title={loading ? "Please wait…" : "Sign In →"} fill={C.amber} fg={C.ink} onPress={submitUsername} disabled={loading} />
                <Pressable onPress={() => router.push("/forgot-password")} style={{ marginTop: 14, alignItems: "center" }}>
                  <Text style={{ color: C.amberText, fontSize: 13, fontFamily: FONT, fontWeight: "600" }}>Forgot password?</Text>
                </Pressable>
              </>
            ) : (
              <>
                <NeoInput label="Phone Number" value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" />
                <Text style={{ color: C.muted, fontSize: 10, marginTop: -8, marginBottom: 14, fontFamily: FONT }}>Include country code. Defaults to +91 (India). We'll text you a 6-digit code.</Text>
                <NeoButton full title={loading ? "Sending code…" : "Send Code →"} fill={C.amber} fg={C.ink} onPress={startPhoneSignIn} disabled={loading} />
              </>
            )}
          </>
        )}

        {stage === "phoneCode" && (
          <>
            <View style={{ backgroundColor: C.amber + "18", borderRadius: 16, padding: 16, marginBottom: 20 }}>
              <Text style={{ color: C.amberText, fontSize: 13, fontFamily: FONT, fontWeight: "600" }}>
                📬 We sent a code to {phoneHint}
              </Text>
            </View>
            <NeoInput label="Verification Code" value={code} onChangeText={setCode} placeholder="123456" keyboardType="numeric" />
            <NeoButton full title={loading ? "Verifying…" : "Verify →"} fill={C.amber} fg={C.ink} onPress={submitPhoneCode} disabled={loading} />
            <Pressable onPress={resendPhoneCode} disabled={resendCooldown > 0 || loading} style={{ marginTop: 14, alignItems: "center" }}>
              <Text style={{ color: resendCooldown > 0 ? C.muted : C.amber, fontSize: 13, fontFamily: FONT, fontWeight: "600" }}>
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code →"}
              </Text>
            </Pressable>
            <Pressable onPress={() => { setStage("credentials"); setError(""); setCode(""); }} style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={{ color: C.muted, fontSize: 13, fontFamily: FONT }}>← Wrong number?</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={() => router.push("/sign-up")} style={{ marginTop: 28, alignItems: "center" }}>
          <Text style={{ color: C.amberText, fontSize: 14, fontWeight: "700", fontFamily: FONT }}>
            Don't have an account? Register →
          </Text>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
