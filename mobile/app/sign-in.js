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
import { useApi } from "../src/hooks/useApi";

const RESEND_COOLDOWN = 30;

export default function SignIn() {
  useTheme();
  const { signIn, setActive, isLoaded } = useSignIn();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const api     = useApi();

  const [identifier,   setIdentifier]   = useState("");
  const [password,     setPassword]     = useState("");
  const [mfaCode,      setMfaCode]      = useState("");
  const [mfaStrategy,  setMfaStrategy]  = useState(null);
  const [mfaHint,      setMfaHint]      = useState("");
  const [stage,        setStage]        = useState("credentials");
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const factorConfigRef = useRef(null);
  const cooldownRef     = useRef(null);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

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

  const prepareMfa = async (si) => {
    const factors     = si.supportedSecondFactors ?? [];
    const emailFactor = factors.find(f => f.strategy === "email_code");
    const phoneFactor = factors.find(f => f.strategy === "phone_code");
    const totpFactor  = factors.find(f => f.strategy === "totp");

    if (emailFactor) {
      await si.prepareSecondFactor({ strategy: "email_code", emailAddressId: emailFactor.emailAddressId });
      factorConfigRef.current = emailFactor;
      setMfaStrategy("email_code");
      setMfaHint(emailFactor.safeIdentifier ?? "your email");
      startCooldown();
    } else if (phoneFactor) {
      await si.prepareSecondFactor({ strategy: "phone_code", phoneNumberId: phoneFactor.phoneNumberId });
      factorConfigRef.current = phoneFactor;
      setMfaStrategy("phone_code");
      setMfaHint(phoneFactor.safeIdentifier ?? "your phone");
      startCooldown();
    } else if (totpFactor) {
      factorConfigRef.current = totpFactor;
      setMfaStrategy("totp");
    } else {
      setMfaStrategy("backup_code");
    }
  };

  const submit = async () => {
    if (!isLoaded) return;
    try {
      setLoading(true);
      setError("");
      let id = identifier.trim();
      const isUsername = id.startsWith("@") || !id.includes("@");
      if (isUsername) {
        const handle = id.replace(/^@/, "");
        try {
          const { email } = await api.resolveUsername(handle);
          id = email;
        } catch {
          setError("Username not found. Try signing in with your email.");
          return;
        }
      }
      const created = await signIn.create({ identifier: id });
      const result  = await created.attemptFirstFactor({ strategy: "password", password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)/discover");
      } else if (result.status === "needs_second_factor") {
        await prepareMfa(result);
        setStage("mfa");
      } else {
        setError("Sign in could not be completed. Please try again.");
      }
    } catch (e) {
      setError(e.errors?.[0]?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const submitMfa = async () => {
    if (!isLoaded) return;
    try {
      setLoading(true);
      setError("");
      const result = await signIn.attemptSecondFactor({ strategy: mfaStrategy, code: mfaCode });
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

  const resend = async () => {
    if (!isLoaded || resendCooldown > 0 || !factorConfigRef.current) return;
    try {
      setLoading(true); setError(""); setMfaCode("");
      const fc = factorConfigRef.current;
      if (mfaStrategy === "email_code")
        await signIn.prepareSecondFactor({ strategy: "email_code", emailAddressId: fc.emailAddressId });
      else if (mfaStrategy === "phone_code")
        await signIn.prepareSecondFactor({ strategy: "phone_code", phoneNumberId: fc.phoneNumberId });
      startCooldown();
    } catch (e) {
      setError(e.errors?.[0]?.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  const canResend = mfaStrategy === "email_code" || mfaStrategy === "phone_code";
  const mfaLabel  =
    mfaStrategy === "totp"       ? "Enter the 6-digit code from your authenticator app." :
    mfaStrategy === "email_code" ? `We sent a code to ${mfaHint}.` :
    mfaStrategy === "phone_code" ? `We sent a code to ${mfaHint}.` :
                                   "Enter one of your backup codes.";

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

        {/* Tab switcher */}
        <View style={{ flexDirection: "row", gap: 5, backgroundColor: C.cardAlt, padding: 4, borderRadius: 100, marginBottom: 28 }}>
          <View style={{ flex: 1, paddingVertical: 11, borderRadius: 100, backgroundColor: C.amber, alignItems: "center", shadowColor: C.amber, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 }}>
            <Text style={{ fontWeight: "800", fontSize: 14, fontFamily: FONT, color: C.ink }}>Sign In</Text>
          </View>
          <Pressable onPress={() => router.push("/sign-up")} style={{ flex: 1, paddingVertical: 11, borderRadius: 100, alignItems: "center" }}>
            <Text style={{ fontWeight: "700", fontSize: 14, fontFamily: FONT, color: C.muted }}>Register</Text>
          </Pressable>
        </View>

        {/* Error */}
        {!!error && (
          <View style={{ backgroundColor: C.red + "18", borderRadius: 16, padding: 14, marginBottom: 20 }}>
            <Text style={{ color: C.red, fontSize: 13, fontFamily: FONT }}>⚠️ {error}</Text>
          </View>
        )}

        {stage === "credentials" ? (
          <>
            <NeoInput
              label="Email or @Username"
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="you@email.com or @handle"
              keyboardType={identifier.includes("@") && !identifier.startsWith("@") ? "email-address" : "default"}
            />
            <NeoInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry
            />
            <NeoButton full title={loading ? "Please wait…" : "Sign In →"} fill={C.amber} fg={C.ink} onPress={submit} disabled={loading} />
          </>
        ) : (
          <>
            <View style={{ backgroundColor: C.amber + "18", borderRadius: 16, padding: 16, marginBottom: 20 }}>
              <Text style={{ color: C.amberText, fontSize: 13, fontFamily: FONT, fontWeight: "600" }}>
                🔐 Two-factor authentication{"\n"}{mfaLabel}
              </Text>
            </View>
            <NeoInput label="Verification Code" value={mfaCode} onChangeText={setMfaCode} placeholder="123456" keyboardType="numeric" />
            <NeoButton full title={loading ? "Verifying…" : "Verify →"} fill={C.amber} fg={C.ink} onPress={submitMfa} disabled={loading} />
            {canResend && (
              <Pressable onPress={resend} disabled={resendCooldown > 0 || loading} style={{ marginTop: 14, alignItems: "center" }}>
                <Text style={{ color: resendCooldown > 0 ? C.muted : C.amber, fontSize: 13, fontFamily: FONT, fontWeight: "600" }}>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code →"}
                </Text>
              </Pressable>
            )}
            <Pressable onPress={() => { setStage("credentials"); setError(""); setMfaCode(""); }} style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={{ color: C.muted, fontSize: 13, fontFamily: FONT }}>← Back</Text>
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
