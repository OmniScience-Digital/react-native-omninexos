import { useTheme } from "@/src/contexts/theme-context";
import { CheckCircle, X, XCircle } from "lucide-react-native";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface ResponseModalProps {
  visible: boolean;
  successful: boolean;
  message: string;
  onClose: () => void;
}

export default function ResponseModal({
  visible,
  successful,
  message,
  onClose,
}: ResponseModalProps) {
  const { theme } = useTheme();
  const { colors, radius } = theme;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={s.overlay}>
        <View
          style={[
            s.card,
            { backgroundColor: colors.card, borderRadius: radius.xl },
          ]}
        >
          <TouchableOpacity
            style={s.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <X size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <View
            style={[
              s.iconWrapper,
              {
                backgroundColor: successful
                  ? colors.success + "18"
                  : "#ef444418",
                borderRadius: 999,
              },
            ]}
          >
            {successful ? (
              <CheckCircle size={28} color={colors.success} />
            ) : (
              <XCircle size={28} color="#ef4444" />
            )}
          </View>

          <Text style={[s.title, { color: colors.text }]}>
            {successful ? "Success" : "Error"}
          </Text>
          <Text style={[s.message, { color: colors.textMuted }]}>
            {message}
          </Text>

          <TouchableOpacity
            style={[
              s.btn,
              {
                backgroundColor: successful ? colors.success : "#ef4444",
                borderRadius: radius.md,
              },
            ]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={s.btnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  closeBtn: { position: "absolute", top: 14, right: 14, padding: 4 },
  iconWrapper: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "600" },
  message: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  btn: {
    marginTop: 4,
    paddingHorizontal: 32,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
