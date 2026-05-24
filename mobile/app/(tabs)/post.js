import { useTheme } from "../../src/context/ThemeContext";
import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator, TextInput, StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { C, FONT, FONT_MED, FONT_HEAD } from "../../src/theme";
import { Icon } from "../../src/components/Icon";
import NeoButton from "../../src/components/NeoButton";
import { useApi } from "../../src/hooks/useApi";

const TYPES  = ["House", "Apartment", "Land", "Commercial"];
const STEPS  = ["Details", "Amenities", "Location", "Review"];

const PRICE_UNITS = [
  { key: "K",  label: "₹K",  hint: "Thousands" },
  { key: "L",  label: "₹L",  hint: "Lakhs"     },
  { key: "Cr", label: "₹Cr", hint: "Crores"     },
];

const AREA_UNITS_BY_TYPE = {
  House:      ["sq ft", "sq m", "yards"],
  Apartment:  ["sq ft", "sq m"],
  Land:       ["sq ft", "sq m", "acres", "bigha", "guntha", "yards"],
  Commercial: ["sq ft", "sq m"],
};

const DEFAULT_AREA_UNIT = { House: "sq ft", Apartment: "sq ft", Land: "sq ft", Commercial: "sq ft" };

const FURNISHING_OPTIONS      = ["Unfurnished", "Semi-Furnished", "Fully Furnished"];
const FACING_OPTIONS          = ["North Facing", "South Facing", "East Facing", "West Facing"];
const LAND_TYPE_OPTIONS       = ["Residential Plot", "Agricultural Land", "Commercial Plot", "Industrial Land"];
const COMM_FURNISHING_OPTIONS = ["Bare Shell", "Warm Shell", "Fully Fitted"];

const AMENITIES_BY_TYPE = {
  House: [
    { icon: "🅿️", label: "Parking" }, { icon: "🌿", label: "Garden" },
    { icon: "🏊", label: "Pool" },     { icon: "🏋️", label: "Gym" },
    { icon: "🔐", label: "Security" }, { icon: "🛗", label: "Lift" },
    { icon: "⚡", label: "Power Backup" }, { icon: "💧", label: "24×7 Water" },
    { icon: "📶", label: "WiFi" },     { icon: "❄️", label: "AC" },
    { icon: "🍳", label: "Modular Kitchen" }, { icon: "🏡", label: "Balcony/Terrace" },
    { icon: "🚇", label: "Near Metro" }, { icon: "🏫", label: "Near Schools" }, { icon: "🏥", label: "Near Hospital" },
  ],
  Apartment: [
    { icon: "🅿️", label: "Parking" }, { icon: "🏊", label: "Pool" },
    { icon: "🏋️", label: "Gym" },     { icon: "🔐", label: "Security" },
    { icon: "🛗", label: "Lift" },    { icon: "⚡", label: "Power Backup" },
    { icon: "💧", label: "24×7 Water" }, { icon: "📶", label: "WiFi" },
    { icon: "❄️", label: "AC" },      { icon: "🍳", label: "Modular Kitchen" },
    { icon: "🏡", label: "Balcony/Terrace" }, { icon: "🚇", label: "Near Metro" },
    { icon: "🏫", label: "Near Schools" }, { icon: "🏥", label: "Near Hospital" },
  ],
  Land: [
    { icon: "🔐", label: "Security" }, { icon: "⚡", label: "Power Backup" },
    { icon: "💧", label: "24×7 Water" }, { icon: "🛣️", label: "Road Access" },
    { icon: "🚇", label: "Near Metro" }, { icon: "🏫", label: "Near Schools" },
    { icon: "🏥", label: "Near Hospital" }, { icon: "🏦", label: "Near Bank" },
  ],
  Commercial: [
    { icon: "🅿️", label: "Parking" }, { icon: "🔐", label: "Security" },
    { icon: "🛗", label: "Lift" },    { icon: "⚡", label: "Power Backup" },
    { icon: "💧", label: "24×7 Water" }, { icon: "📶", label: "WiFi" },
    { icon: "❄️", label: "AC" },      { icon: "🚇", label: "Near Metro" }, { icon: "🏥", label: "Near Hospital" },
  ],
};

const ALL_SPECIAL_TAGS = new Set([
  ...FURNISHING_OPTIONS, ...FACING_OPTIONS, ...LAND_TYPE_OPTIONS, ...COMM_FURNISHING_OPTIONS,
]);

const EMPTY_FORM = {
  title: "", description: "",
  type: "House", status: "For Sale",
  priceAmount: "", priceUnit: "L",
  areaAmount: "", areaUnit: "sq ft",
  beds: 0, baths: 0,
  furnishing: "", totalFloors: 0, floorNumber: 0, facing: "",
  landType: "", washrooms: 0, commFurnishing: "",
  amenities: [], location: "", contactPhone: "", images: [],
};

