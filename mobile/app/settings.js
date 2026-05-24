// mobile/app/settings.js — refactored to the Zamin design language.
// Editorial serif header, hairline SVG icons, glass section cards, accent-color toggles.
// All business logic (Clerk profile/email/password flows + theme switching) preserved.

import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useUser, useClerk } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { C, FONT, FONT_MED, FONT_HEAD, FONT_HEAD_ITALIC } from "../src/theme";
import { Icon } from "../src/components/Icon";
import { useTheme } from "../src/context/ThemeContext";

const THEME_MODES = [
  { key: "dark",   label: "Dark",   icon: "moon" },
  { key: "light",  label: "Light",  icon: "sparkle" },
  { key: "system", label: "System", icon: "globe" },
];

// ── Reusable bits ────────────────────────────────────────────────────────

function GlassCard({ children, style }) {
  return (
    <View style={[{
      backgroundColor: C.glassBg,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.glassBorder,
      overflow: "hidden",
    }, style]}>
      {children}
    </View>
  );
}

function SectionLabel({ children, top }) {
  return (
    <Text style={{
      color: C.fgDim, fontSize: 11, fontFamily: FONT, letterSpacing: 1,
      textTransform: "uppercase", paddingHorizontal: 14, paddingBottom: 8,
      paddingTop: top || 0,
    }}>
      {children}
    </Text>
  );
}

function Row({ icon, label, hint, onPress, danger, last, right }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 14,
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: C.line,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: danger ? C.red + "20" : C.chipBg,
        alignItems: "center", justifyContent: "center",
      }}>
        <Icon name={icon} size={16} color={danger ? C.red : C.fg} strokeWidth={1.5} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: FONT_MED, fontSize: 14, color: danger ? C.red : C.fg }}>{label}</Text>
        {hint && <Text style={{ fontSize: 11, color: C.fgDim, fontFamily: FONT, marginTop: 1 }}>{hint}</Text>}
      </View>
      {right || <Icon name="chevR" size={16} color={C.fgDim} strokeWidth={1.4} />}
    </Pressable>
  );
}

function GlassInput({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? (
        <Text style={{ color: C.fgDim, fontSize: 11, fontFamily: FONT, marginBottom: 6, letterSpacing: 0.8, textTransform: "uppercase" }}>
          {label}
        </Text>
      ) : null}
      <View style={{
        backgroundColor: C.glassBg, borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder,
      }}>
        <TextInput
          value={value} onChangeText={onChangeText} placeholder={placeholder}
          placeholderTextColor={C.fgFaint} secureTextEntry={secureTextEntry}
          keyboardType={keyboardType} autoCapitalize={autoCapitalize || "none"}
          style={{ paddingHorizontal: 14, paddingVertical: 12, color: C.fg, fontSize: 14, fontFamily: FONT }}
        />
      </View>
    </View>
  );
}

function PillBtn({ title, onPress, primary, secondary, disabled, loading, danger }) {
  let bg = C.chipBg, fg = C.fg;
  if (primary)   { bg = C.amber; fg = C.ink; }
  if (danger)    { bg = C.red + "1A"; fg = C.red; }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1, paddingVertical: 13, borderRadius: 100,
        backgroundColor: bg,
        borderWidth: secondary ? StyleSheet.hairlineWidth : 0,
        borderColor: C.glassBorder,
        alignItems: "center", justifyContent: "center",
        opacity: pressed ? 0.85 : disabled ? 0.5 : 1,
      })}
    >
      {loading ? <ActivityIndicator color={fg} size="small" /> : (
        <Text style={{ color: fg, fontFamily: FONT_MED, fontSize: 13 }}>{title}</Text>
      )}
    </Pressable>
  );
}

