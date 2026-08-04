import { useTheme } from "../src/context/ThemeContext";
import React, { useState } from "react";
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

// Password reset via Clerk. A reset code is sent to the account's verified email
// or phone; the user enters the code + a new password. Requires the account to
// have a verified email or phone and "reset password" enabled in Clerk.
export default function ForgotPassword() {
  useTheme();
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [identifier, setIdentifier] = useState("");
  const [code,       setCode]       = useState("");
  const [password,   setPassword]   = useState("");
  const [strategy,   setStrategy]   = useState(null);   // reset_password_email_code | reset_password_phone_code
  const [hint,       setHint]       = useState("");
  // stage: "request" (enter identifier) | "reset" (code + new password)
  const [stage,   setStage]   = useState("request");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  // Send a reset code to the account's email/phone.
  const requestReset = async () => {
    if (!isLoaded) return;
    if (!identifier.trim()) { setError("Enter your username, email, or phone."); return; }
    try {
      setLoading(true);
      setError("");
      const created = await signIn.create({ identifier: identifier.trim() });
      const factors = created.supportedFirstFactors ?? [];
      const factor  = factors.find(f => f.strategy === "reset_password_email_code")
                   || factors.find(f => f.strategy === "reset_password_phone_code");
      if (!factor) {
        setError("This account has no email or phone to reset with. Add one in Settings, then try again.");
        return;
      }
      await created.prepareFirstFactor(
        factor.strategy === "reset_password_email_code"
          ? { strategy: factor.strategy, emailAddressId: factor.emailAddressId }
          : { strategy: factor.strategy, phoneNumberId: factor.phoneNumberId }
      );
      setStrategy(factor.strategy);
      setHint(factor.safeIdentifier ?? "");
      setStage("reset");
    } catch (e) {
      setError(e.errors?.[0]?.message || "Could not start password reset.");
    } finally {
      setLoading(false);
    }
  };

  // Verify the code and set the new password.
  const submitReset = async () => {
    if (!isLoaded) return;
    if (!password.trim() || password.length < 8) { setError("New password must be at least 8 characters."); return; }
    try {
      setLoading(true);
      setError("");
      const res = await signIn.attemptFirstFactor({ strategy, code });
      if (res.status === "needs_new_password") {
        const done = await signIn.resetPassword({ password });
        if (done.status === "complete") {
          await setActive({ session: done.createdSessionId });
          router.replace("/(tabs)/discover");
        } else {
          setError("Could not set the new password. Please try again.");
        }
      } else if (res.status === "complete") {
        await setActive({ session: res.createdSessionId });
        router.replace("/(tabs)/discover");
      } else {
        setError("Verification failed. Please try again.");
      }
    } catch (e) {
      setError(e.errors?.[0]?.message || "Verification failed.");
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
          {"Reset\n"}
          <Text style={{ color: C.fgDim, fontStyle: "italic" }}>Password.</Text>
        </Text>
        <Text style={{ color: C.fgDim, fontSize: 14, fontFamily: FONT, marginBottom: 32 }}>
          {stage === "request"
            ? "We'll send a reset code to your email or phone."
            : `Enter the code sent to ${hint || "you"} and a new password.`}
        </Text>

        {/* Error */}
        {!!error && (
          <View style={{ backgroundColor: C.red + "18", borderRadius: 16, padding: 14, marginBottom: 20 }}>
            <Text style={{ color: C.red, fontSize: 13, fontFamily: FONT }}>⚠️ {error}</Text>
          </View>
        )}

        {stage === "request" ? (
          <>
            <NeoInput
              label="Username, email, or phone"
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="@handle · you@email.com · +91…"
              autoCapitalize="none"
            />
            <NeoButton full title={loading ? "Sending code…" : "Send reset code →"} fill={C.amber} fg={C.ink} onPress={requestReset} disabled={loading} />
          </>
        ) : (
          <>
            <NeoInput label="Reset Code" value={code} onChangeText={setCode} placeholder="123456" keyboardType="numeric" />
            <NeoInput label="New Password" value={password} onChangeText={setPassword} placeholder="Min. 8 characters" secureTextEntry />
            <NeoButton full title={loading ? "Resetting…" : "Reset & Sign In →"} fill={C.amber} fg={C.ink} onPress={submitReset} disabled={loading} />
            <Pressable onPress={() => { setStage("request"); setError(""); setCode(""); setPassword(""); }} style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={{ color: C.muted, fontSize: 13, fontFamily: FONT }}>← Start over</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={() => router.replace("/sign-in")} style={{ marginTop: 28, alignItems: "center" }}>
          <Text style={{ color: C.amberText, fontSize: 14, fontWeight: "700", fontFamily: FONT }}>← Back to Sign In</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
