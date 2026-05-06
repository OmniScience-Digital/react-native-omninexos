import { ThemedText } from "@/components/screens/screen";
import { useTheme } from "@/src/contexts/theme-context";
import React from "react";
import { Pressable, View } from "react-native";

/** Card style helper */
export const getCardStyle = (theme: any) => ({
  backgroundColor: theme.colors.card,
  borderColor: theme.colors.border,
});

/** Section Header */
export const SectionHeader = ({ title }: { title: string }) => (
  <View className="mb-3 px-1">
    <ThemedText variant="h2" weight="700">
      {title}
    </ThemedText>
  </View>
);

/** Generic Card */
export const AppCard = ({
  title,
  children,
  onPress,
}: {
  title: string;
  children: React.ReactNode;
  onPress?: () => void;
}) => {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row justify-between items-center p-4 rounded-2xl mb-3 border"
      style={getCardStyle(theme)}
    >
      <ThemedText variant="body" weight="600">
        {title}
      </ThemedText>
      {children}
    </Pressable>
  );
};
