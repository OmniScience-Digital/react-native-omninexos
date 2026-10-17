import { useTheme } from "@/src/contexts/theme-context";

export function useAuthInputStyle() {
  const { theme } = useTheme();

  return (hasError: boolean) => ({
    borderColor: hasError ? theme.colors.warning : theme.colors.border,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    // Explicit so Android's default TextInput padding/font don't take over
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    fontFamily: "sans-medium",
    textAlignVertical: "center" as const,
  });
}