function AccentDisc({ initials }) {
  return (
    <LinearGradient
      colors={[C.amber + "cc", "#B86A26"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{
        width: 52, height: 52, borderRadius: 26,
        alignItems: "center", justifyContent: "center",
        shadowColor: C.amber, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
      }}
    >
      <Text style={{ fontFamily: FONT_HEAD, fontSize: 22, color: "#1A0A00" }}>{initials}</Text>
    </LinearGradient>
  );
}

// ── Main ────────────────────────────────────────────────────────

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode, setTheme } = useTheme();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const [editing,   setEditing]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [username,  setUsername]  = useState("");

  const [emailStage,      setEmailStage]      = useState("idle");
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmail,        setNewEmail]        = useState("");
  const [emailCode,       setEmailCode]       = useState("");
  const [emailLoading,    setEmailLoading]    = useState(false);
  const [emailError,      setEmailError]      = useState("");
  const [pendingEmailId,  setPendingEmailId]  = useState(null);

  const [pwStage,   setPwStage]   = useState("idle");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw,     setNewPw]     = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError,   setPwError]   = useState("");

  const startEdit = () => {
    setFirstName(user?.firstName || "");
    setLastName(user?.lastName  || "");
    setUsername(user?.unsafeMetadata?.username || "");
    setEditing(true);
  };

  const saveProfile = async () => {
    if (!firstName.trim()) { Alert.alert("Required", "First name cannot be empty."); return; }
    try {
      setSaving(true);
      await user.update({
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        unsafeMetadata: { username: username.replace(/^@/, "").toLowerCase() },
      });
      setEditing(false);
    } catch (e) {
      Alert.alert("Error", e.errors?.[0]?.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const startEmailChange = (isChange) => {
    setIsChangingEmail(isChange);
    setNewEmail(""); setEmailCode(""); setEmailError(""); setPendingEmailId(null);
    setEmailStage("addEmail");
  };

  const sendEmailCode = async () => {
    if (!newEmail.trim()) { setEmailError("Enter an email address."); return; }
    setEmailLoading(true); setEmailError("");
    try {
      const emailAddr = await user.createEmailAddress({ email: newEmail.trim() });
      await emailAddr.prepareVerification({ strategy: "email_code" });
      setPendingEmailId(emailAddr.id);
      setEmailStage("enterCode");
    } catch (e) {
      setEmailError(e.errors?.[0]?.message || "Could not send verification code.");
    } finally {
      setEmailLoading(false);
    }
  };

  const confirmEmailCode = async () => {
    if (!emailCode.trim()) { setEmailError("Enter the 6-digit code."); return; }
    setEmailLoading(true); setEmailError("");
    try {
      const emailAddr = user.emailAddresses.find(e => e.id === pendingEmailId)
        || user.emailAddresses.find(e => e.emailAddress === newEmail.trim());
      if (!emailAddr) throw new Error("Email address not found — please start over.");
      const result = await emailAddr.attemptVerification({ code: emailCode });
      if (result.verification.status !== "verified") {
        setEmailError("Incorrect code — please try again."); return;
      }
      if (isChangingEmail) {
        await user.update({ primaryEmailAddressId: result.id });
        const oldEmails = user.emailAddresses.filter(e => e.id !== result.id);
        await Promise.allSettled(oldEmails.map(e => e.destroy()));
      }
      setEmailStage("idle"); setNewEmail(""); setEmailCode("");
      Alert.alert(
        isChangingEmail ? "Email Changed" : "Email Verified",
        isChangingEmail ? "Your email has been updated and verified." : "Your email is verified. You now have the Verified badge."
      );
    } catch (e) {
      setEmailError(e.errors?.[0]?.message || e.message || "Verification failed.");
    } finally {
      setEmailLoading(false);
    }
  };

  const resendEmailCode = async () => {
    setEmailLoading(true); setEmailError("");
    try {
      const emailAddr = user.emailAddresses.find(e => e.id === pendingEmailId);
      if (emailAddr) await emailAddr.prepareVerification({ strategy: "email_code" });
    } catch (e) {
      setEmailError(e.errors?.[0]?.message || "Could not resend.");
    } finally {
      setEmailLoading(false);
    }
  };

  const changePassword = async () => {
    if (!currentPw)          { setPwError("Enter your current password.");                 return; }
    if (newPw.length < 8)    { setPwError("New password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setPwError("Passwords don't match.");                       return; }
    setPwLoading(true); setPwError("");
    try {
      await user.updatePassword({ currentPassword: currentPw, newPassword: newPw });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setPwStage("idle");
      Alert.alert("Password Changed", "Your password has been updated successfully.");
    } catch (e) {
      setPwError(e.errors?.[0]?.message || "Could not change password.");
    } finally {
      setPwLoading(false);
    }
  };

  const initials     = user ? (`${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`).toUpperCase() || "ME" : "??";
  const fullName     = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
  const uname        = user?.unsafeMetadata?.username;
  const primaryEmail = user?.primaryEmailAddress?.emailAddress;
  const isVerified   = user?.primaryEmailAddress?.verification?.status === "verified";

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* ── Top nav row ── */}
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: C.glassBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon name="back" size={18} color={C.fg} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", fontFamily: FONT_MED, fontSize: 14, color: C.fg }}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 56 }} keyboardShouldPersistTaps="handled">

        {/* ── Editorial headline ── */}
        <View style={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 8 }}>
          <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 36, lineHeight: 38, letterSpacing: -1 }}>Tune your</Text>
          <Text style={{ color: C.fgDim, fontFamily: FONT_HEAD_ITALIC, fontStyle: "italic", fontSize: 36, lineHeight: 38, letterSpacing: -1 }}>experience.</Text>
        </View>

        {/* ─── PROFILE ─── */}
        <SectionLabel top={20}>Profile</SectionLabel>
        <View style={{ paddingHorizontal: 18, marginBottom: 20 }}>
          {!isLoaded ? (
            <ActivityIndicator color={C.amber} style={{ marginVertical: 24 }} />
          ) : !user ? (
            <GlassCard>
              <View style={{ padding: 16 }}>
                <Text style={{ color: C.fgDim, fontSize: 13, fontFamily: FONT, marginBottom: 12 }}>Sign in to manage your profile.</Text>
                <Pressable
                  onPress={() => router.replace("/sign-in")}
                  style={{ backgroundColor: C.amber, borderRadius: 100, paddingVertical: 12, alignItems: "center" }}
                >
                  <Text style={{ color: C.ink, fontFamily: FONT_MED, fontSize: 13 }}>Sign In →</Text>
                </Pressable>
              </View>
            </GlassCard>
          ) : editing ? (
            <GlassCard>
              <View style={{ padding: 18 }}>
                <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 18, marginBottom: 14, letterSpacing: -0.3 }}>Edit profile</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <GlassInput label="First name" value={firstName} onChangeText={setFirstName} placeholder="First" autoCapitalize="words" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <GlassInput label="Last name" value={lastName} onChangeText={setLastName} placeholder="Last" autoCapitalize="words" />
                  </View>
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: C.fgDim, fontSize: 11, fontFamily: FONT, marginBottom: 6, letterSpacing: 0.8, textTransform: "uppercase" }}>Username</Text>
                  <View style={{ flexDirection: "row", alignItems: "stretch", backgroundColor: C.glassBg, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, overflow: "hidden" }}>
                    <View style={{ paddingHorizontal: 14, backgroundColor: C.chipBg, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: C.amberText, fontFamily: FONT_MED, fontSize: 15 }}>@</Text>
                    </View>
                    <TextInput
                      value={username}
                      onChangeText={v => setUsername(v.replace(/^@/, "").replace(/[^a-z0-9_.]/gi, "").toLowerCase())}
                      placeholder="yourhandle" placeholderTextColor={C.fgFaint}
                      style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12, color: C.fg, fontSize: 14, fontFamily: FONT }}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                  <PillBtn title="Cancel" secondary onPress={() => setEditing(false)} />
                  <PillBtn title={saving ? "Saving…" : "Save"} primary onPress={saveProfile} disabled={saving} loading={saving} />
                </View>
              </View>
            </GlassCard>
          ) : (
            <GlassCard>
              <View style={{ padding: 18, flexDirection: "row", alignItems: "center", gap: 14 }}>
                <AccentDisc initials={initials} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 18, letterSpacing: -0.3 }}>{fullName}</Text>
                  {uname && <Text style={{ color: C.amberText, fontFamily: FONT, fontSize: 12, marginTop: 2 }}>@{uname}</Text>}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                    {isVerified
                      ? <Text style={{ color: C.green, fontSize: 11, fontFamily: FONT_MED }}>✓ Verified</Text>
                      : <Text style={{ color: C.amberText, fontSize: 11, fontFamily: FONT_MED }}>Not verified</Text>
                    }
                    {primaryEmail && <Text style={{ color: C.fgDim, fontSize: 11, fontFamily: FONT, flex: 1 }} numberOfLines={1}>{primaryEmail}</Text>}
                  </View>
                </View>
                <Pressable onPress={startEdit} style={{ backgroundColor: C.amberDim, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: C.amberText, fontFamily: FONT_MED, fontSize: 12 }}>Edit</Text>
                </Pressable>
              </View>

              {emailStage === "idle" && (
                <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, padding: 14, gap: 10 }}>
                  {!isVerified && (
                    <Pressable
                      onPress={() => primaryEmail
                        ? (() => { setIsChangingEmail(false); setPendingEmailId(user.primaryEmailAddress?.id); setEmailStage("enterCode"); user.primaryEmailAddress?.prepareVerification({ strategy: "email_code" }); })()
                        : startEmailChange(false)
                      }
                      style={{ backgroundColor: C.amber, borderRadius: 100, paddingVertical: 11, alignItems: "center" }}
                    >
                      <Text style={{ color: C.ink, fontFamily: FONT_MED, fontSize: 13 }}>
                        {primaryEmail ? "Send verification code" : "Add email & verify"}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => startEmailChange(true)} style={{ backgroundColor: C.chipBg, borderRadius: 100, paddingVertical: 11, alignItems: "center" }}>
                    <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 13 }}>
                      {primaryEmail ? "Change email" : "Add email"}
                    </Text>
                  </Pressable>
                </View>
              )}

              {emailStage === "addEmail" && (
                <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, padding: 18 }}>
                  <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 13, marginBottom: 10 }}>
                    {isChangingEmail ? "Change email address" : "Add email"}
                  </Text>
                  {!!emailError && (
                    <View style={{ backgroundColor: C.red + "18", borderRadius: 12, padding: 10, marginBottom: 10 }}>
                      <Text style={{ color: C.red, fontSize: 12, fontFamily: FONT }}>{emailError}</Text>
                    </View>
                  )}
                  {isChangingEmail && primaryEmail && (
                    <Text style={{ color: C.fgDim, fontSize: 11, fontFamily: FONT, marginBottom: 10 }}>Current: {primaryEmail}</Text>
                  )}
                  <GlassInput value={newEmail} onChangeText={setNewEmail} placeholder="new@example.com" keyboardType="email-address" />
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                    <PillBtn title="Cancel" secondary onPress={() => { setEmailStage("idle"); setEmailError(""); }} />
                    <PillBtn title="Send code →" primary onPress={sendEmailCode} loading={emailLoading} disabled={emailLoading} />
                  </View>
                </View>
              )}

              {emailStage === "enterCode" && (
                <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, padding: 18 }}>
                  <Text style={{ color: C.fg, fontFamily: FONT_MED, fontSize: 13, marginBottom: 4 }}>Enter verification code</Text>
                  <Text style={{ color: C.fgDim, fontSize: 11, fontFamily: FONT, marginBottom: 12 }}>Code sent to {newEmail || primaryEmail}</Text>
                  {!!emailError && (
                    <View style={{ backgroundColor: C.red + "18", borderRadius: 12, padding: 10, marginBottom: 10 }}>
                      <Text style={{ color: C.red, fontSize: 12, fontFamily: FONT }}>{emailError}</Text>
                    </View>
                  )}
                  <View style={{ backgroundColor: C.glassBg, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.glassBorder, marginBottom: 14 }}>
                    <TextInput
                      value={emailCode} onChangeText={setEmailCode}
                      placeholder="123456" placeholderTextColor={C.fgFaint}
                      keyboardType="numeric" maxLength={6}
                      style={{ paddingHorizontal: 16, paddingVertical: 14, color: C.fg, fontSize: 24, fontFamily: FONT_HEAD, letterSpacing: 10, textAlign: "center" }}
                    />
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                    <PillBtn title="Cancel" secondary onPress={() => { setEmailStage("idle"); setEmailCode(""); setEmailError(""); }} />
                    <PillBtn title="Verify" primary onPress={confirmEmailCode} loading={emailLoading} disabled={emailLoading} />
                  </View>
                  <Pressable onPress={resendEmailCode} disabled={emailLoading} style={{ alignItems: "center", paddingVertical: 6 }}>
                    <Text style={{ color: C.amberText, fontSize: 12, fontFamily: FONT_MED }}>Resend code →</Text>
                  </Pressable>
                </View>
              )}
            </GlassCard>
          )}
        </View>

        {/* ─── SECURITY ─── */}
        {!!user && (
          <>
            <SectionLabel>Security</SectionLabel>
            <View style={{ paddingHorizontal: 18, marginBottom: 14 }}>
              <GlassCard>
                {pwStage === "idle" ? (
                  <Row
                    icon="settings"
                    label="Change password"
                    hint="Update your account password"
                    onPress={() => { setCurrentPw(""); setNewPw(""); setConfirmPw(""); setPwError(""); setPwStage("form"); }}
                    last
                  />
                ) : (
                  <View style={{ padding: 18 }}>
                    <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 18, letterSpacing: -0.3, marginBottom: 14 }}>Change password</Text>
                    {!!pwError && (
                      <View style={{ backgroundColor: C.red + "18", borderRadius: 12, padding: 10, marginBottom: 10 }}>
                        <Text style={{ color: C.red, fontSize: 12, fontFamily: FONT }}>{pwError}</Text>
                      </View>
                    )}
                    <GlassInput label="Current password" value={currentPw} onChangeText={setCurrentPw} placeholder="Your current password" secureTextEntry />
                    <GlassInput label="New password" value={newPw} onChangeText={setNewPw} placeholder="Min. 8 characters" secureTextEntry />
                    <GlassInput label="Confirm new password" value={confirmPw} onChangeText={setConfirmPw} placeholder="Repeat new password" secureTextEntry />
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                      <PillBtn title="Cancel" secondary onPress={() => setPwStage("idle")} />
                      <PillBtn title="Update" primary onPress={changePassword} loading={pwLoading} disabled={pwLoading} />
                    </View>
                  </View>
                )}
              </GlassCard>
            </View>

            <View style={{ paddingHorizontal: 18, marginBottom: 24 }}>
              <GlassCard style={{ borderColor: C.red + "40" }}>
                <Row
                  icon="arrow"
                  label="Sign out"
                  danger
                  last
                  onPress={() => Alert.alert("Sign Out", "Are you sure you want to sign out?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Sign Out", style: "destructive", onPress: () => signOut().then(() => router.replace("/sign-in")) },
                  ])}
                />
              </GlassCard>
            </View>
          </>
        )}

        {/* ─── APPEARANCE ─── */}
        <SectionLabel>Appearance</SectionLabel>
        <View style={{ paddingHorizontal: 18, marginBottom: 24 }}>
          <GlassCard>
            <View style={{ padding: 18 }}>
              <Text style={{ color: C.fg, fontFamily: FONT_HEAD, fontSize: 18, letterSpacing: -0.3 }}>Theme</Text>
              <Text style={{ color: C.fgDim, fontSize: 12, fontFamily: FONT, marginTop: 2, marginBottom: 16 }}>Choose how Zamin looks to you.</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {THEME_MODES.map(m => {
                  const active = mode === m.key;
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => setTheme(m.key)}
                      style={{
                        flex: 1, paddingVertical: 14, borderRadius: 18,
                        backgroundColor: active ? C.amber : C.chipBg,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: active ? "transparent" : C.glassBorder,
                        alignItems: "center", gap: 6,
                      }}
                    >
                      <Icon name={m.icon} size={20} color={active ? C.ink : C.fg} strokeWidth={1.5} />
                      <Text style={{ color: active ? C.ink : C.fg, fontFamily: FONT_MED, fontSize: 12 }}>{m.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </GlassCard>
        </View>

        {/* ─── ABOUT ─── */}
        <SectionLabel>About</SectionLabel>
        <View style={{ paddingHorizontal: 18 }}>
          <GlassCard>
            <Row icon="bookmark" label="Terms of service" />
            <Row icon="settings" label="Privacy policy" />
            <Row icon="star" label="Rate Zamin" last />
          </GlassCard>
        </View>

        <Text style={{ color: C.fgFaint, fontSize: 11, textAlign: "center", fontFamily: FONT, marginTop: 32 }}>
          Zamin v1.0.0 · made in India
        </Text>
      </ScrollView>
    </View>
  );
}
