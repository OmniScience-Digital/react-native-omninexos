// components/ui/DashboardCards.tsx
import { ThemedText } from "@/components/ui/screen";
import { useTheme } from "@/src/contexts/theme-context";
import { TrendingUp } from "lucide-react-native";
import React from "react";
import { Pressable, View } from "react-native";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: any;
  trend?: string;
  trendType?: "success" | "warning";
}

export const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendType = "success",
}: StatCardProps) => {
  const { theme } = useTheme();
  const trendColor =
    trendType === "warning" ? theme.colors.warning : theme.colors.success;

  return (
    <View
      className="flex-1 p-4 rounded-2xl border mr-3"
      style={{
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
      }}
    >
      <View className="flex-row justify-between items-center mb-2">
        <Icon size={24} color={theme.colors.accent} />
        {trend && (
          <View className="flex-row items-center">
            <TrendingUp size={14} color={trendColor} />
            <ThemedText
              variant="small"
              style={{ color: trendColor, marginLeft: 4 }}
            >
              {trend}
            </ThemedText>
          </View>
        )}
      </View>
      <ThemedText variant="h1" weight="700" style={{ marginBottom: 4 }}>
        {value}
      </ThemedText>
      <ThemedText muted variant="small">
        {title}
      </ThemedText>
    </View>
  );
};

interface ModuleCardProps {
  title: string;
  description: string;
  icon: any;
  onPress: () => void;
}

export const ModuleCard = ({
  title,
  description,
  icon: Icon,
  onPress,
}: ModuleCardProps) => {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center p-4 rounded-2xl border mb-2 mt-1"
      style={{
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
      }}
    >
      <View
        className="w-12 h-12 rounded-full items-center justify-center mr-4"
        style={{ backgroundColor: theme.colors.accent + "20" }}
      >
        <Icon size={24} color={theme.colors.accent} />
      </View>
      <View className="flex-1">
        <ThemedText weight="700" style={{ marginBottom: 2 }}>
          {title}
        </ThemedText>
        <ThemedText muted variant="small">
          {description}
        </ThemedText>
      </View>
      <ThemedText style={{ color: theme.colors.accent }}>→</ThemedText>
    </Pressable>
  );
};
