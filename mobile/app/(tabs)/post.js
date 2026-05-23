import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator, TextInput,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { C, FONT } from "../../src/theme";
import Header from "../../src/components/Header";
import NeoBox from "../../src/components/NeoBox";
import NeoButton from "../../src/components/NeoButton";
import { useApi } from "../../src/hooks/useApi";

// ─── Constants ──────────────────────────────────────────────────────────────

const TYPES   = ["House", "Apartment", "Land", "Commercial"];
const STEPS   = ["Details", "Amenities", "Location", "Review"];

const PRICE_UNITS = [
  { key: "K",  label: "₹K",  hint: "Thousands" },
  { key: "L",  label: "₹L",  hint: "Lakhs"     },
  { key: "Cr", label: "₹Cr", hint: "Crores"     },
];
const AREA_UNITS = ["sq ft", "sq m", "acres", "yards"];

const AMENITIES = [
  { icon: "🅿️", label: "Parking" },
  { icon: "🌿", label: "Garden" },
  { icon: "🏊", label: "Pool" },
  { icon: "🏋️", label: "Gym" },
  { icon: "🔐", label: "Security" },
  { icon: "🛗",  label: "Lift" },
  { icon: "⚡",  label: "Power Backup" },
  { icon: "💧",  label: "24×7 Water" },
  { icon: "🛋️", label: "Furnished" },
  { icon: "📶",  label: "WiFi" },
  { icon: "❄️",  label: "AC" },
  { icon: "🍳",  label: "Modular Kitchen" },
  { icon: "🏡",  label: "Balcony/Terrace" },
  { icon: "🚇",  label: "Near Metro" },
  { icon: "🏫",  label: "Near Schools" },
  { icon: "🏥",  label: "Near Hospital" },
];