function formatPrice(amount, unit) { return amount ? `${amount} ${unit}` : ""; }
function formatArea(amount, unit)  { return amount ? `${amount} ${unit}` : ""; }

function parsePrice(str) {
  if (!str) return { amount: "", unit: "L" };
  const s = str.replace(/₹/g, "").replace(/\/.*$/, "").trim();
  if (/cr/i.test(s))             return { amount: s.replace(/\s*cr.*/i, "").trim(), unit: "Cr" };
  if (/\bL\b/i.test(s) || /lakh/i.test(s)) return { amount: s.replace(/\s*L.*/i, "").trim(), unit: "L" };
  if (/\bK\b/i.test(s))         return { amount: s.replace(/\s*K.*/i, "").trim(), unit: "K" };
  return { amount: s.replace(/[^0-9.]/g, ""), unit: "L" };
}
function parseArea(str) {
  if (!str) return { amount: "", unit: "sq ft" };
  const s = str.trim().toLowerCase();
  if (s.includes("bigha"))  return { amount: s.replace(/[^0-9.]/g, ""), unit: "bigha" };
  if (s.includes("guntha")) return { amount: s.replace(/[^0-9.]/g, ""), unit: "guntha" };
  if (s.includes("acre"))   return { amount: s.replace(/[^0-9.]/g, ""), unit: "acres" };
  if (s.includes("sq m"))   return { amount: s.replace(/[^0-9.]/g, ""), unit: "sq m" };
  if (s.includes("yard"))   return { amount: s.replace(/[^0-9.]/g, ""), unit: "yards" };
  return { amount: str.replace(/[^0-9.]/g, ""), unit: "sq ft" };
}

function parseTags(rawTags) {
  const amenities = [], extras = {};
  (rawTags || []).forEach(tag => {
    if (FURNISHING_OPTIONS.includes(tag))          extras.furnishing     = tag;
    else if (FACING_OPTIONS.includes(tag))         extras.facing         = tag;
    else if (LAND_TYPE_OPTIONS.includes(tag))      extras.landType       = tag;
    else if (COMM_FURNISHING_OPTIONS.includes(tag)) extras.commFurnishing = tag;
    else if (/^\d+ Floors Total$/.test(tag))       extras.totalFloors    = parseInt(tag);
    else if (/^Floor \d+$/.test(tag))              extras.floorNumber    = parseInt(tag.replace("Floor ", ""));
    else if (/^\d+ Washrooms?$/.test(tag))         extras.washrooms      = parseInt(tag);
    else amenities.push(tag);
  });
  return { amenities, extras };
}

function buildTags(form) {
  const tags = [...form.amenities];
  if (form.furnishing)      tags.push(form.furnishing);
  if (form.facing)          tags.push(form.facing);
  if (form.landType)        tags.push(form.landType);
  if (form.commFurnishing)  tags.push(form.commFurnishing);
  if (form.totalFloors > 0) tags.push(`${form.totalFloors} Floors Total`);
  if (form.floorNumber > 0) tags.push(`Floor ${form.floorNumber}`);
  if (form.washrooms > 0)   tags.push(`${form.washrooms} Washroom${form.washrooms > 1 ? "s" : ""}`);
  return tags.length ? tags : null;
}

// ─── UI primitives ───────────────────────────────────────────────────────────

