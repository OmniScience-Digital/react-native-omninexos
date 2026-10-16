// components/ui/customHeader.tsx
import { ThemedText } from "@/components/screens/screen";
import { MenuButton } from "@/components/ui/MenuButton"; // SIDEMENU
import { useTheme } from "@/src/contexts/theme-context";
import { StyleSheet, View } from "react-native";

interface CustomHeaderProps {
  title: string;
  subtitle?: string;
  /** Show the button that opens the side menu (default: yes) */
  showMenu?: boolean; // SIDEMENU
}

export function CustomHeader({
  title,
  subtitle,
  showMenu = true,
}: CustomHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {/* SIDEMENU: menu button at the left, the title stays centred */}
      {showMenu && (
        <View style={styles.menu}>
          <MenuButton />
        </View>
      )}
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
    // keep long titles clear of the menu button
    paddingHorizontal: 48,
  },
  menu: {
    position: "absolute",
    left: 4,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 10,
    marginTop: 2,
  },
});
