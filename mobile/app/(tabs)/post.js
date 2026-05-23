import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { C, FONT } from "../../src/theme";
import Header from "../../src/components/Header";
import NeoBox from "../../src/components/NeoBox";
import NeoButton from "../../src/components/NeoButton";
import { NeoInput } from "../../src/components/ui";
import { useApi } from "../../src/hooks/useApi";

const TYPES = ["House", "Apartment", "Land", "Commercial"];
const STEPS = ["Details", "Media", "Location", "Review"];
const EMPTY_FORM = { title: "", description: "", type: "House", status: "For Sale", price: "", area: "", beds: "", baths: "", location: "" };

export default function Post() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const api = useApi();
  const { editId } = useLocalSearchParams();
  const isEditing = !!editId;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [fetchingEdit, setFetchingEdit] = useState(isEditing);

  // Pre-fill form when editing an existing property
  useEffect(() => {
    if (!editId) return;
    setFetchingEdit(true);
    api.getProperty(editId)
      .then(p => {
        setForm({
          title:       p.title       || "",
          description: p.description || "",
          type:        p.type        || "House",
          status:      p.status      || "For Sale",
          price:       p.price       || "",
          area:        p.area        || "",
          beds:        p.beds  != null ? String(p.beds)  : "",
          baths:       p.baths != null ? String(p.baths) : "",
          location:    p.location    || "",
        });
      })
      .catch(() => Alert.alert("Error", "Could not load property for editing."))
      .finally(() => setFetchingEdit(false));
  }, [editId]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const save = async () => {
    try {
      setLoading(true);
      const payload = {
        ...form,
        beds:  form.beds  ? Number(form.beds)  : null,
        baths: form.baths ? Number(form.baths) : null,
      };
      if (isEditing) {
        await api.updateProperty(editId, payload);
        Alert.alert("✅ Updated!", "Your listing has been updated.");
      } else {
        await api.createProperty({ ...payload, owner_name: "Me", owner_avatar: "ME", img: "🏠", color: C.amber });
        Alert.alert("🎉 Published!", "Your listing is now live.");
      }
      setStep(1);
      setForm(EMPTY_FORM);
      router.push(isEditing ? "/(tabs)/profile" : "/(tabs)/discover");
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isSignedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Header />
        <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 46, marginBottom: 16 }}>🔒</Text>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", fontFamily: FONT, marginBottom: 8 }}>Sign in to Post</Text>
          <Text style={{ color: C.muted, fontSize: 14, fontFamily: FONT, textAlign: "center", marginBottom: 24, lineHeight: 22 }}>Free listing · No brokerage · Direct buyer connect</Text>
          <NeoButton title="Sign In to List →" onPress={() => router.push("/sign-in")} />
        </View>
      </View>
    );
  }

  if (fetchingEdit) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Header />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.amber} size="large" />
          <Text style={{ color: C.muted, marginTop: 12, fontFamily: FONT }}>Loading property…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: C.text, fontFamily: FONT }}>
            {isEditing ? "Edit Property" : "Post a Property"}
          </Text>
          {isEditing && (
            <Pressable onPress={() => { setStep(1); setForm(EMPTY_FORM); router.back(); }}
              style={{ paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: C.muted, fontFamily: FONT, fontSize: 13 }}>Cancel</Text>
            </Pressable>
          )}
        </View>
        <Text style={{ color: C.amber, fontSize: 13, fontWeight: "700", fontFamily: FONT, marginBottom: 20 }}>
          {isEditing ? "Update your listing details" : "Free · No brokerage · Direct connect"}
        </Text>

        {/* Step indicators */}
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 22 }}>
          {STEPS.map((s, i) => (
            <Pressable key={s} onPress={() => i < step && setStep(i + 1)}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 2.5, borderColor: C.ink, alignItems: "center",
                backgroundColor: step === i + 1 ? C.amber : step > i + 1 ? C.green : C.card }}>
              <Text style={{ fontSize: 10, fontWeight: "700", fontFamily: FONT, color: step >= i + 1 ? C.ink : C.muted }}>
                {step > i + 1 ? "✓ " : ""}{s}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Step 1 — Details */}
        {step === 1 && (
          <View style={{ gap: 16 }}>
            <View>
              <Text style={{ color: C.amber, fontSize: 12, fontWeight: "700", marginBottom: 8, fontFamily: FONT }}>Property Type</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {TYPES.map(t => (
                  <Pressable key={t} onPress={() => set("type", t)}
                    style={{ flex: 1, borderColor: form.type === t ? C.amber : C.ink, borderWidth: 2.5, borderRadius: 10, backgroundColor: form.type === t ? C.amber : C.card, paddingVertical: 10, alignItems: "center" }}>
                    <Text style={{ color: form.type === t ? C.ink : C.muted, fontSize: 11, fontWeight: "700", fontFamily: FONT }}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View>
              <Text style={{ color: C.amber, fontSize: 12, fontWeight: "700", marginBottom: 8, fontFamily: FONT }}>Status</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {["For Sale", "For Rent"].map(s => (
                  <Pressable key={s} onPress={() => set("status", s)}
                    style={{ flex: 1, borderColor: form.status === s ? C.blue : C.ink, borderWidth: 2.5, borderRadius: 10, backgroundColor: form.status === s ? C.blue : C.card, paddingVertical: 10, alignItems: "center" }}>
                    <Text style={{ color: form.status === s ? C.ink : C.muted, fontSize: 12, fontWeight: "700", fontFamily: FONT }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <NeoInput label="Title" value={form.title} onChangeText={v => set("title", v)} placeholder="e.g. 3BHK Flat in South Mumbai" />
            <NeoInput label="Description" value={form.description} onChangeText={v => set("description", v)} placeholder="Describe your property..." multiline />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <NeoInput label="Price" value={form.price} onChangeText={v => set("price", v)} placeholder="₹0" style={{ flex: 1 }} />
              <NeoInput label="Area" value={form.area} onChangeText={v => set("area", v)} placeholder="sq ft" style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <NeoInput label="Beds" value={form.beds} onChangeText={v => set("beds", v)} placeholder="0" keyboardType="numeric" style={{ flex: 1 }} />
              <NeoInput label="Baths" value={form.baths} onChangeText={v => set("baths", v)} placeholder="0" keyboardType="numeric" style={{ flex: 1 }} />
            </View>
            <NeoButton full title="Next: Add Photos →" onPress={() => setStep(2)} />
          </View>
        )}

        {/* Step 2 — Media */}
        {step === 2 && (
          <View style={{ gap: 16 }}>
            <View style={{ borderColor: C.amber, borderWidth: 2.5, borderStyle: "dashed", borderRadius: 14, padding: 40, alignItems: "center", backgroundColor: C.amberDim }}>
              <Text style={{ fontSize: 40 }}>📸</Text>
              <Text style={{ color: C.amber, fontWeight: "700", marginTop: 8, fontFamily: FONT }}>Tap to upload photos</Text>
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 4, fontFamily: FONT }}>Up to 20 photos · Max 10MB each</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <NeoButton title="← Back" fill={C.card} fg={C.text} onPress={() => setStep(1)} />
              <NeoButton full title="Next: Location →" onPress={() => setStep(3)} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {/* Step 3 — Location */}
        {step === 3 && (
          <View style={{ gap: 16 }}>
            <NeoInput label="Address / Locality" value={form.location} onChangeText={v => set("location", v)} placeholder="e.g. Andheri West, Mumbai" />
            <NeoBox offset={5} shadowColor={C.amber} fullWidth>
              <View style={{ height: 170, backgroundColor: "#0d1b14", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 36 }}>📍</Text>
                <Text style={{ color: C.amber, fontWeight: "700", marginTop: 8, fontFamily: FONT }}>Tap to pin on map</Text>
                <Text style={{ color: C.muted, fontSize: 12, fontFamily: FONT }}>Exact location (visible to signed-in users)</Text>
              </View>
            </NeoBox>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <NeoButton title="← Back" fill={C.card} fg={C.text} onPress={() => setStep(2)} />
              <NeoButton full title="Next: Review →" onPress={() => setStep(4)} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {/* Step 4 — Review */}
        {step === 4 && (
          <View style={{ gap: 16 }}>
            <NeoBox offset={5} fullWidth>
              <View style={{ padding: 20 }}>
                <Text style={{ color: C.text, fontWeight: "800", fontSize: 16, marginBottom: 14, fontFamily: FONT }}>
                  {isEditing ? "Ready to update! ✏️" : "Ready to publish! 🎉"}
                </Text>
                <Text style={{ color: C.text, fontSize: 14, fontFamily: FONT, marginBottom: 4 }}>{form.title}</Text>
                <Text style={{ color: C.amber, fontSize: 16, fontWeight: "900", fontFamily: FONT, marginBottom: 12 }}>{form.price}</Text>
                {["Property details complete", "Photos added", "Location pinned", "Contact info from profile"].map(x => (
                  <Text key={x} style={{ color: C.green, fontSize: 13, fontWeight: "600", marginBottom: 8, fontFamily: FONT }}>✅ {x}</Text>
                ))}
              </View>
            </NeoBox>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <NeoButton title="← Back" fill={C.card} fg={C.text} onPress={() => setStep(3)} />
              <NeoButton
                full
                title={loading ? (isEditing ? "Updating..." : "Publishing...") : (isEditing ? "✏️ Update Listing" : "🚀 Publish Listing")}
                fill={isEditing ? C.blue : C.green}
                disabled={loading}
                onPress={save}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
