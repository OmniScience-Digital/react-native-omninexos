// components/ui/MenuButton.tsx
// The button that opens the side menu. Put it in a screen's header.
import { useSideMenu } from "@/src/contexts/sidemenu-context";
import { useTheme } from "@/src/contexts/theme-context";
import { Menu } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";

export function MenuButton() {
  const { theme } = useTheme();
  const { open } = useSideMenu();
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Menu size={20} color={theme.colors.text} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});
