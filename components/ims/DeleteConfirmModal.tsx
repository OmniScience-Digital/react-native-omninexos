// src/components/IMS/DeleteConfirmModal.tsx
import { useTheme } from "@/src/contexts/theme-context";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface Props {
  visible: boolean;
  name: string;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmModal: React.FC<Props> = ({
  visible,
  name,
  onClose,
  onConfirm,
}) => {
  const { theme } = useTheme();
  const C = theme.colors;
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.confirmOverlay}>
        <View
          style={[
            styles.confirmBox,
            { backgroundColor: C.card, borderColor: "#3d0a0a" },
          ]}
        >
          <Text style={styles.confirmTitle}>Delete Component?</Text>
          <Text style={[styles.confirmBody, { color: C.textMuted }]}>
            This will permanently remove{" "}
            <Text style={{ color: C.text, fontWeight: "700" }}>{name}</Text>.
            This cannot be undone.
          </Text>
          <View style={styles.confirmActions}>
            <TouchableOpacity style={styles.btnDelete} onPress={onConfirm}>
              <Text style={styles.btnDeleteText}>DELETE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnCancel, { borderColor: C.border }]}
              onPress={onClose}
            >
              <Text style={[styles.btnCancelText, { color: C.textMuted }]}>
                CANCEL
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  confirmOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  confirmBox: { width: "85%", borderRadius: 16, borderWidth: 1, padding: 20 },
  confirmTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f87171",
    marginBottom: 8,
  },
  confirmBody: { fontSize: 12, lineHeight: 18, marginBottom: 20 },
  confirmActions: { flexDirection: "row", gap: 10 },
  btnDelete: {
    flex: 1,
    backgroundColor: "#200a0a",
    borderWidth: 1,
    borderColor: "#3d0a0a",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnDeleteText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#f87171",
    letterSpacing: 0.5,
  },
  btnCancel: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnCancelText: { fontSize: 12, fontWeight: "700" },
});

export default DeleteConfirmModal;
