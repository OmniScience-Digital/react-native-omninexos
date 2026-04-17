import { useTheme } from "@/src/contexts/theme-context";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface BooleanQuestionProps {
  question: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  previousAnswer?: boolean | null;
}

export default function BooleanQuestion({
  question,
  value,
  onChange,
  previousAnswer,
}: BooleanQuestionProps) {
  const { theme } = useTheme();
  const styles = StyleSheet.create({
    container: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: 12,
      backgroundColor: theme.colors.card,
    },
    containerAccent: {
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.info,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    question: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.text,
      lineHeight: 18,
    },
    buttons: {
      flexDirection: "row",
      gap: 6,
    },
    btn: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    btnText: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.colors.textMuted,
    },
    btnYesActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    btnYesActiveText: {
      color: theme.colors.primaryText,
    },
    btnNoActive: {
      backgroundColor: "#ef4444", // Keep error red (or use theme.colors.error if added)
      borderColor: "#ef4444",
    },
    btnNoActiveText: {
      color: theme.colors.primaryText,
    },
    previous: {
      fontSize: 11,
      color: theme.colors.info,
      marginTop: 6,
    },
  });
  return (
    <View
      style={[
        styles.container,
        previousAnswer !== null &&
          previousAnswer !== undefined &&
          styles.containerAccent,
      ]}
    >
      <View style={styles.row}>
        <Text style={styles.question}>{question}</Text>
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.btn, value === true && styles.btnYesActive]}
            onPress={() => onChange(true)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.btnText,
                value === true && styles.btnYesActiveText,
              ]}
            >
              Yes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, value === false && styles.btnNoActive]}
            onPress={() => onChange(false)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.btnText,
                value === false && styles.btnNoActiveText,
              ]}
            >
              No
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      {previousAnswer !== null && previousAnswer !== undefined && (
        <Text style={styles.previous}>
          Previous: {previousAnswer ? "✅ Yes" : "❌ No"}
        </Text>
      )}
    </View>
  );
}
