// components/screens/home-Screen.tsx
import { Screen, ThemedText } from "@/components/screens/screen";
import { ModuleCard, StatCard } from "@/components/ui/DashboardCards";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useClockIn } from "@/hooks/useClockIn";
import { useAuth } from "@/src/contexts/auth-context";
import { useTabBar } from "@/src/contexts/tabbar-context";
import { useTheme } from "@/src/contexts/theme-context";
import {
  useLazyGetInspectionsByFleetQuery,
  useListCategoriesQuery,
  useListFleetsQuery,
} from "@/src/state/api";
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  Bell,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LogIn,
  LogOut,
  Package,
  Settings,
  Timer,
  Truck,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";

// ── Attendance Hero Card ─────────────────────────────────────────────────────
function AttendanceHeroCard({
  isClockedIn,
  activeRecord,
  weekHours,
  weekDays,
  isLoading,
  onClockPress,
}: {
  isClockedIn: boolean;
  activeRecord: any;
  weekHours: number;
  weekDays: number;
  isLoading: boolean;
  onClockPress: () => void;
}) {
  const { theme } = useTheme();

  const safeTime = (iso?: string) => {
    if (!iso) return "--:--";
    try {
      return format(new Date(iso), "HH:mm");
    } catch {
      return "--:--";
    }
  };

  return (
    <View style={{ marginBottom: 20 }}>
      <LinearGradient
        colors={
          isClockedIn
            ? [theme.colors.success + "22", theme.colors.success + "08"]
            : [theme.colors.accent + "18", theme.colors.background]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.attendanceGradient,
          {
            borderColor: isClockedIn
              ? theme.colors.success + "40"
              : theme.colors.border,
          },
        ]}
      >
        {/* Status row */}
        <View style={styles.attendanceHeader}>
          <View>
            <ThemedText muted variant="small">
              Today's shift
            </ThemedText>
            <ThemedText weight="700" style={{ fontSize: 17, marginTop: 2 }}>
              {isClockedIn
                ? `On shift since ${safeTime(activeRecord?.clockInTime)}`
                : "Not clocked in"}
            </ThemedText>
          </View>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isClockedIn
                  ? theme.colors.success + "20"
                  : theme.colors.card,
                borderColor: isClockedIn
                  ? theme.colors.success + "50"
                  : theme.colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isClockedIn
                    ? theme.colors.success
                    : theme.colors.textMuted,
                },
              ]}
            />
            <ThemedText
              style={{
                fontSize: 12,
                color: isClockedIn
                  ? theme.colors.success
                  : theme.colors.textMuted,
              }}
              weight="600"
            >
              {isClockedIn ? "Active" : "Inactive"}
            </ThemedText>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.attendanceStats}>
          <View style={styles.statItem}>
            <Timer size={15} color={theme.colors.textMuted} />
            <ThemedText weight="700" style={{ fontSize: 18, marginLeft: 6 }}>
              {weekHours.toFixed(1)}h
            </ThemedText>
            <ThemedText muted variant="small" style={{ marginLeft: 4 }}>
              this week
            </ThemedText>
          </View>
          <View
            style={[
              styles.statDivider,
              { backgroundColor: theme.colors.border },
            ]}
          />
          <View style={styles.statItem}>
            <CheckCircle2 size={15} color={theme.colors.textMuted} />
            <ThemedText weight="700" style={{ fontSize: 18, marginLeft: 6 }}>
              {weekDays}
            </ThemedText>
            <ThemedText muted variant="small" style={{ marginLeft: 4 }}>
              days worked
            </ThemedText>
          </View>
        </View>

        {/* Quick clock button */}
        <Pressable
          onPress={onClockPress}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.clockButton,
            {
              backgroundColor: isClockedIn
                ? theme.colors.warning + "18"
                : theme.colors.success + "18",
              borderColor: isClockedIn
                ? theme.colors.warning + "40"
                : theme.colors.success + "40",
              opacity: pressed || isLoading ? 0.75 : 1,
            },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator
              size="small"
              color={isClockedIn ? theme.colors.warning : theme.colors.success}
            />
          ) : (
            <>
              {isClockedIn ? (
                <LogOut size={16} color={theme.colors.warning} />
              ) : (
                <LogIn size={16} color={theme.colors.success} />
              )}
              <ThemedText
                weight="600"
                style={{
                  marginLeft: 8,
                  fontSize: 14,
                  color: isClockedIn
                    ? theme.colors.warning
                    : theme.colors.success,
                }}
              >
                {isClockedIn ? "Clock Out" : "Clock In"}
              </ThemedText>
            </>
          )}
        </Pressable>
      </LinearGradient>
    </View>
  );
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const { onScroll } = useTabBar();
  const { user } = useAuth();
  const currentDate = format(new Date(), "MMM d, yyyy");

  // Get user info for attendance
  const userId = (user as any)?.sub ?? (user as any)?.username ?? "anonymous";
  const employeeName =
    (user as any)?.preferred_username ??
    (user as any)?.name ??
    (user as any)?.email?.split("@")[0] ??
    "Employee";

  // ── Attendance ─────────────────────────────────────────────────────────────
  const {
    activeRecord,
    history: attendanceHistory,
    isClockedIn,
    isLoading: clockLoading,
    clockIn,
    clockOut,
    refetchHistory,
  } = useClockIn(userId, employeeName);

  // Week stats derived from history
  const weekAgo = Date.now() - 7 * 24 * 3600000;
  const weekRecords = attendanceHistory.filter(
    (r) => new Date(r.clockInTime).getTime() > weekAgo,
  );
  const weekHours = weekRecords.reduce((s, r) => s + (r.hoursWorked ?? 0), 0);
  const weekDays = new Set(weekRecords.map((r) => r.date)).size;

  // ── Fleet & categories ─────────────────────────────────────────────────────
  const {
    data: vehicles = [],
    isLoading: vehiclesLoading,
    refetch: refetchFleets,
  } = useListFleetsQuery();
  const {
    data: categories = [],
    isLoading: categoriesLoading,
    refetch: refetchCategories,
  } = useListCategoriesQuery();
  const [getInspections] = useLazyGetInspectionsByFleetQuery();

  const [totalInspections, setTotalInspections] = useState(0);
  const [refresh, setRefresh] = useState(false);
  const [recentInspections, setRecentInspections] = useState<any[]>([]);
  const [isCalculatingInspections, setIsCalculatingInspections] =
    useState(false);

  const calculateInspectionsSummary = useCallback(
    async (vehicles: any[]) => {
      if (!vehicles.length) return;
      setIsCalculatingInspections(true);
      let sum = 0;
      const allRecent: any[] = [];

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
      const sorted = allRecent.sort(
        (a, b) =>
          new Date(b.inspectionDate || 0).getTime() -
          new Date(a.inspectionDate || 0).getTime(),
      );
      setRecentInspections(sorted.slice(0, 5));
      setIsCalculatingInspections(false);
    },
    [getInspections],
  );

  useEffect(() => {
    calculateInspectionsSummary(vehicles);
  }, [vehicles, calculateInspectionsSummary]);

  // ── Quick clock handler ────────────────────────────────────────────────────
  const handleQuickClock = useCallback(async () => {
    if (isClockedIn) await clockOut();
    else await clockIn();
  }, [isClockedIn, clockIn, clockOut]);

  const totalVehicles = vehicles.length;
  const totalCategories = categories.length;
  const isLoading =
    vehiclesLoading || categoriesLoading || isCalculatingInspections;

  const statsData = [
    {
      id: "inspections",
      title: "Total Inspections",
      value: isLoading ? "..." : String(totalInspections),
      icon: ClipboardCheck,
      trend: "all time",
      trendType: "success" as "success",
    },
    {
      id: "categories",
      title: "Stock Categories",
      value: categoriesLoading ? "..." : String(totalCategories),
      icon: Package,
      trend: "active",
      trendType: "success" as "success",
    },
    {
      id: "vehicles",
      title: "Active Vehicles",
      value: vehiclesLoading ? "..." : String(totalVehicles),
      icon: Truck,
    },
    {
      id: "lowstock",
      title: "Out of Stock",
      value: "0",
      icon: FileText,
      trend: "healthy",
      trendType: "success" as "success",
    },
  ];

  const handleRefresh = async () => {
    setRefresh(true);
    await Promise.all([refetchFleets(), refetchCategories(), refetchHistory()]);
    setRefresh(false);
  };

  const handleStockPress = () => router.push("/operations/ims");
  const handleInspectionPress = () => router.push("/operations/fms");
  const handleFormsPress = () => router.push("/forms");
  const handleSettingsPress = () => router.push("/settings");

  return (
    <Screen
      scrollable
      onScroll={onScroll}
      refreshControl={
        <RefreshControl refreshing={refresh} onRefresh={handleRefresh} />
      }
    >
      <CustomScrollView>
        {/* Header */}
        <View>
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

          {/* Welcome Section */}
          <View className="mb-2">
            <ThemedText variant="h2" weight="700">
              Hello, {employeeName.split(" ")[0]}!
            </ThemedText>
            <ThemedText muted variant="small">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </ThemedText>
          </View>

          {/* Attendance Hero Card - Main Feature */}
          <AttendanceHeroCard
            isClockedIn={isClockedIn}
            activeRecord={activeRecord}
            weekHours={weekHours}
            weekDays={weekDays}
            isLoading={clockLoading}
            onClockPress={handleQuickClock}
          />
        </View>

        {/* Stats row */}
        <View className="mb-2">
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
          contentContainerStyle={{ gap: 12 }}
          className="mb-4"
        />

        {/* Modules */}
        <View className="mb-1">
          <ThemedText variant="h2" weight="700">
            Modules
          </ThemedText>
          <ModuleCard
            title="Inventory Management"
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

        {/* Recent Inspections */}
        <View className="mt-2">
          <View className="flex-row justify-between items-center mb-3">
            <ThemedText variant="h2" weight="700">
              Recent Inspections
            </ThemedText>
            <Pressable
              onPress={() => router.push("/operations/fms")}
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
              recentInspections.map((inspection) => (
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

const styles = StyleSheet.create({
  attendanceGradient: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  attendanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  attendanceStats: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 24,
    opacity: 0.4,
  },
  clockButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
});
