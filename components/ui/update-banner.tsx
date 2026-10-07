// components/ui/update-banner.tsx
//
// Shown when appUpdates.checkForUpdate() has already downloaded a new OTA
// bundle (see app/_layout.tsx) and it's ready to switch to. Deliberately not
// a modal/blocking dialog — someone mid-inspection shouldn't be interrupted;
// this sits at the top of the screen until they choose to restart, or
// dismiss it and get prompted again next launch.
import { useTheme } from "@/src/contexts/theme-context";
import { RefreshCw, X } from "lucide-react-native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export function UpdateBanner({
  onRestart,
  onDismiss,
}: {
  onRestart: () => void;
  onDismiss: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <RefreshCw size={16} color={theme.colors.primaryText} />
      <Text style={[styles.text, { color: theme.colors.primaryText }]}>
        An update is ready — restart to apply
      </Text>
      <TouchableOpacity onPress={onRestart} style={styles.action}>
        <Text style={[styles.actionText, { color: theme.colors.primaryText }]}>
          Restart
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} hitSlop={8}>
        <X size={16} color={theme.colors.primaryText} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  action: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  actionText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
