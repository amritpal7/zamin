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

function StageIndicator({ current }) {
  const stages = ["Account", "Email", "Verify"];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
      {stages.map((s, i) => {
        const done    = i + 1 < current;
        const active  = i + 1 === current;
        const pending = i + 1 > current;
        return (
          <React.Fragment key={s}>
            <View style={{ alignItems: "center", gap: 4 }}>
              <View style={{
                width: 30, height: 30, borderRadius: 15,
                backgroundColor: done ? C.green : active ? C.amber : C.cardAlt,
                alignItems: "center", justifyContent: "center",
                shadowColor: active ? C.amber : done ? C.green : "#000",
                shadowOffset: { width: 0, height: 2 }, shadowOpacity: active || done ? 0.35 : 0.05, shadowRadius: 6, elevation: active || done ? 4 : 1,
              }}>
                <Text style={{ fontSize: 12, fontWeight: "900", color: done || active ? C.ink : C.muted }}>
                  {done ? "✓" : i + 1}
                </Text>
              </View>
              <Text style={{ color: active ? C.amber : done ? C.green : C.muted, fontSize: 9, fontWeight: "700", fontFamily: FONT }}>{s}</Text>
            </View>
            {i < stages.length - 1 && (
              <View style={{ flex: 1, height: 2.5, backgroundColor: done ? C.green : C.dim, marginBottom: 16, marginHorizontal: 4 }} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

export default function SignUp() {
  useTheme();
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [username,  setUsername]  = useState("");
  const [password,  setPassword]  = useState("");
  const [email,     setEmail]     = useState("");
  const [code,      setCode]      = useState("");

  // stage: "details" | "email" | "verify"
  const [stage,   setStage]   = useState("details");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const clean = (v) => v.replace(/^@/, "").replace(/[^a-z0-9_.]/gi, "").toLowerCase();

  const submitDetails = async () => {
    if (!isLoaded) return;
    if (!firstName.trim()) { setError("First name is required."); return; }
    if (!password.trim() || password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError("");
    try {
      // Never pass `username` as a Clerk native field — it's only supported when
      // the instance has the Username attribute enabled. We store it exclusively
      // in unsafeMetadata so it works on every Clerk configuration.
      const result = await signUp.create({
        firstName:      firstName.trim(),
        lastName:       lastName.trim(),
        password,
        unsafeMetadata: { username: clean(username) },
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)/discover");
      } else {
        // status === "missing_requirements" — Clerk requires email verification
        setStage("email");
      }
    } catch (e) {
      const msg = e.errors?.[0]?.message || "";
      // Email-related errors → collect email in next stage
      msg.toLowerCase().includes("email")
        ? setStage("email")
        : setError(msg || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const submitEmail = async () => {
    if (!isLoaded) return;
    if (!email.trim()) { setError("Please enter your email address."); return; }
    setLoading(true);
    setError("");
    try {
      await signUp.update({ emailAddress: email.trim() });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStage("verify");
    } catch (e) {
      setError(e.errors?.[0]?.message || "Invalid email address");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError("");
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
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

  const stageNum = { details: 1, email: 2, verify: 3 }[stage];

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

      <View style={{}}>
        <View style={{ padding: 0 }}>

          {/* Tab row */}
          <View style={{ flexDirection: "row", gap: 5, marginBottom: 22, backgroundColor: C.cardAlt, padding: 4, borderRadius: 100 }}>
            <Pressable onPress={() => router.push("/sign-in")} style={{ flex: 1, paddingVertical: 10, borderRadius: 100, alignItems: "center" }}>
              <Text style={{ fontWeight: "700", fontSize: 14, fontFamily: FONT, color: C.muted }}>Sign In</Text>
            </Pressable>
            <View style={{ flex: 1, paddingVertical: 10, borderRadius: 100, backgroundColor: C.amber, alignItems: "center", shadowColor: C.amber, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 }}>
              <Text style={{ fontWeight: "800", fontSize: 14, fontFamily: FONT, color: C.ink }}>Register</Text>
            </View>
          </View>

          <StageIndicator current={stageNum} />

          {/* Error */}
          {!!error && (
            <View style={{ backgroundColor: C.red + "18", borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: C.red, fontSize: 13, fontFamily: FONT }}>⚠️ {error}</Text>
            </View>
          )}

          {/* ─ Stage 1: Details ─ */}
          {stage === "details" && (
            <>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <NeoInput label="First Name *" value={firstName} onChangeText={setFirstName} placeholder="Arjun" />
                </View>
                <View style={{ flex: 1 }}>
                  <NeoInput label="Last Name" value={lastName} onChangeText={setLastName} placeholder="Sharma" />
                </View>
              </View>

              {/* Username with @ prefix */}
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: C.amberText, fontSize: 12, fontWeight: "700", marginBottom: 6, fontFamily: FONT }}>Username</Text>
                <View style={{ flexDirection: "row", alignItems: "stretch", backgroundColor: C.card, borderRadius: 14, overflow: "hidden", shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
                  <View style={{ paddingHorizontal: 13, paddingVertical: 12, backgroundColor: C.cardAlt, justifyContent: "center" }}>
                    <Text style={{ color: C.amberText, fontWeight: "900", fontSize: 15, fontFamily: FONT }}>@</Text>
                  </View>
                  <NeoInput
                    value={username}
                    onChangeText={v => setUsername(clean(v))}
                    placeholder="yourhandle"
                    style={{ flex: 1, marginBottom: 0 }}
                  />
                </View>
                <Text style={{ color: C.muted, fontSize: 10, marginTop: 4, fontFamily: FONT }}>Lowercase letters, numbers, _ and . only</Text>
              </View>

              <NeoInput label="Password *" value={password} onChangeText={setPassword} placeholder="Min. 8 characters" secureTextEntry />

              <NeoButton full title={loading ? "Creating account…" : "Continue →"} onPress={submitDetails} disabled={loading} />

              {/* Value props */}
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 18 }}>
                {["🏠 Free listing", "0% Brokerage", "🔒 Secure"].map(item => (
                  <Text key={item} style={{ color: C.muted, fontSize: 10, fontFamily: FONT, fontWeight: "600" }}>{item}</Text>
                ))}
              </View>
            </>
          )}

          {/* ─ Stage 2: Email ─ */}
          {stage === "email" && (
            <>
              <View style={{ backgroundColor: C.amberDim, borderRadius: 16, padding: 14, marginBottom: 18 }}>
                <Text style={{ color: C.amberText, fontSize: 13, fontFamily: FONT, fontWeight: "700", marginBottom: 4 }}>📧 One more step</Text>
                <Text style={{ color: C.muted, fontSize: 12, fontFamily: FONT, lineHeight: 18 }}>
                  Add your email for account recovery and to get a ✓ Verified badge on your listings.
                </Text>
              </View>
              <NeoInput label="Email Address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
              <NeoButton full title={loading ? "Sending code…" : "Send Verification Code →"} onPress={submitEmail} disabled={loading} />
              <Pressable onPress={() => setStage("details")} style={{ marginTop: 12, alignItems: "center" }}>
                <Text style={{ color: C.muted, fontSize: 12, fontFamily: FONT }}>← Back</Text>
              </Pressable>
            </>
          )}

          {/* ─ Stage 3: Verify ─ */}
          {stage === "verify" && (
            <>
              <View style={{ backgroundColor: C.amberDim, borderRadius: 16, padding: 14, marginBottom: 18 }}>
                <Text style={{ color: C.amberText, fontSize: 13, fontFamily: FONT, fontWeight: "600" }}>
                  📬 Code sent to {email}
                </Text>
              </View>
              <NeoInput label="6-Digit Code" value={code} onChangeText={setCode} placeholder="123456" keyboardType="numeric" />
              <NeoButton full title={loading ? "Verifying…" : "Verify & Enter Zamin →"} onPress={verify} disabled={loading} />
              <Pressable onPress={() => setStage("email")} style={{ marginTop: 12, alignItems: "center" }}>
                <Text style={{ color: C.muted, fontSize: 12, fontFamily: FONT }}>← Wrong email?</Text>
              </Pressable>
            </>
          )}

        </View>
      </View>

      <Pressable onPress={() => router.push("/sign-in")} style={{ marginTop: 20, alignItems: "center" }}>
        <Text style={{ color: C.amberText, fontSize: 14, fontWeight: "700", fontFamily: FONT }}>Already have an account? Sign In →</Text>
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