const FieldLabel = ({ txt, icon }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 9 }}>
    {icon ? <Icon name={icon} size={13} color={C.amberText} strokeWidth={1.8} /> : null}
    <Text style={{ color: C.amberText, fontSize: 11, fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase", fontFamily: FONT_MED }}>{txt}</Text>
  </View>
);

// Input shell — turns amber when the field has a value (clear "filled" feedback)
const inputShell = (filled) => ({
  backgroundColor: C.glassBg,
  borderRadius: 14,
  borderWidth: 1.5,
  borderColor: filled ? C.amber + "88" : C.glassBorder,
  shadowColor: filled ? C.amber : C.shadow,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: filled ? 0.18 : 0.08,
  shadowRadius: 8,
  elevation: 2,
});

// Back-compat alias for the +/- counter shell
const glassInput = () => inputShell(false);

function InputField({ labelText, icon, value, onChange, placeholder, multiline, keyboardType }) {
  const filled = !!(value && String(value).length);
  return (
    <View style={{ marginBottom: 18 }}>
      <FieldLabel txt={labelText} icon={icon} />
      <View style={[inputShell(filled), { flexDirection: "row", alignItems: multiline ? "flex-start" : "center" }]}>
        {icon && !multiline ? (
          <View style={{ paddingLeft: 14, paddingVertical: 13 }}>
            <Icon name={icon} size={17} color={filled ? C.amber : C.fgFaint} strokeWidth={1.6} />
          </View>
        ) : null}
        <TextInput
          value={value} onChangeText={onChange} placeholder={placeholder}
          placeholderTextColor={C.fgFaint} keyboardType={keyboardType}
          multiline={multiline}
          style={{
            flex: 1,
            paddingLeft: (icon && !multiline) ? 10 : 14, paddingRight: 14,
            paddingVertical: multiline ? 14 : 13,
            color: C.text, fontSize: 14, fontFamily: FONT,
            minHeight: multiline ? 96 : undefined,
            textAlignVertical: multiline ? "top" : "center",
          }}
        />
      </View>
    </View>
  );
}

function PriceField({ amount, unit, onAmountChange, onUnitChange }) {
  const unitObj = PRICE_UNITS.find(u => u.key === unit) || PRICE_UNITS[1];
  const preview = amount ? `≈ ₹${amount} ${unitObj.hint}` : null;
  return (
    <View style={{ marginBottom: 18 }}>
      <FieldLabel txt="Price" icon="tag" />
      <View style={{ flexDirection: "row", gap: 8, marginBottom: preview ? 6 : 0 }}>
        <View style={[inputShell(!!amount), { flex: 1, flexDirection: "row", alignItems: "center" }]}>
          <Text style={{ paddingLeft: 14, color: amount ? C.amber : C.fgFaint, fontSize: 16, fontFamily: FONT_MED }}>₹</Text>
          <TextInput
            value={amount} onChangeText={onAmountChange}
            placeholder="e.g. 2.5" placeholderTextColor={C.fgFaint}
            keyboardType="decimal-pad"
            style={{ flex: 1, paddingLeft: 8, paddingRight: 14, paddingVertical: 13, color: C.text, fontSize: 15, fontFamily: FONT_MED }}
          />
        </View>
        {PRICE_UNITS.map(u => (
          <Pressable
            key={u.key}
            onPress={() => onUnitChange(u.key)}
            style={{ paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: unit === u.key ? "transparent" : C.glassBorder, backgroundColor: unit === u.key ? C.amber : C.chipBg, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: unit === u.key ? C.ink : C.fgDim, fontWeight: "800", fontFamily: FONT_MED, fontSize: 13 }}>{u.label}</Text>
          </Pressable>
        ))}
      </View>
      {preview && <Text style={{ color: C.fgDim, fontSize: 11, fontFamily: FONT }}>{preview}</Text>}
    </View>
  );
}

function AreaField({ amount, unit, units, onAmountChange, onUnitChange }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <FieldLabel txt="Area" icon="ruler" />
      <View style={[inputShell(!!amount), { marginBottom: 8, flexDirection: "row", alignItems: "center" }]}>
        <View style={{ paddingLeft: 14, paddingVertical: 13 }}>
          <Icon name="ruler" size={17} color={amount ? C.amber : C.fgFaint} strokeWidth={1.6} />
        </View>
        <TextInput
          value={amount} onChangeText={onAmountChange}
          placeholder="e.g. 1200" placeholderTextColor={C.fgFaint}
          keyboardType="decimal-pad"
          style={{ flex: 1, paddingLeft: 10, paddingRight: 14, paddingVertical: 13, color: C.text, fontSize: 15, fontFamily: FONT_MED }}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
        {units.map(u => (
          <Pressable
            key={u}
            onPress={() => onUnitChange(u)}
            style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100, borderWidth: 1.5, borderColor: unit === u ? "transparent" : C.glassBorder, backgroundColor: unit === u ? C.blue : C.chipBg }}
          >
            <Text style={{ color: unit === u ? "#fff" : C.fgDim, fontWeight: "700", fontFamily: FONT_MED, fontSize: 12 }}>{u}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Stepper({ labelText, value, onChange, min = 0 }) {
  return (
    <View style={{ flex: 1 }}>
      {labelText ? <FieldLabel txt={labelText} /> : null}
      <View style={[glassInput(), { flexDirection: "row", overflow: "hidden" }]}>
        <Pressable
          onPress={() => value > min && onChange(value - 1)}
          style={{ width: 44, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRightWidth: 1, borderRightColor: C.dim }}
        >
          <Text style={{ color: value > min ? C.amber : C.dim, fontSize: 22, fontWeight: "800" }}>−</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12 }}>
          <Text style={{ color: value > 0 ? C.text : C.muted, fontSize: 16, fontWeight: "800", fontFamily: FONT }}>
            {value > 0 ? value : "—"}
          </Text>
        </View>
        <Pressable
          onPress={() => onChange(value + 1)}
          style={{ width: 44, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderLeftWidth: 1, borderLeftColor: C.dim }}
        >
          <Text style={{ color: C.amberText, fontSize: 22, fontWeight: "800" }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ChipSelector({ labelText, icon, options, value, onChange, color = C.amber }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <FieldLabel txt={labelText} icon={icon} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map(opt => {
          const on = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(on ? "" : opt)}
              style={{
                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100,
                backgroundColor: on ? color : C.chipBg,
                borderWidth: 1.5, borderColor: on ? "transparent" : C.glassBorder,
              }}
            >
              <Text style={{ color: on ? C.ink : C.fgDim, fontWeight: "700", fontSize: 12, fontFamily: FONT_MED }}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SegmentPicker({ options, value, onChange, color }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, backgroundColor: C.chipBg, padding: 5, borderRadius: 16, marginBottom: 16, borderWidth: 1.5, borderColor: C.glassBorder }}>
      {options.map(opt => {
        const on = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={{
              flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: "center",
              backgroundColor: on ? (color || C.amber) : "transparent",
              ...(on ? { shadowColor: color || C.amber, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4 } : {}),
            }}
          >
            <Text style={{ color: on ? C.ink : C.fgDim, fontWeight: on ? "800" : "600", fontSize: 13, fontFamily: FONT_MED }}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const MAX_IMAGES = 8;
const MAX_IMAGE_MB = 8;

function PhotoPicker({ images, onChange }) {
  const pick = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow photo access to add images to your listing.");
        return;
      }
      const remaining = MAX_IMAGES - images.length;
      if (remaining <= 0) {
        Alert.alert("Photo limit reached", `You can add up to ${MAX_IMAGES} photos. Remove one to make room.`);
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.7, // keeps file sizes comfortably under the limit
      });
      if (res.canceled) return;

      // Drop anything over the per-image size limit before it ever uploads
      const accepted = [];
      let tooBig = 0;
      for (const a of res.assets) {
        const mb = a.fileSize ? a.fileSize / (1024 * 1024) : 0;
        if (mb > MAX_IMAGE_MB) tooBig++;
        else accepted.push(a.uri);
      }

      let next = [...images, ...accepted];
      const overflow = next.length > MAX_IMAGES;
      if (overflow) next = next.slice(0, MAX_IMAGES);
      onChange(next);

      const notes = [];
      if (tooBig)   notes.push(`${tooBig} photo${tooBig > 1 ? "s were" : " was"} over ${MAX_IMAGE_MB} MB and skipped.`);
      if (overflow) notes.push(`Only ${MAX_IMAGES} photos are allowed — the extras were skipped.`);
      if (notes.length) Alert.alert("A couple were skipped", notes.join("\n"));
    } catch (e) {
      Alert.alert("Couldn't open gallery", e.message || "Please try again.");
    }
  };
  return (
    <View style={{ marginBottom: 18 }}>
      <FieldLabel txt="Photos" icon="image" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        <Pressable
          onPress={pick}
          style={{
            width: 92, height: 92, borderRadius: 16,
            borderWidth: 1.5, borderColor: C.amber + "88", borderStyle: "dashed",
            backgroundColor: C.glassBg, alignItems: "center", justifyContent: "center", gap: 5,
          }}
        >
          <Icon name="plus" size={22} color={C.amber} strokeWidth={2} />
          <Text style={{ color: C.amberText, fontSize: 10, fontFamily: FONT_MED }}>Add photo</Text>
        </Pressable>
        {images.map((uri, i) => (
          <View key={uri + i} style={{ width: 92, height: 92, borderRadius: 16, overflow: "hidden", borderWidth: 1.5, borderColor: C.glassBorder }}>
            <Image source={uri} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" />
            {i === 0 && (
              <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", paddingVertical: 2, alignItems: "center" }}>
                <Text style={{ color: "#fff", fontSize: 9, fontFamily: FONT_MED }}>COVER</Text>
              </View>
            )}
            <Pressable
              onPress={() => onChange(images.filter(u => u !== uri))}
              style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}
            >
              <Icon name="close" size={13} color="#fff" strokeWidth={2} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <Text style={{ color: C.fgDim, fontSize: 11, fontFamily: FONT, marginTop: 8 }}>
        {images.length > 0
          ? `${images.length}/${MAX_IMAGES} photos · first is the cover · max ${MAX_IMAGE_MB} MB each`
          : `Up to ${MAX_IMAGES} photos · max ${MAX_IMAGE_MB} MB each · first becomes the cover`}
      </Text>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Post() {
  useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const { user }       = useUser();
  const api            = useApi();
  const params         = useLocalSearchParams();
  // Edit can arrive as ?editId=X (legacy) or as the /property/edit/[id] route param.
  const editId         = params.editId ?? params.id;
  const isEditing      = !!editId;

  const [step,         setStep]         = useState(1);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [loading,      setLoading]      = useState(false);
  const [fetchingEdit, setFetchingEdit] = useState(isEditing);

  const set         = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const toggleAmenity = (lbl) => setForm(f => ({
    ...f,
    amenities: f.amenities.includes(lbl)
      ? f.amenities.filter(a => a !== lbl)
      : [...f.amenities, lbl],
  }));

  const changeType = (newType) => {
    setForm(f => {
      const units    = AREA_UNITS_BY_TYPE[newType];
      const areaUnit = units.includes(f.areaUnit) ? f.areaUnit : DEFAULT_AREA_UNIT[newType];
      return {
        ...f, type: newType, areaUnit,
        beds: 0, baths: 0,
        furnishing: "", totalFloors: 0, floorNumber: 0, facing: "",
        landType: "", washrooms: 0, commFurnishing: "",
        amenities: f.amenities.filter(a => AMENITIES_BY_TYPE[newType].some(am => am.label === a)),
      };
    });
  };

  useEffect(() => {
    if (!editId) return;
    setFetchingEdit(true);
    api.getProperty(editId)
      .then(p => {
        const { amount: priceAmount, unit: priceUnit } = parsePrice(p.price);
        const { amount: areaAmount,  unit: areaUnit }  = parseArea(p.area);
        const { amenities, extras } = parseTags(p.tags, p.type);
        setForm({
          title: p.title || "", description: p.description || "",
          type: p.type || "House", status: p.status || "For Sale",
          priceAmount, priceUnit, areaAmount, areaUnit,
          beds:  p.beds  ?? 0, baths: p.baths ?? 0,
          furnishing:     extras.furnishing     || "",
          totalFloors:    extras.totalFloors    || 0,
          floorNumber:    extras.floorNumber    || 0,
          facing:         extras.facing         || "",
          landType:       extras.landType       || "",
          washrooms:      extras.washrooms      || 0,
          commFurnishing: extras.commFurnishing || "",
          amenities,
          location:     p.location    || "",
          contactPhone: p.owner_phone || "",
          images:       p.images      || [],
        });
      })
      .catch(() => Alert.alert("Error", "Could not load property for editing."))
      .finally(() => setFetchingEdit(false));
  }, [editId]);

  const save = async () => {
    try {
      setLoading(true);

      // Upload any newly-picked local images (→ {url, thumb}); keep hosted ones.
      const isLocal = (u) => u.startsWith("file:") || u.startsWith("content:") || u.startsWith("ph:");
      const localUris = form.images.filter(isLocal);
      const uploaded = localUris.length ? await api.uploadImages(localUris) : [];
      let k = 0;
      const finalImages = [];
      const finalThumbs = [];
      for (const u of form.images) {
        if (isLocal(u)) {
          const pair = uploaded[k++];
          if (pair) { finalImages.push(pair.url); finalThumbs.push(pair.thumb); }
        } else {
          finalImages.push(u);
          // our stored images expose a matching _thumb; external URLs fall back to themselves
          finalThumbs.push(u.includes("/media/") ? u.replace(/\.jpg$/, "_thumb.jpg") : u);
        }
      }

      const payload = {
        title: form.title, description: form.description,
        type: form.type, status: form.status,
        price: formatPrice(form.priceAmount, form.priceUnit),
        area:  formatArea(form.areaAmount, form.areaUnit),
        beds:  form.beds  > 0 ? form.beds  : null,
        baths: form.baths > 0 ? form.baths : null,
        tags:  buildTags(form),
        location:    form.location,
        owner_phone: form.contactPhone || null,
        images:      finalImages,
        thumbnails:  finalThumbs,
      };
      if (isEditing) {
        await api.updateProperty(editId, payload);
        setStep(1); setForm(EMPTY_FORM);
        // Just close the editor — the detail screen is already open behind it
        router.back();
        return;
      } else {
        const ownerName   = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Owner";
        const ownerAvatar = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase() || "ZM";
        const isVerified  = user?.primaryEmailAddress?.verification?.status === "verified";
        await api.createProperty({
          ...payload,
          owner_name:   ownerName,
          owner_avatar: ownerAvatar,
          owner_phone:  form.contactPhone || null,
          verified:     isVerified,
          img:          "🏠",
          color:        C.amber,
        });
        Alert.alert("🎉 Published!", "Your listing is now live.");
        // navigate (not push) → switch to the Discover tab without stacking screens
        router.navigate("/(tabs)/discover");
      }
      setStep(1); setForm(EMPTY_FORM);
    } catch (e) {
      const msg = /too large|413|payload/i.test(e.message || "")
        ? `Some photos are too large to upload. Please keep each photo under ${MAX_IMAGE_MB} MB and try again.`
        : (e.message || "Something went wrong. Please try again.");
      Alert.alert("Couldn't save", msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isSignedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 20, alignItems: "center", paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 46, marginBottom: 16, marginTop: 60 }}>🔒</Text>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", fontFamily: FONT, marginBottom: 8 }}>Sign in to Post</Text>
        <Text style={{ color: C.muted, fontSize: 14, fontFamily: FONT, textAlign: "center", marginBottom: 24, lineHeight: 22 }}>
          Free listing · No brokerage · Direct buyer connect
        </Text>
        <NeoButton title="Sign In to List →" onPress={() => router.push("/sign-in")} />
      </View>
    );
  }

  if (fetchingEdit) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={C.amber} size="large" />
        <Text style={{ color: C.muted, marginTop: 12, fontFamily: FONT }}>Loading property…</Text>
      </View>
    );
  }

  const areaUnits     = AREA_UNITS_BY_TYPE[form.type];
  const amenities     = AMENITIES_BY_TYPE[form.type];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">

        {/* Title */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
          <Text style={{ fontSize: 32, color: C.fg, fontFamily: FONT_HEAD, letterSpacing: -0.6, lineHeight: 36 }}>
            {isEditing ? "Edit Listing" : "Post a Property"}
          </Text>
          {isEditing && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Pressable onPress={() => { setStep(1); setForm(EMPTY_FORM); router.back(); }} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
                <Text style={{ color: C.fgDim, fontFamily: FONT_MED, fontSize: 13 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={save}
                disabled={loading}
                style={({ pressed }) => ({
                  flexDirection: "row", alignItems: "center", gap: 6,
                  paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
                  backgroundColor: C.amber, opacity: pressed ? 0.85 : loading ? 0.6 : 1,
                })}
              >
                {loading
                  ? <ActivityIndicator size="small" color={C.ink} />
                  : <Icon name="check" size={15} color={C.ink} strokeWidth={2.2} />}
                <Text style={{ color: C.ink, fontFamily: FONT_MED, fontSize: 13 }}>{loading ? "Saving…" : "Save"}</Text>
              </Pressable>
            </View>
          )}
        </View>
        <Text style={{ color: C.amberText, fontSize: 12, fontWeight: "700", fontFamily: FONT, marginBottom: 22 }}>
          {isEditing ? "Change anything and tap Save — no need to redo every step" : "Free · No brokerage · Direct connect"}
        </Text>

        {/* Progress stepper */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 28 }}>
          {STEPS.map((s, i) => {
            const n = i + 1;
            const done = step > n;
            const current = step === n;
            return (
              <React.Fragment key={s}>
                <Pressable onPress={() => done && setStep(n)} style={{ alignItems: "center", width: 62 }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    alignItems: "center", justifyContent: "center",
                    backgroundColor: done ? C.green : current ? C.amber : C.chipBg,
                    borderWidth: 1.5,
                    borderColor: (done || current) ? "transparent" : C.glassBorder,
                    ...(current ? { shadowColor: C.amber, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 9, elevation: 6 } : {}),
                  }}>
                    {done
                      ? <Icon name="check" size={18} color={C.ink} strokeWidth={2.4} />
                      : <Text style={{ color: current ? C.ink : C.fgFaint, fontFamily: FONT_MED, fontSize: 14, fontWeight: "800" }}>{n}</Text>}
                  </View>
                  <Text style={{ marginTop: 7, fontSize: 10, fontFamily: (current || done) ? FONT_MED : FONT, color: current ? C.amberText : done ? C.green : C.fgFaint, letterSpacing: 0.3 }}>
                    {s}
                  </Text>
                </Pressable>
                {i < STEPS.length - 1 && (
                  <View style={{ flex: 1, height: 2, marginTop: 17, borderRadius: 1, backgroundColor: step > n ? C.green : C.line }} />
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* ─── Step 1: Details ────────────────────────────── */}
        {step === 1 && (
          <View>
            <View style={{ marginBottom: 18 }}>
              <FieldLabel txt="Property Type" icon="home" />
              <SegmentPicker options={TYPES} value={form.type} onChange={changeType} />
            </View>

            <View style={{ marginBottom: 18 }}>
              <FieldLabel txt="Listing Status" icon="bookmark" />
              <SegmentPicker options={["For Sale", "For Rent"]} value={form.status} onChange={v => set("status", v)} color={C.blue} />
            </View>

            <InputField labelText="Title" icon="text" value={form.title} onChange={v => set("title", v)} placeholder="e.g. 3BHK Flat in Bandra West" />
            <InputField labelText="Description" icon="menu" value={form.description} onChange={v => set("description", v)} placeholder="Describe the property, nearby landmarks, condition…" multiline />

            <PhotoPicker images={form.images} onChange={v => set("images", v)} />

            <PriceField
              amount={form.priceAmount} unit={form.priceUnit}
              onAmountChange={v => set("priceAmount", v.replace(/[^0-9.]/g, ""))}
              onUnitChange={v => set("priceUnit", v)}
            />
            <AreaField
              amount={form.areaAmount} unit={form.areaUnit} units={areaUnits}
              onAmountChange={v => set("areaAmount", v.replace(/[^0-9.]/g, ""))}
              onUnitChange={v => set("areaUnit", v)}
            />

            {form.type === "House" && (
              <View>
                <View style={{ flexDirection: "row", gap: 14, marginBottom: 16 }}>
                  <Stepper labelText="Bedrooms"  value={form.beds}  onChange={v => set("beds",  v)} />
                  <Stepper labelText="Bathrooms" value={form.baths} onChange={v => set("baths", v)} />
                </View>
                <ChipSelector icon="sparkle" labelText="Furnishing" options={FURNISHING_OPTIONS} value={form.furnishing} onChange={v => set("furnishing", v)} color={C.green} />
                <View style={{ marginBottom: 16 }}>
                  <FieldLabel txt="Total Floors in Building" />
                  <View style={{ width: 160 }}>
                    <Stepper value={form.totalFloors} onChange={v => set("totalFloors", v)} />
                  </View>
                </View>
              </View>
            )}

            {form.type === "Apartment" && (
              <View>
                <View style={{ flexDirection: "row", gap: 14, marginBottom: 16 }}>
                  <Stepper labelText="Bedrooms"  value={form.beds}  onChange={v => set("beds",  v)} />
                  <Stepper labelText="Bathrooms" value={form.baths} onChange={v => set("baths", v)} />
                </View>
                <View style={{ flexDirection: "row", gap: 14, marginBottom: 16 }}>
                  <Stepper labelText="Floor Number" value={form.floorNumber} onChange={v => set("floorNumber", v)} />
                  <Stepper labelText="Total Floors"  value={form.totalFloors} onChange={v => set("totalFloors", v)} />
                </View>
                <ChipSelector icon="compass" labelText="Facing Direction" options={FACING_OPTIONS} value={form.facing} onChange={v => set("facing", v)} color={C.purple} />
                <ChipSelector icon="sparkle" labelText="Furnishing" options={FURNISHING_OPTIONS} value={form.furnishing} onChange={v => set("furnishing", v)} color={C.green} />
              </View>
            )}

            {form.type === "Land" && (
              <ChipSelector icon="map" labelText="Land Type" options={LAND_TYPE_OPTIONS} value={form.landType} onChange={v => set("landType", v)} color={C.orange} />
            )}

            {form.type === "Commercial" && (
              <View>
                <View style={{ flexDirection: "row", gap: 14, marginBottom: 16 }}>
                  <Stepper labelText="Floor Number" value={form.floorNumber} onChange={v => set("floorNumber", v)} />
                  <Stepper labelText="Washrooms"    value={form.washrooms}   onChange={v => set("washrooms",   v)} />
                </View>
                <ChipSelector icon="sparkle" labelText="Furnishing" options={COMM_FURNISHING_OPTIONS} value={form.commFurnishing} onChange={v => set("commFurnishing", v)} color={C.blue} />
              </View>
            )}

            <NeoButton full title="Next: Amenities →" onPress={() => setStep(2)} />
          </View>
        )}

        {/* ─── Step 2: Amenities ──────────────────────────── */}
        {step === 2 && (
          <View>
            <Text style={{ color: C.muted, fontSize: 13, fontFamily: FONT, marginBottom: 18, lineHeight: 22 }}>
              Select all features that apply to this {form.type.toLowerCase()}.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
              {amenities.map(({ icon, label: lbl }) => {
                const selected = form.amenities.includes(lbl);
                return (
                  <Pressable
                    key={lbl}
                    onPress={() => toggleAmenity(lbl)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100, backgroundColor: selected ? C.green + "22" : C.chipBg, borderWidth: 1.5, borderColor: selected ? C.green + "66" : C.glassBorder }}
                  >
                    <Text style={{ fontSize: 14 }}>{icon}</Text>
                    <Text style={{ color: selected ? C.green : C.fgDim, fontWeight: "700", fontSize: 12, fontFamily: FONT_MED }}>{lbl}</Text>
                    {selected && <Icon name="check" size={12} color={C.green} strokeWidth={2.5} />}
                  </Pressable>
                );
              })}
            </View>
            {form.amenities.length > 0 && (
              <View style={{ backgroundColor: C.green + "15", borderRadius: 14, padding: 12, marginBottom: 16 }}>
                <Text style={{ color: C.green, fontSize: 12, fontWeight: "700", fontFamily: FONT }}>
                  ✓ {form.amenities.length} feature{form.amenities.length === 1 ? "" : "s"} selected: {form.amenities.join(", ")}
                </Text>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <NeoButton title="← Back" fill={C.cardAlt} fg={C.text} onPress={() => setStep(1)} />
              <NeoButton full title="Next: Location →" onPress={() => setStep(3)} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {/* ─── Step 3: Location ───────────────────────────── */}
        {step === 3 && (
          <View style={{ gap: 16 }}>
            <InputField labelText="Address / Locality" icon="pin" value={form.location} onChange={v => set("location", v)} placeholder="e.g. Andheri West, Mumbai — 400053" />
            <InputField labelText="WhatsApp / Contact Number" icon="phone" value={form.contactPhone} onChange={v => set("contactPhone", v.replace(/[^0-9+\s\-]/g, ""))} placeholder="e.g. 98765 43210" keyboardType="phone-pad" />

            {/* Map placeholder — glass card */}
            <View style={{
              backgroundColor: C.card, borderRadius: 22, borderWidth: 1, borderColor: C.glassBorder,
              shadowColor: C.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 4,
              height: 160, alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ fontSize: 36 }}>📍</Text>
              <Text style={{ color: C.amberText, fontWeight: "700", marginTop: 10, fontFamily: FONT }}>Map pin coming soon</Text>
              <Text style={{ color: C.muted, fontSize: 11, fontFamily: FONT, marginTop: 4 }}>Location shown to signed-in users only</Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <NeoButton title="← Back" fill={C.cardAlt} fg={C.text} onPress={() => setStep(2)} />
              <NeoButton full title="Next: Review →" onPress={() => setStep(4)} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {/* ─── Step 4: Review ─────────────────────────────── */}
        {step === 4 && (
          <View style={{ gap: 14 }}>
            <View style={{
              backgroundColor: C.card, borderRadius: 22, borderWidth: 1, borderColor: C.glassBorder,
              shadowColor: C.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 4,
              padding: 20,
            }}>
              <Text style={{ color: C.text, fontWeight: "800", fontSize: 16, marginBottom: 18, fontFamily: FONT }}>
                {isEditing ? "Review changes ✏️" : "Ready to publish 🎉"}
              </Text>
              {[
                ["🏷️", form.title || "—"],
                ["🏠", `${form.type} · ${form.status}`],
                ["💰", form.priceAmount ? `₹${form.priceAmount} ${form.priceUnit}` : "—"],
                ["📐", form.areaAmount  ? `${form.areaAmount} ${form.areaUnit}` : "—"],
                ["📍", form.location || "—"],
                form.beds  > 0 ? ["🛏️", `${form.beds} Bed${form.beds > 1 ? "s" : ""}`] : null,
                form.baths > 0 ? ["🚿", `${form.baths} Bath${form.baths > 1 ? "s" : ""}`] : null,
                form.furnishing     ? ["🛋️", form.furnishing]     : null,
                form.commFurnishing ? ["🏢", form.commFurnishing]  : null,
                form.facing         ? ["🧭", form.facing]          : null,
                form.landType       ? ["🌿", form.landType]        : null,
                form.floorNumber > 0 ? ["🏬", `Floor ${form.floorNumber}${form.totalFloors > 0 ? ` of ${form.totalFloors}` : ""}`] : null,
                form.washrooms > 0  ? ["🚾", `${form.washrooms} Washroom${form.washrooms > 1 ? "s" : ""}`] : null,
                form.amenities.length > 0 ? ["✨", form.amenities.slice(0, 4).join(", ") + (form.amenities.length > 4 ? ` +${form.amenities.length - 4}` : "")] : null,
              ].filter(Boolean).map(([icon, val]) => (
                <View key={icon} style={{ flexDirection: "row", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                  <Text style={{ fontSize: 14, width: 22 }}>{icon}</Text>
                  <Text style={{ color: C.text, fontSize: 13, fontFamily: FONT, flex: 1, lineHeight: 20 }}>{val}</Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <NeoButton title="← Back" fill={C.cardAlt} fg={C.text} onPress={() => setStep(3)} />
              <NeoButton
                full
                title={loading ? (isEditing ? "Updating…" : "Publishing…") : (isEditing ? "✏️ Update Listing" : "🚀 Publish")}
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
