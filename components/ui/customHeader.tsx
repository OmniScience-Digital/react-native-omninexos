import { ThemedText } from "@/components/ui/screen";
import { useTheme } from "@/src/contexts/theme-context";
import { StyleSheet, View } from "react-native";

interface CustomHeaderProps {
  title: string;
  subtitle?: string;
}

export function CustomHeader({ title, subtitle }: CustomHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <ThemedText variant="h2" weight="700">
          {title}
        </ThemedText>
        {subtitle && (
          <ThemedText
            muted
            style={[styles.subtitle, { color: theme.colors.textMuted }]}
          >
            {subtitle}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  titleContainer: {
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
