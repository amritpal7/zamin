import React from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { C, FONT } from "../theme";

export default function ConfirmModal({
  visible, title, message,
  confirmLabel = "Confirm", confirmColor = C.red,
  onConfirm, onCancel,
}) {
  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={onCancel}>
      {/* Backdrop — tap outside to cancel */}
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: 24 }}
        onPress={onCancel}
      >
        {/* Inner Pressable eats the tap so it doesn't reach the backdrop */}
        <Pressable onPress={() => {}} style={{ width: "100%", maxWidth: 340 }}>
          {/* Neomorphic card */}
          <View>
            <View style={{ position: "absolute", left: 6, top: 6, right: -6, bottom: -6, backgroundColor: C.ink, borderRadius: 18 }} />
            <View style={{ backgroundColor: C.card, borderColor: C.ink, borderWidth: 2.5, borderRadius: 18, padding: 24 }}>
              <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", fontFamily: FONT, marginBottom: 10 }}>
                {title}
              </Text>
              <Text style={{ color: C.muted, fontSize: 14, fontFamily: FONT, lineHeight: 22, marginBottom: 26 }}>
                {message}
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={onCancel}
                  style={{ flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 2.5, borderColor: C.ink, backgroundColor: C.bg, alignItems: "center" }}
                >
                  <Text style={{ color: C.text, fontWeight: "700", fontFamily: FONT }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={onConfirm}
                  style={{ flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 2.5, borderColor: C.ink, backgroundColor: confirmColor, alignItems: "center" }}
                >
                  <Text style={{ color: C.ink, fontWeight: "800", fontFamily: FONT }}>{confirmLabel}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
