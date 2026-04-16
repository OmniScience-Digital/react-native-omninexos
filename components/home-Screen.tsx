// app/index.tsx (or components/HomeScreen.tsx)
import { ModuleCard, StatCard } from "@/components/ui/DashboardCards";
import { Screen, ThemedText } from "@/components/ui/screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useTheme } from "@/src/contexts/theme-context";
import { format } from "date-fns";
import { router } from "expo-router";
import {
    Bell,
    Calendar,
    ClipboardCheck,
    ClipboardList,
    FileText,
    Package,
    Settings,
    Truck,
} from "lucide-react-native";
import React from "react";
import { Pressable, View } from "react-native";

export default function HomeScreen() {
  const { theme } = useTheme();

  // Inside component
  const currentDate = format(new Date(), "MMM d, yyyy");

  const handleStockPress = () => alert("Coming Soon");
  const handleInspectionPress = () => alert("Coming Soon");
  const handleFormsPress = () => {
    router.push("/forms");
  };

  const handleSettingsPress = () => {
    router.push("/settings");
  };

  return (
    <Screen>
      <CustomScrollView>
        {/* Header with vibrant gradient-like background */}
        <View className="mb-4">
          <View className="flex-row justify-end  mb-5">
            <Pressable onPress={() => console.log("Open settings")}>
              <View
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: theme.colors.glass }}
              >
                <Pressable
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={({ pressed }) => [
                    { backgroundColor: theme.colors.glass },
                    pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
                  ]}
                  onPress={handleSettingsPress}
                >
                  <Settings size={20} color={theme.colors.text} />
                </Pressable>
              </View>
            </Pressable>
          </View>

          {/* Stats card */}
          <View
            className="p-5 rounded-2xl"
            style={{
              backgroundColor: theme.colors.accent,
              shadowColor: theme.colors.shadow,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 5,
            }}
          >
            <View className="flex-row justify-between items-center">
              <View>
                <ThemedText
                  variant="small"
                  style={{ color: theme.colors.primaryText, opacity: 0.8 }}
                >
                  Total Inspections
                </ThemedText>
                <ThemedText
                  variant="h1"
                  weight="700"
                  style={{ color: theme.colors.primaryText, marginTop: 4 }}
                >
                  24
                </ThemedText>
              </View>
              <ClipboardCheck size={32} color={theme.colors.primaryText} />
            </View>

            <View
              className="mt-4 pt-4 border-t"
              style={{ borderColor: theme.colors.primaryText + "30" }}
            >
              <View className="flex-row justify-between">
                <View className="flex-row items-center gap-2">
                  <Truck size={16} color={theme.colors.primaryText} />
                  <ThemedText
                    variant="small"
                    style={{ color: theme.colors.primaryText, opacity: 0.9 }}
                  >
                    Active: 18
                  </ThemedText>
                </View>
                <View className="flex-row items-center gap-2">
                  <Calendar size={16} color={theme.colors.primaryText} />
                  <ThemedText
                    variant="small"
                    style={{ color: theme.colors.primaryText, opacity: 0.9 }}
                  >
                    {currentDate}
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View className="flex-row mb-6">
          <StatCard
            title="Pending Forms"
            value="12"
            icon={FileText}
            trend="+2"
            trendType="success"
          />
          <StatCard
            title="Stock Alerts"
            value="3"
            icon={Package}
            trend="low"
            trendType="warning"
          />
        </View>
        <View className="flex-row mb-6">
          <StatCard title="Active Vehicles" value="24" icon={Truck} />
          <StatCard
            title="Inspections Due"
            value="8"
            icon={ClipboardList}
            trend="urgent"
            trendType="warning"
          />
        </View>

        {/* Modules */}
        <View className="mb-1">
          <ThemedText variant="h2" weight="700">
            Modules
          </ThemedText>
          <ModuleCard
            title="Stock Management"
            description="Track inventory, low stock alerts"
            icon={Package}
            onPress={handleStockPress}
          />
          <ModuleCard
            title="Vehicle Inspection"
            description="Digital checklists & reports"
            icon={ClipboardList}
            onPress={handleInspectionPress}
          />
          <ModuleCard
            title="Forms"
            description="All operational forms in one place"
            icon={FileText}
            onPress={handleFormsPress}
          />
        </View>

        {/* Recent Activity */}
        <View className="mt-2">
          <View className="flex-row justify-between items-center mb-3">
            <ThemedText variant="h2" weight="700">
              Recent Activity
            </ThemedText>
            <Pressable>
              <ThemedText
                style={{ color: theme.colors.primary }}
                variant="small"
              >
                View all
              </ThemedText>
            </Pressable>
          </View>
          <View
            className="p-4 rounded-2xl border"
            style={{
              backgroundColor: theme.colors.glass,
              borderColor: theme.colors.border,
            }}
          >
            <View className="flex-row items-center mb-3">
              <Bell size={16} color={theme.colors.info} />
              <ThemedText muted variant="small" style={{ marginLeft: 8 }}>
                No recent updates
              </ThemedText>
            </View>
            <ThemedText muted variant="small">
              Complete an inspection or add stock to see activity here.
            </ThemedText>
          </View>
        </View>
      </CustomScrollView>
    </Screen>
  );
}
