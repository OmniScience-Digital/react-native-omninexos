// components/screens/home-Screen.tsx
import { Screen, ThemedText } from "@/components/screens/screen";
import { ModuleCard, StatCard } from "@/components/ui/DashboardCards";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useAuth } from "@/src/contexts/auth-context";
import { useClockInContext } from "@/src/contexts/clockin-context";
import { useTabBar } from "@/src/contexts/tabbar-context";
import { useTheme } from "@/src/contexts/theme-context";
import {
  useLazyGetInspectionsByFleetQuery,
  useListCategoriesQuery,
  useListFleetsQuery,
} from "@/src/state/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  Timer,
  Truck,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";

// ── Attendance Hero Card ──────────────────────────────────────────────────────
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

// ── Main screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { theme } = useTheme();
  const { onScroll } = useTabBar();
  const { user } = useAuth();
  const { isOffline } = useNetworkStatus();

  const userId = (user as any)?.sub ?? (user as any)?.username ?? "anonymous";
  const employeeName =
    (user as any)?.preferred_username ??
    (user as any)?.name ??
    (user as any)?.email?.split("@")[0] ??
    "Employee";

  // ── Attendance ──────────────────────────────────────────────────────────
  const {
    activeRecord,
    history: attendanceHistory,
    isClockedIn,
    isLoading: clockLoading,
    clockIn,
    clockOut,
    refetchHistory,
  } = useClockInContext();

  const weekAgo = Date.now() - 7 * 24 * 3600000;
  const weekRecords = attendanceHistory.filter(
    (r) => new Date(r.clockInTime).getTime() > weekAgo,
  );
  const weekHours = weekRecords.reduce((s, r) => s + (r.hoursWorked ?? 0), 0);
  const weekDays = new Set(weekRecords.map((r) => r.date)).size;

  // ── Fleet & categories ──────────────────────────────────────────────────
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

  const INSPECTION_TOTAL_KEY = "inspections:total";
  const [totalInspections, setTotalInspections] = useState(0);
  const [recentInspections, setRecentInspections] = useState<any[]>([]);
  const [inspectionsCalculating, setInspectionsCalculating] = useState(false);
  const [refresh, setRefresh] = useState(false);

  // Load cached total on mount so it shows instantly offline
  useEffect(() => {
    AsyncStorage.getItem(INSPECTION_TOTAL_KEY).then((v) => {
      if (v) setTotalInspections(Number(v));
    });
  }, []);

  // Guard against running the loop multiple times for the same vehicle list
  const lastVehicleIds = useRef<string>("");

  const calculateInspectionsSummary = useCallback(
    async (fleets: typeof vehicles) => {
      if (!fleets.length) {
        // Do not reset total to 0 – keep cached value
        setRecentInspections([]);
        return;
      }

      // Skip if vehicles haven't changed and we're not forcing a refresh
      const ids = fleets.map((v) => v.id).join(",");
      if (ids === lastVehicleIds.current && !refresh) return;
      lastVehicleIds.current = ids;

      setInspectionsCalculating(true);
      try {
        // Run all fleet queries in parallel
        const results = await Promise.allSettled(
          fleets.map((v) =>
            getInspections({ fleetId: v.id, limit: 1 })
              .unwrap()
              .catch(() => [] as any[]),
          ),
        );

        let maxInspectionNo = 0;
        const allRecent: any[] = [];

        results.forEach((result) => {
          if (result.status === "fulfilled") {
            const latest = result.value?.[0];
            if (latest) {
              if ((latest.inspectionNo ?? 0) > maxInspectionNo) {
                maxInspectionNo = latest.inspectionNo ?? 0;
              }
              allRecent.push(latest);
            }
          }
        });

        //  Only update if we got a valid number (online with data)
        if (maxInspectionNo > 0) {
          setTotalInspections(maxInspectionNo);
          await AsyncStorage.setItem(
            INSPECTION_TOTAL_KEY,
            String(maxInspectionNo),
          );
        } else {
          // Offline or no data returned – preserve existing cached value
          const cached = await AsyncStorage.getItem(INSPECTION_TOTAL_KEY);
          if (cached) {
            setTotalInspections(Number(cached));
          }
          // If no cached value, totalInspections remains whatever it was (0 or previous)
        }

        setRecentInspections(
          allRecent
            .sort(
              (a, b) =>
                new Date(b.inspectionDate || 0).getTime() -
                new Date(a.inspectionDate || 0).getTime(),
            )
            .slice(0, 5),
        );
      } catch (error) {
        // On any error, keep existing cached total
        const cached = await AsyncStorage.getItem(INSPECTION_TOTAL_KEY);
        if (cached) {
          setTotalInspections(Number(cached));
        }
      } finally {
        setInspectionsCalculating(false);
      }
    },
    [getInspections, refresh],
  );

  // When offline, skip the calculation entirely – just show cached value
  useEffect(() => {
    if (!vehiclesLoading && !isOffline) {
      calculateInspectionsSummary(vehicles);
    }
  }, [vehicles, vehiclesLoading, calculateInspectionsSummary, isOffline]);

  // When RTK invalidates the Inspection tag (e.g. after sync), vehicles may
  // reload with the same IDs but we need to re-query inspections with fresh data.
  const prevVehiclesLoading = useRef(false);
  useEffect(() => {
    if (prevVehiclesLoading.current && !vehiclesLoading) {
      // A refetch just finished – clear guard so inspection query re-runs
      lastVehicleIds.current = "";
    }
    prevVehiclesLoading.current = vehiclesLoading;
  }, [vehiclesLoading]);

  const handleQuickClock = useCallback(async () => {
    if (isClockedIn) await clockOut();
    else await clockIn();
  }, [isClockedIn, clockIn, clockOut]);

  const handleRefresh = async () => {
    setRefresh(true);
    // Clear the vehicle ID guard so calculateInspectionsSummary re-runs
    lastVehicleIds.current = "";
    await Promise.all([refetchFleets(), refetchCategories(), refetchHistory()]);
    setRefresh(false);
  };

  // Show inspections spinner only while online and actually loading vehicles or calculating
  const showInspectionSpinner =
    !isOffline && (vehiclesLoading || inspectionsCalculating);

  const statsData = [
    {
      id: "inspections",
      title: "Total Inspections",
      value: showInspectionSpinner ? "..." : String(totalInspections),
      icon: ClipboardCheck,
      trend: "all time",
      trendType: "success" as const,
    },
    {
      id: "categories",
      title: "Stock Categories",
      value:
        !isOffline && categoriesLoading ? "..." : String(categories.length),
      icon: Package,
      trend: "active",
      trendType: "success" as const,
    },
    {
      id: "vehicles",
      title: "Active Vehicles",
      value: !isOffline && vehiclesLoading ? "..." : String(vehicles.length),
      icon: Truck,
    },
    {
      id: "lowstock",
      title: "Out of Stock",
      value: "0",
      icon: FileText,
      trend: "healthy",
      trendType: "success" as const,
    },
  ];

  return (
    <Screen
      scrollable
      onScroll={onScroll}
      refreshControl={
        <RefreshControl refreshing={refresh} onRefresh={handleRefresh} />
      }
    >
      <CustomScrollView>
        {/* Offline banner — only shows when actually offline */}
        <OfflineBanner />

        {/* Header */}
        <View>
          <View className="mb-2">
            <ThemedText variant="h2" weight="700">
              Hello, {employeeName.split(" ")[0]}!
            </ThemedText>
            <ThemedText muted variant="small">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </ThemedText>
          </View>

          <AttendanceHeroCard
            isClockedIn={isClockedIn}
            activeRecord={activeRecord}
            weekHours={weekHours}
            weekDays={weekDays}
            isLoading={clockLoading}
            onClockPress={handleQuickClock}
          />
        </View>

        {/* Stats */}
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
            onPress={() => router.push("/operations/ims")}
          />
          <ModuleCard
            title="Fleet Management"
            description="Vehicle inspections & management"
            icon={ClipboardList}
            onPress={() => router.push("/operations/fms")}
          />
          <ModuleCard
            title="Forms"
            description="All operational forms in one place"
            icon={FileText}
            onPress={() => router.push("/forms")}
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
            {showInspectionSpinner ? (
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
                  {isOffline
                    ? "Connect to the internet to load inspections."
                    : "Complete an inspection to see activity here."}
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
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  attendanceStats: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 16,
  },
  statItem: { flexDirection: "row", alignItems: "center" },
  statDivider: { width: 1, height: 24, opacity: 0.4 },
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
