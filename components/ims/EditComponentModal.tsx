// src/components/IMS/EditComponentModal.tsx
import { CustomScrollView } from "@/components/ui/scrollView";
import { useTheme } from "@/src/contexts/theme-context";
import { Save, X } from "lucide-react-native";
import React, { useState } from "react";
import {
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

interface Props {
  component: Component;
  visible: boolean;
  onClose: () => void;
  onSave: (updated: Component) => void;
}

const EditComponentModal: React.FC<Props> = ({
  component,
  visible,
  onClose,
  onSave,
}) => {
  const { theme } = useTheme();
  const C = theme.colors;
  const [form, setForm] = useState<Component>({ ...component });
  const set = (k: keyof Component, v: string | number | null) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: C.card, borderColor: C.border },
          ]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />
          <View style={[styles.sheetHeader, { borderBottomColor: C.border }]}>
            <Text style={[styles.sheetTitle, { color: C.text }]}>
              Edit · {component.componentId}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={C.textMuted} />
            </TouchableOpacity>
          </View>
          <CustomScrollView>
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={[styles.formLabel, { color: C.accent }]}>
                  COMPONENT ID *
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: C.background,
                      borderColor: C.border,
                      color: C.text,
                    },
                  ]}
                  value={form.componentId}
                  onChangeText={(v) => set("componentId", v)}
                  placeholderTextColor={C.textMuted}
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={[styles.formLabel, { color: C.accent }]}>
                  NAME
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: C.background,
                      borderColor: C.border,
                      color: C.text,
                    },
                  ]}
                  value={form.componentName ?? ""}
                  onChangeText={(v) => set("componentName", v)}
                  placeholderTextColor={C.textMuted}
                />
              </View>
            </View>
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={[styles.formLabel, { color: C.accent }]}>
                  PRIMARY SUPPLIER
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: C.background,
                      borderColor: C.border,
                      color: C.text,
                    },
                  ]}
                  value={form.primarySupplier ?? ""}
                  onChangeText={(v) => set("primarySupplier", v)}
                  placeholderTextColor={C.textMuted}
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={[styles.formLabel, { color: C.accent }]}>
                  PRIMARY CODE
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: C.background,
                      borderColor: C.border,
                      color: C.text,
                    },
                  ]}
                  value={form.primarySupplierItemCode ?? ""}
                  onChangeText={(v) => set("primarySupplierItemCode", v)}
                  placeholderTextColor={C.textMuted}
                />
              </View>
            </View>
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={[styles.formLabel, { color: C.accent }]}>
                  SECONDARY SUPPLIER
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: C.background,
                      borderColor: C.border,
                      color: C.text,
                    },
                  ]}
                  value={form.secondarySupplier ?? ""}
                  onChangeText={(v) => set("secondarySupplier", v)}
                  placeholderTextColor={C.textMuted}
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={[styles.formLabel, { color: C.accent }]}>
                  SECONDARY CODE
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: C.background,
                      borderColor: C.border,
                      color: C.text,
                    },
                  ]}
                  value={form.secondarySupplierItemCode ?? ""}
                  onChangeText={(v) => set("secondarySupplierItemCode", v)}
                  placeholderTextColor={C.textMuted}
                />
              </View>
            </View>
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={[styles.formLabel, { color: C.accent }]}>
                  MIN STOCK
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: C.background,
                      borderColor: C.border,
                      color: C.text,
                    },
                  ]}
                  value={String(form.minimumStock)}
                  onChangeText={(v) => set("minimumStock", parseInt(v) || 0)}
                  keyboardType="numeric"
                  placeholderTextColor={C.textMuted}
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={[styles.formLabel, { color: C.accent }]}>
                  CURRENT STOCK
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: C.background,
                      borderColor: C.border,
                      color: C.text,
                    },
                  ]}
                  value={String(form.currentStock)}
                  onChangeText={(v) => set("currentStock", parseInt(v) || 0)}
                  keyboardType="numeric"
                  placeholderTextColor={C.textMuted}
                />
              </View>
            </View>
            <Text style={[styles.formLabel, { color: C.accent, marginTop: 4 }]}>
              DESCRIPTION
            </Text>
            <TextInput
              style={[
                styles.formTextarea,
                {
                  backgroundColor: C.background,
                  borderColor: C.border,
                  color: C.text,
                },
              ]}
              value={form.description ?? ""}
              onChangeText={(v) => set("description", v)}
              multiline
              numberOfLines={3}
              placeholderTextColor={C.textMuted}
              placeholder="Component description…"
            />
            <Text
              style={[styles.formLabel, { color: C.accent, marginTop: 10 }]}
            >
              NOTES
            </Text>
            <TextInput
              style={[
                styles.formTextarea,
                {
                  backgroundColor: C.background,
                  borderColor: C.border,
                  color: C.text,
                },
              ]}
              value={form.notes ?? ""}
              onChangeText={(v) => set("notes", v)}
              multiline
              numberOfLines={3}
              placeholderTextColor={C.textMuted}
              placeholder="Additional notes…"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btnSave, { backgroundColor: C.text }]}
                onPress={() => {
                  onSave(form);
                  onClose();
                }}
              >
                <Save size={13} color={C.background} />
                <Text style={[styles.btnSaveText, { color: C.background }]}>
                  SAVE CHANGES
                </Text>
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
          </CustomScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalSheet: {
    marginTop: 3,
    padding: 10,
    width: "100%",
    maxHeight: "90%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 15, fontWeight: "700" },
  formRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  formHalf: { flex: 1 },
  formLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  formInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 12,
  },
  formTextarea: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 12,
    minHeight: 72,
    textAlignVertical: "top",
    marginBottom: 4,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    marginBottom: 8,
  },
  btnSave: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 13,
  },
  btnSaveText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  btnCancel: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  btnCancelText: { fontSize: 12, fontWeight: "700" },
});

export default EditComponentModal;
