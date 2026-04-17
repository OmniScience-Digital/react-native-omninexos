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

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: 24,
      width: "100%",
      maxWidth: 320,
      alignItems: "center",
      gap: 12,
    },
    closeBtn: {
      position: "absolute",
      top: 16,
      right: 16,
      padding: 4,
    },
    iconWrapper: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: "center",
      justifyContent: "center",
    },
    iconSuccess: { backgroundColor: theme.colors.success + "20" }, // 20% opacity
    iconError: { backgroundColor: "#ef4444" + "20" }, // fallback, ideally theme.colors.error + "20"
    title: { fontSize: 17, fontWeight: "600", color: theme.colors.text },
    message: {
      fontSize: 14,
      color: theme.colors.textMuted,
      textAlign: "center",
      lineHeight: 20,
    },
    btn: {
      marginTop: 4,
      paddingHorizontal: 32,
      paddingVertical: 11,
      borderRadius: 8,
      width: "100%",
      alignItems: "center",
    },
    btnSuccess: { backgroundColor: theme.colors.success },
    btnError: { backgroundColor: "#ef4444" }, // fallback, ideally theme.colors.error
    btnText: {
      color: theme.colors.primaryText,
      fontWeight: "600",
      fontSize: 14,
    },
  });
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <X size={16} color="#64748b" />
          </TouchableOpacity>

          <View
            style={[
              styles.iconWrapper,
              successful ? styles.iconSuccess : styles.iconError,
            ]}
          >
            {successful ? (
              <CheckCircle size={28} color="#16a34a" />
            ) : (
              <XCircle size={28} color="#ef4444" />
            )}
          </View>

          <Text style={styles.title}>{successful ? "Success" : "Error"}</Text>
          <Text style={styles.message}>{message}</Text>

          <TouchableOpacity
            style={[
              styles.btn,
              successful ? styles.btnSuccess : styles.btnError,
            ]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.btnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
