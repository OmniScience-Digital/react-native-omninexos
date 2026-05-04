// components/ui/ConfirmDialog.tsx
import { useTheme } from "@/src/contexts/theme-context";
import { LucideIcon, Trash2 } from "lucide-react-native";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  icon?: LucideIcon;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  icon: Icon = Trash2,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { theme } = useTheme();
  const { colors, radius } = theme;

  const variantColors = {
    danger: {
      bg: "#fef2f2",
      border: "#fecaca",
      icon: "#ef4444",
      btnBg: "#fef2f2",
      btnBorder: "#fecaca",
      btnText: "#dc2626",
    },
    warning: {
      bg: colors.warning + "20",
      border: colors.warning + "40",
      icon: colors.warning,
      btnBg: colors.warning + "20",
      btnBorder: colors.warning + "40",
      btnText: colors.warning,
    },
    info: {
      bg: colors.info + "20",
      border: colors.info + "40",
      icon: colors.info,
      btnBg: colors.info + "20",
      btnBorder: colors.info + "40",
      btnText: colors.info,
    },
  };

  const v = variantColors[variant];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onCancel}>
        <View
          style={[
            s.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radius.xl,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Icon */}
          <View
            style={[
              s.iconWrap,
              {
                backgroundColor: v.bg,
                borderColor: v.border,
                borderRadius: radius.md,
              },
            ]}
          >
            <Icon size={18} color={v.icon} />
          </View>

          {/* Text */}
          <Text style={[s.title, { color: colors.text }]}>{title}</Text>
          <Text style={[s.message, { color: colors.textMuted }]}>
            {message}
          </Text>

          {/* Buttons */}
          <View style={s.btnRow}>
            <TouchableOpacity
              style={[
                s.btn,
                {
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  backgroundColor: colors.background,
                },
              ]}
              onPress={onCancel}
            >
              <Text style={[s.btnText, { color: colors.textMuted }]}>
                {cancelText}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.btn,
                {
                  borderColor: v.btnBorder,
                  borderRadius: radius.md,
                  backgroundColor: v.btnBg,
                },
              ]}
              onPress={() => {
                onConfirm();
                onCancel(); // close after confirm
              }}
            >
              <Text
                style={[s.btnText, { color: v.btnText, fontWeight: "600" }]}
              >
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderWidth: 0.5,
    padding: 20,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "500",
  },
  message: {
    fontSize: 13,
    lineHeight: 20,
  },
  btnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 0.5,
  },
  btnText: {
    fontSize: 13,
  },
});

// Usage example — replace your Alert.alert with this

// import ConfirmDialog from "@/components/ui/ConfirmDialog";
// import { RotateCcw } from "lucide-react-native";
// import { useState } from "react";

// // 1. Add state
// const [clearDialogVisible, setClearDialogVisible] = useState(false);

// // 2. Replace handleClearForm
// const handleClearForm = () => setClearDialogVisible(true);

// // 3. Add component to your JSX (anywhere in the return, outside ScrollView)
// <ConfirmDialog
//   visible={clearDialogVisible}
//   title="Clear form?"
//   message="This will clear all categories, subcategories and subcomponents. This cannot be undone."
//   confirmText="Clear form"
//   cancelText="Cancel"
//   variant="danger"
//   icon={RotateCcw}
//   onConfirm={() => dispatch(resetStockForm())}
//   onCancel={() => setClearDialogVisible(false)}
// />

// // ── Other usage examples ──────────────────────────────────────

// // Clear cache (warning variant)
// <ConfirmDialog
//   visible={clearCacheVisible}
//   title="Clear cache?"
//   message="Cached categories and components will be removed. They will reload next time you're online."
//   confirmText="Clear cache"
//   cancelText="Keep it"
//   variant="warning"
//   icon={RefreshCcw}
//   onConfirm={handleClearCache}
//   onCancel={() => setClearCacheVisible(false)}
// />

// // Info / neutral action
// <ConfirmDialog
//   visible={submitVisible}
//   title="Submit inspection?"
//   message="This will save the inspection and create a ClickUp task. You cannot edit it after submission."
//   confirmText="Submit"
//   cancelText="Go back"
//   variant="info"
//   onConfirm={handleSubmit}
//   onCancel={() => setSubmitVisible(false)}
// />
