import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { C, FONT } from "../src/theme";
import NeoBox from "../src/components/NeoBox";
import NeoButton from "../src/components/NeoButton";
import { NeoInput } from "../src/components/ui";

const RESEND_COOLDOWN = 30;

export default function SignIn() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode]   = useState("");
  const [mfaStrategy, setMfaStrategy] = useState(null);
  const [mfaHint, setMfaHint]   = useState("");
  const [stage, setStage]       = useState("credentials");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Store factor config so resend doesn't need to re-read from stale signIn
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

  // si — the SignInResource returned from the previous step (avoids stale hook ref)
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
      // Chain calls on the returned resource to avoid stale hook references
      const created = await signIn.create({ identifier: email });
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
      // signIn hook ref is current at this point (no intervening create/attempt calls)
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
      setLoading(true);
      setError("");
      setMfaCode("");
      const fc = factorConfigRef.current;
      if (mfaStrategy === "email_code") {
        await signIn.prepareSecondFactor({ strategy: "email_code", emailAddressId: fc.emailAddressId });
      } else if (mfaStrategy === "phone_code") {
        await signIn.prepareSecondFactor({ strategy: "phone_code", phoneNumberId: fc.phoneNumberId });
      }
      startCooldown();
    } catch (e) {
      setError(e.errors?.[0]?.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  const canResend = mfaStrategy === "email_code" || mfaStrategy === "phone_code";

  const mfaLabel =
    mfaStrategy === "totp"        ? "Enter the 6-digit code from your authenticator app." :
    mfaStrategy === "email_code"  ? `We sent a code to ${mfaHint}.` :
    mfaStrategy === "phone_code"  ? `We sent a code to ${mfaHint}.` :
                                    "Enter one of your backup codes.";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20, backgroundColor: C.bg }} keyboardShouldPersistTaps="handled">
      <View style={{ alignSelf: "flex-start", marginBottom: 24, transform: [{ rotate: "-2deg" }] }}>
        <NeoBox offset={5} bg={C.amber} radius={16}>
          <View style={{ paddingHorizontal: 22, paddingVertical: 12 }}>
            <Text style={{ fontSize: 30, fontWeight: "900", color: C.ink, fontFamily: FONT }}>Zamin.</Text>
          </View>
        </NeoBox>
      </View>

      <NeoBox offset={7} fullWidth>
        <View style={{ padding: 26 }}>
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

          {stage === "credentials" ? (
            <>
              <NeoInput label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
              <NeoInput label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
              <NeoButton full title={loading ? "Signing in..." : "Sign In →"} onPress={submit} disabled={loading} />
            </>
          ) : (
            <>
              <View style={{ backgroundColor: C.amberDim, borderColor: C.amber, borderWidth: 2, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <Text style={{ color: C.amber, fontSize: 13, fontFamily: FONT, fontWeight: "600" }}>
                  🔐 Two-factor authentication{"\n"}{mfaLabel}
                </Text>
              </View>

              <NeoInput label="Verification Code" value={mfaCode} onChangeText={setMfaCode} placeholder="123456" keyboardType="numeric" />
              <NeoButton full title={loading ? "Verifying..." : "Verify →"} onPress={submitMfa} disabled={loading} />

              {canResend && (
                <Pressable onPress={resend} disabled={resendCooldown > 0 || loading} style={{ marginTop: 12, alignItems: "center" }}>
                  <Text style={{ color: resendCooldown > 0 ? C.muted : C.amber, fontSize: 13, fontFamily: FONT, fontWeight: "600" }}>
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive a code? Resend →"}
                  </Text>
                </Pressable>
              )}

              <Pressable onPress={() => { setStage("credentials"); setError(""); setMfaCode(""); }} style={{ marginTop: 12, alignItems: "center" }}>
                <Text style={{ color: C.muted, fontSize: 13, fontFamily: FONT }}>← Back</Text>
              </Pressable>
            </>
          )}
        </View>
      </NeoBox>

      <Pressable onPress={() => router.push("/sign-up")} style={{ marginTop: 16, alignItems: "center" }}>
        <Text style={{ color: C.amber, fontSize: 13, fontWeight: "700", fontFamily: FONT }}>Don't have an account? Register →</Text>
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
