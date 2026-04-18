// app/index.tsx
import { ModuleCard, StatCard } from "@/components/ui/DashboardCards";
import { Screen, ThemedText } from "@/components/ui/screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useTheme } from "@/src/contexts/theme-context";
import { showResponseModal } from "@/src/state";
import {
  useLazyGetInspectionsByFleetQuery,
  useListCategoriesQuery,
  useListFleetsQuery,
} from "@/src/state/api";
import { useAppDispatch } from "@/src/state/redux";
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
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";

export default function HomeScreen() {
  const { theme } = useTheme();
  const currentDate = format(new Date(), "MMM d, yyyy");
  const dispatch = useAppDispatch();

  // Real data from Redux/RTK Query
  const { data: vehicles = [], isLoading: vehiclesLoading } =
    useListFleetsQuery();
  const { data: categories = [], isLoading: categoriesLoading } =
    useListCategoriesQuery();
  const [getInspections] = useLazyGetInspectionsByFleetQuery();

  const [totalInspections, setTotalInspections] = useState(0);
  const [recentInspections, setRecentInspections] = useState<Inspection[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  // Calculate total inspections by summing the max inspectionNo per vehicle
  useEffect(() => {
    const calculateTotal = async () => {
      if (!vehicles.length) return;
      setIsCalculating(true);
      let sum = 0;
      const allRecent: Inspection[] = [];
      for (const vehicle of vehicles) {
        const result = await getInspections({
          fleetId: vehicle.id,
          limit: 1,
        }).unwrap();
        const latest = result?.[0];
        if (latest) {
          sum += latest.inspectionNo ?? 0;
          allRecent.push(latest);
        }
      }
      setTotalInspections(sum);
      // Sort recent inspections by date descending and take first 5
      const sorted = allRecent.sort(
        (a, b) =>
          new Date(b.inspectionDate || 0).getTime() -
          new Date(a.inspectionDate || 0).getTime(),
      );
      setRecentInspections(sorted.slice(0, 5));
      setIsCalculating(false);
    };
    calculateTotal();
  }, [vehicles, getInspections]);

  const totalVehicles = vehicles.length;
  const totalCategories = categories.length;
  const isLoading = vehiclesLoading || categoriesLoading || isCalculating;

  const handleStockPress = () => {
    dispatch(
      showResponseModal({
        successful: true,
        message: "Stock Management coming soon",
      }),
    );
  };
  const handleInspectionPress = () => {
    dispatch(
      showResponseModal({
        successful: true,
        message: "Inspection view Coming soon",
      }),
    );
  };
  const handleFormsPress = () => {
    router.push("/forms");
  };
  const handleSettingsPress = () => {
    router.push("/settings");
  };

  // Data for stats cards
  const statsData = [
    {
      id: "inspections",
      title: "Total Inspections",
      value: isLoading ? "..." : String(totalInspections),
      icon: ClipboardCheck,
      trend: "all time",
      trendType: "success" as const,
    },
    {
      id: "categories",
      title: "Stock Categories",
      value: categoriesLoading ? "..." : String(totalCategories),
      icon: Package,
      trend: "active",
      trendType: "success" as const,
    },
    {
      id: "vehicles",
      title: "Active Vehicles",
      value: vehiclesLoading ? "..." : String(totalVehicles),
      icon: Truck,
      // no trend or trendType
    },
    {
      id: "pending",
      title: "Out of Stock",
      value: "0",
      icon: FileText,
      trend: "soon",
      trendType: "warning" as const,
    },
  ];

  return (
    <Screen>
      <CustomScrollView>
        {/* Header */}
        <View className="mb-4">
          <View className="flex-row justify-end">
            <Pressable
              onPress={handleSettingsPress}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={({ pressed }) => [
                { backgroundColor: theme.colors.glass },
                pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
              ]}
            >
              <Settings size={20} color={theme.colors.text} />
            </Pressable>
          </View>

          {/* Stats card with real totals */}
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
                  Total Vehicles
                </ThemedText>
                <ThemedText
                  variant="h1"
                  weight="700"
                  style={{ color: theme.colors.primaryText, marginTop: 4 }}
                >
                  {vehiclesLoading ? "..." : totalVehicles}
                </ThemedText>
              </View>
              <Truck size={32} color={theme.colors.primaryText} />
            </View>

            <View
              className="mt-4 pt-4 border-t"
              style={{ borderColor: theme.colors.primaryText + "30" }}
            >
              <View className="flex-row justify-between">
                <View className="flex-row items-center gap-2">
                  <Package size={16} color={theme.colors.primaryText} />
                  <ThemedText
                    variant="small"
                    style={{ color: theme.colors.primaryText, opacity: 0.9 }}
                  >
                    Categories: {categoriesLoading ? "..." : totalCategories}
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
        <View className="mb-1">
          <ThemedText variant="h2" weight="700">
            Quick Overview
          </ThemedText>
        </View>

        <FlatList
          data={statsData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <StatCard
              title={item.title}
              value={item.value}
              icon={item.icon}
              trend={item.trend}
              trendType={item.trendType}
            />
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 16 }}
          className="mb-4"
        />

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
            title="Fleet Management"
            description="Vehicle inspections & management"
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

        {/* Recent Activity – real inspections */}
        <View className="mt-2">
          <View className="flex-row justify-between items-center mb-3">
            <ThemedText variant="h2" weight="700">
              Recent Inspections
            </ThemedText>
            <Pressable
              onPress={() =>
                dispatch(
                  showResponseModal({
                    successful: true,
                    message: "Inspections view Coming soon",
                  }),
                )
              }
              className="rounded-full border px-4 py-1"
              style={{ borderColor: theme.colors.text }}
            >
              <ThemedText style={{ color: theme.colors.text }} variant="small">
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
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.colors.text} />
            ) : recentInspections.length === 0 ? (
              <>
                <View className="flex-row items-center mb-3">
                  <Bell size={16} color={theme.colors.info} />
                  <ThemedText muted variant="small" style={{ marginLeft: 8 }}>
                    No recent inspections
                  </ThemedText>
                </View>
                <ThemedText muted variant="small">
                  Complete an inspection to see activity here.
                </ThemedText>
              </>
            ) : (
              recentInspections.map((inspection: Inspection) => (
                <View
                  key={inspection.id}
                  className="mb-3 pb-2 border-b"
                  style={{ borderColor: theme.colors.border }}
                >
                  <View className="flex-row justify-between">
                    <ThemedText weight="600">
                      {inspection.vehicleReg ?? "Unknown"}
                    </ThemedText>
                    <ThemedText muted variant="small">
                      {inspection.inspectionDate
                        ? format(new Date(inspection.inspectionDate), "MMM dd")
                        : "No date"}
                    </ThemedText>
                  </View>
                  <ThemedText muted variant="small">
                    Odometer: {inspection.odometerStart ?? 0} km · Inspection #
                    {inspection.inspectionNo ?? "?"}
                  </ThemedText>
                </View>
              ))
            )}
          </View>
        </View>
      </CustomScrollView>
    </Screen>
  );
}
