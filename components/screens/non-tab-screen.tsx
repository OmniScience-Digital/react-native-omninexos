//components/screens/non-tab-screen
import { ThemedText } from "@/components/screens/screen";
import { useTheme } from "@/src/contexts/theme-context";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface NonTabScreenProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showBack?: boolean;
  scrollable?: boolean;
  footerText?: string;
}

export function NonTabScreen({
  title,
  subtitle,
  children,
  showBack = true,
  scrollable = true,
  footerText = `Omninexos © ${new Date().getFullYear()}`,
}: NonTabScreenProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={{ flex: 1, backgroundColor: "transparent" }}
      >
        {/* Header */}
        <View
          style={[styles.header, { borderBottomColor: theme.colors.border }]}
        >
          {showBack && (
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <ArrowLeft size={20} color={theme.colors.text} />
            </Pressable>
          )}
          <View style={styles.titleContainer}>
            <ThemedText
              style={[styles.headerTitle, { color: theme.colors.text }]}
            >
              {title}
            </ThemedText>
            {subtitle && (
              <ThemedText
                muted
                style={[styles.headerSub, { color: theme.colors.textMuted }]}
              >
                {subtitle}
              </ThemedText>
            )}
          </View>
          {/* Spacer to keep title left-aligned when back button exists */}
          {showBack && <View style={{ width: 40 }} />}
        </View>

        <View style={{ flex: 1, padding: theme.spacing.sm }}>{children}</View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <ThemedText
            muted
            style={[styles.footerText, { color: theme.colors.textMuted }]}
          >
            {footerText}
          </ThemedText>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },

  footer: {
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: 0.5,
  },
  footerText: {
    fontSize: 12,
  },
});