const EMPTY_FORM = {
  title: "", description: "",
  type: "House", status: "For Sale",
  priceAmount: "", priceUnit: "L",
  areaAmount: "", areaUnit: "sq ft",
  beds: 0, baths: 0,
  amenities: [],
  location: "",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(amount, unit) {
  return amount ? `${amount} ${unit}` : "";
}
function formatArea(amount, unit) {
  return amount ? `${amount} ${unit}` : "";
}

function parsePrice(str) {
  if (!str) return { amount: "", unit: "L" };
  const s = str.replace(/₹/g, "").replace(/\/.*$/, "").trim();
  if (/cr/i.test(s)) return { amount: s.replace(/\s*cr.*/i, "").trim(), unit: "Cr" };
  if (/\bL\b/i.test(s) || /lakh/i.test(s)) return { amount: s.replace(/\s*L.*/i, "").trim(), unit: "L" };
  if (/\bK\b/i.test(s)) return { amount: s.replace(/\s*K.*/i, "").trim(), unit: "K" };
  return { amount: s.replace(/[^0-9.]/g, ""), unit: "L" };
}
function parseArea(str) {
  if (!str) return { amount: "", unit: "sq ft" };
  const s = str.trim().toLowerCase();
  if (s.includes("acre"))  return { amount: s.replace(/[^0-9.]/g, ""), unit: "acres" };
  if (s.includes("sq m"))  return { amount: s.replace(/[^0-9.]/g, ""), unit: "sq m"  };
  if (s.includes("yard"))  return { amount: s.replace(/[^0-9.]/g, ""), unit: "yards" };
  return { amount: str.replace(/[^0-9.]/g, ""), unit: "sq ft" };
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const label = (txt) => (
  <Text style={{ color: C.amber, fontSize: 12, fontWeight: "700", marginBottom: 7, fontFamily: FONT }}>{txt}</Text>
);

function InputField({ labelText, value, onChange, placeholder, multiline, keyboardType }) {
  return (
    <View style={{ marginBottom: 16 }}>
      {label(labelText)}
      <TextInput
        value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={C.muted} keyboardType={keyboardType}
        multiline={multiline}
        style={{
          backgroundColor: C.bg, borderColor: "#2e2e44", borderWidth: 2.5, borderRadius: 10,
          paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 14, fontFamily: FONT,
          minHeight: multiline ? 90 : undefined, textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

function PriceField({ amount, unit, onAmountChange, onUnitChange }) {
  const unitObj = PRICE_UNITS.find(u => u.key === unit) || PRICE_UNITS[1];
  const preview = amount
    ? `≈ ₹${amount} ${unitObj.hint}${unit === "K" ? " Rupees" : ""}`
    : null;

  return (
    <View style={{ marginBottom: 16 }}>
      {label("Price")}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <TextInput
            value={amount} onChangeText={onAmountChange}
            placeholder="e.g. 2.5" placeholderTextColor={C.muted}
            keyboardType="decimal-pad"
            style={{ backgroundColor: C.bg, borderColor: "#2e2e44", borderWidth: 2.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 15, fontFamily: FONT, fontWeight: "700" }}
          />
        </View>
        {PRICE_UNITS.map(u => (
          <Pressable key={u.key} onPress={() => onUnitChange(u.key)}
            style={{ paddingHorizontal: 13, borderRadius: 10, borderWidth: 2.5, borderColor: unit === u.key ? C.amber : C.ink, backgroundColor: unit === u.key ? C.amber : C.card, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: unit === u.key ? C.ink : C.muted, fontWeight: "800", fontFamily: FONT, fontSize: 13 }}>{u.label}</Text>
          </Pressable>
        ))}
      </View>
      {preview && <Text style={{ color: C.muted, fontSize: 11, marginTop: 5, fontFamily: FONT }}>{preview}</Text>}
    </View>
  );
}

function AreaField({ amount, unit, onAmountChange, onUnitChange }) {
  return (
    <View style={{ marginBottom: 16 }}>
      {label("Area")}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <TextInput
            value={amount} onChangeText={onAmountChange}
            placeholder="e.g. 1200" placeholderTextColor={C.muted}
            keyboardType="decimal-pad"
            style={{ backgroundColor: C.bg, borderColor: "#2e2e44", borderWidth: 2.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 15, fontFamily: FONT, fontWeight: "700" }}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 0 }} contentContainerStyle={{ gap: 6, flexDirection: "row" }}>
          {AREA_UNITS.map(u => (
            <Pressable key={u} onPress={() => onUnitChange(u)}
              style={{ paddingHorizontal: 11, borderRadius: 10, borderWidth: 2.5, borderColor: unit === u ? C.blue : C.ink, backgroundColor: unit === u ? C.blue : C.card, alignItems: "center", justifyContent: "center", paddingVertical: 10 }}>
              <Text style={{ color: unit === u ? C.ink : C.muted, fontWeight: "700", fontFamily: FONT, fontSize: 12 }}>{u}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function Stepper({ labelText, value, onChange }) {
  return (
    <View style={{ flex: 1 }}>
      {label(labelText)}
      <View style={{ flexDirection: "row", borderWidth: 2.5, borderColor: C.ink, borderRadius: 10, backgroundColor: C.bg, overflow: "hidden" }}>
        <Pressable
          onPress={() => value > 0 && onChange(value - 1)}
          style={{ width: 44, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRightWidth: 2.5, borderRightColor: C.ink }}
        >
          <Text style={{ color: value > 0 ? C.amber : C.dim, fontSize: 22, fontWeight: "800" }}>−</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12 }}>
          <Text style={{ color: value > 0 ? C.text : C.muted, fontSize: 16, fontWeight: "800", fontFamily: FONT }}>
            {value > 0 ? value : "—"}
          </Text>
        </View>
        <Pressable
          onPress={() => onChange(value + 1)}
          style={{ width: 44, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderLeftWidth: 2.5, borderLeftColor: C.ink }}
        >
          <Text style={{ color: C.amber, fontSize: 22, fontWeight: "800" }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

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

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleAmenity = (label) => {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(label)
        ? f.amenities.filter(a => a !== label)
        : [...f.amenities, label],
    }));
  };

  // Pre-fill form when editing an existing property
  useEffect(() => {
    if (!editId) return;
    setFetchingEdit(true);
    api.getProperty(editId)
      .then(p => {
        const { amount: priceAmount, unit: priceUnit } = parsePrice(p.price);
        const { amount: areaAmount,  unit: areaUnit  } = parseArea(p.area);
        setForm({
          title:        p.title       || "",
          description:  p.description || "",
          type:         p.type        || "House",
          status:       p.status      || "For Sale",
          priceAmount, priceUnit,
          areaAmount,  areaUnit,
          beds:         p.beds  ?? 0,
          baths:        p.baths ?? 0,
          amenities:    Array.isArray(p.tags) ? p.tags : [],
          location:     p.location    || "",
        });
      })
      .catch(() => Alert.alert("Error", "Could not load property for editing."))
      .finally(() => setFetchingEdit(false));
  }, [editId]);

  const save = async () => {
    try {
      setLoading(true);
      const payload = {
        title:       form.title,
        description: form.description,
        type:        form.type,
        status:      form.status,
        price:       formatPrice(form.priceAmount, form.priceUnit),
        area:        formatArea(form.areaAmount, form.areaUnit),
        beds:        form.beds  > 0 ? form.beds  : null,
        baths:       form.baths > 0 ? form.baths : null,
        tags:        form.amenities.length ? form.amenities : null,
        location:    form.location,
      };
      if (isEditing) {
        await api.updateProperty(editId, payload);
        Alert.alert("✅ Updated!", "Your listing has been updated.");
        router.push("/my-listings");
      } else {
        await api.createProperty({ ...payload, owner_name: "Me", owner_avatar: "ME", img: "🏠", color: C.amber });
        Alert.alert("🎉 Published!", "Your listing is now live.");
        router.push("/(tabs)/discover");
      }
      setStep(1);
      setForm(EMPTY_FORM);
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
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">

        {/* Title row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: C.text, fontFamily: FONT }}>
            {isEditing ? "Edit Listing" : "Post a Property"}
          </Text>
          {isEditing && (
            <Pressable onPress={() => { setStep(1); setForm(EMPTY_FORM); router.back(); }} style={{ padding: 6 }}>
              <Text style={{ color: C.muted, fontFamily: FONT, fontSize: 13 }}>Cancel</Text>
            </Pressable>
          )}
        </View>
        <Text style={{ color: C.amber, fontSize: 12, fontWeight: "700", fontFamily: FONT, marginBottom: 20 }}>
          {isEditing ? "Update your listing details below" : "Free · No brokerage · Direct connect"}
        </Text>

        {/* Step indicators */}
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 24 }}>
          {STEPS.map((s, i) => (
            <Pressable key={s} onPress={() => i < step - 1 && setStep(i + 1)}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 2.5, borderColor: C.ink, alignItems: "center",
                backgroundColor: step === i + 1 ? C.amber : step > i + 1 ? C.green : C.card }}>
              <Text style={{ fontSize: 9, fontWeight: "700", fontFamily: FONT, color: step >= i + 1 ? C.ink : C.muted }}>
                {step > i + 1 ? "✓ " : ""}{s}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Step 1: Details ─────────────────────────────── */}
        {step === 1 && (
          <View style={{ gap: 0 }}>
            {/* Type */}
            <View style={{ marginBottom: 16 }}>
              {label("Property Type")}
              <View style={{ flexDirection: "row", gap: 8 }}>
                {TYPES.map(t => (
                  <Pressable key={t} onPress={() => set("type", t)}
                    style={{ flex: 1, borderColor: form.type === t ? C.amber : C.ink, borderWidth: 2.5, borderRadius: 10, backgroundColor: form.type === t ? C.amber : C.card, paddingVertical: 10, alignItems: "center" }}>
                    <Text style={{ color: form.type === t ? C.ink : C.muted, fontSize: 11, fontWeight: "700", fontFamily: FONT }}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Status */}
            <View style={{ marginBottom: 16 }}>
              {label("Listing Status")}
              <View style={{ flexDirection: "row", gap: 8 }}>
                {["For Sale", "For Rent"].map(s => (
                  <Pressable key={s} onPress={() => set("status", s)}
                    style={{ flex: 1, borderColor: form.status === s ? C.blue : C.ink, borderWidth: 2.5, borderRadius: 10, backgroundColor: form.status === s ? C.blue : C.card, paddingVertical: 10, alignItems: "center" }}>
                    <Text style={{ color: form.status === s ? C.ink : C.muted, fontSize: 13, fontWeight: "700", fontFamily: FONT }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <InputField labelText="Title" value={form.title} onChange={v => set("title", v)} placeholder="e.g. 3BHK Flat in Bandra West" />
            <InputField labelText="Description" value={form.description} onChange={v => set("description", v)} placeholder="Describe the property, nearby landmarks, condition…" multiline />

            <PriceField amount={form.priceAmount} unit={form.priceUnit} onAmountChange={v => set("priceAmount", v.replace(/[^0-9.]/g, ""))} onUnitChange={v => set("priceUnit", v)} />
            <AreaField  amount={form.areaAmount}  unit={form.areaUnit}  onAmountChange={v => set("areaAmount",  v.replace(/[^0-9.]/g, ""))} onUnitChange={v => set("areaUnit",  v)} />

            {/* Beds & Baths — only for residential */}
            {(form.type === "House" || form.type === "Apartment") && (
              <View style={{ flexDirection: "row", gap: 14, marginBottom: 8 }}>
                <Stepper labelText="Bedrooms"  value={form.beds}  onChange={v => set("beds",  v)} />
                <Stepper labelText="Bathrooms" value={form.baths} onChange={v => set("baths", v)} />
              </View>
            )}

            <NeoButton full title="Next: Amenities →" onPress={() => setStep(2)} />
          </View>
        )}

        {/* ── Step 2: Amenities ───────────────────────────── */}
        {step === 2 && (
          <View>
            <Text style={{ color: C.text, fontSize: 14, fontFamily: FONT, marginBottom: 16, lineHeight: 22 }}>
              Select all features that apply to this property.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
              {AMENITIES.map(({ icon, label: lbl }) => {
                const selected = form.amenities.includes(lbl);
                return (
                  <Pressable key={lbl} onPress={() => toggleAmenity(lbl)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 2.5, borderColor: selected ? C.green : C.ink, backgroundColor: selected ? C.green + "22" : C.card }}>
                    <Text style={{ fontSize: 16 }}>{icon}</Text>
                    <Text style={{ color: selected ? C.green : C.muted, fontWeight: "700", fontSize: 12, fontFamily: FONT }}>{lbl}</Text>
                    {selected && <Text style={{ color: C.green, fontSize: 12, fontWeight: "900" }}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
            {form.amenities.length > 0 && (
              <View style={{ backgroundColor: C.green + "15", borderColor: C.green, borderWidth: 1.5, borderRadius: 10, padding: 10, marginBottom: 16 }}>
                <Text style={{ color: C.green, fontSize: 12, fontWeight: "700", fontFamily: FONT }}>
                  ✓ {form.amenities.length} amenit{form.amenities.length === 1 ? "y" : "ies"} selected: {form.amenities.join(", ")}
                </Text>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <NeoButton title="← Back" fill={C.card} fg={C.text} onPress={() => setStep(1)} />
              <NeoButton full title="Next: Location →" onPress={() => setStep(3)} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {/* ── Step 3: Location ────────────────────────────── */}
        {step === 3 && (
          <View style={{ gap: 16 }}>
            <InputField labelText="Address / Locality" value={form.location} onChange={v => set("location", v)} placeholder="e.g. Andheri West, Mumbai — 400053" />
            <NeoBox offset={5} shadowColor={C.amber} fullWidth>
              <View style={{ height: 160, backgroundColor: "#0d1b14", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 36 }}>📍</Text>
                <Text style={{ color: C.amber, fontWeight: "700", marginTop: 8, fontFamily: FONT }}>Map pin (coming soon)</Text>
                <Text style={{ color: C.muted, fontSize: 12, fontFamily: FONT, marginTop: 4 }}>Exact location shown only to signed-in users</Text>
              </View>
            </NeoBox>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <NeoButton title="← Back" fill={C.card} fg={C.text} onPress={() => setStep(2)} />
              <NeoButton full title="Next: Review →" onPress={() => setStep(4)} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {/* ── Step 4: Review ──────────────────────────────── */}
        {step === 4 && (
          <View style={{ gap: 14 }}>
            <NeoBox offset={5} fullWidth>
              <View style={{ padding: 20 }}>
                <Text style={{ color: C.text, fontWeight: "800", fontSize: 16, marginBottom: 16, fontFamily: FONT }}>
                  {isEditing ? "Review changes ✏️" : "Ready to publish 🎉"}
                </Text>
                {/* Summary rows */}
                {[
                  ["🏷️", form.title || "—"],
                  ["💰", form.priceAmount ? `₹${form.priceAmount} ${form.priceUnit}` : "—"],
                  ["📐", form.areaAmount  ? `${form.areaAmount} ${form.areaUnit}` : "—"],
                  ["📍", form.location || "—"],
                  form.beds  > 0 ? ["🛏️", `${form.beds} Bed${form.beds > 1 ? "s" : ""}`] : null,
                  form.baths > 0 ? ["🚿", `${form.baths} Bath${form.baths > 1 ? "s" : ""}`] : null,
                  form.amenities.length > 0 ? ["✨", form.amenities.slice(0, 4).join(", ") + (form.amenities.length > 4 ? ` +${form.amenities.length - 4}` : "")] : null,
                ].filter(Boolean).map(([icon, val]) => (
                  <View key={icon} style={{ flexDirection: "row", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                    <Text style={{ fontSize: 14, width: 22 }}>{icon}</Text>
                    <Text style={{ color: C.text, fontSize: 13, fontFamily: FONT, flex: 1, lineHeight: 20 }}>{val}</Text>
                  </View>
                ))}
              </View>
            </NeoBox>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <NeoButton title="← Back" fill={C.card} fg={C.text} onPress={() => setStep(3)} />
              <NeoButton
                full
                title={loading ? (isEditing ? "Updating…" : "Publishing…") : (isEditing ? "✏️ Update Listing" : "🚀 Publish Listing")}
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
