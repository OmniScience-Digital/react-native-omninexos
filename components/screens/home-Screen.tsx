// components/screens/home-Screen.tsx
import { Screen, ThemedText } from "@/components/screens/screen";
import { ModuleCard, StatCard } from "@/components/ui/DashboardCards";
import { MenuButton } from "@/components/ui/MenuButton"; // SIDEMENU
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useAuth } from "@/src/contexts/auth-context";
import { formatMinutes, useOpenJobCards } from "@/src/jobcards/controller";
// Attendance system disabled — clock-in context no longer used on Home screen
// import { useClockInContext } from "@/src/contexts/clockin-context";
import { useTabBar } from "@/src/contexts/tabbar-context";
import { useTheme } from "@/src/contexts/theme-context";
import {
  useGetTotalInspectionCountQuery,
  useLazyGetInspectionsByFleetQuery,
  useListCategoriesQuery,
  useListFleetsQuery,
} from "@/src/state/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  Bell,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Package,
  PlusCircle,
  Truck,
  Wifi,
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

// ── Attendance Hero Card (DISABLED — attendance system commented out) ────────
/*
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
*/

// ── Home Hero Card: sync status + quick actions (replaces Attendance Hero) ──
const LAST_SYNCED_KEY = "sync:lastSyncedAt";

function HomeHeroCard({
  isSyncing,
  lastSyncedAt,
}: {
  isSyncing: boolean;
  lastSyncedAt: string | null;
}) {
  const { theme } = useTheme();

  const syncLabel = isSyncing
    ? "Syncing…"
    : lastSyncedAt
      ? `Synced ${format(new Date(lastSyncedAt), "HH:mm")}`
      : "Not yet synced";

  const quickActions: {
    label: string;
    icon: typeof PlusCircle;
    onPress: () => void;
  }[] = [
    {
      label: "New Inspection",
      icon: ClipboardCheck,
      onPress: () => router.push("/(tabs)/forms/vehicle-inspection"),
    },
    {
      label: "New Stock Form",
      icon: PlusCircle,
      onPress: () => router.push("/(tabs)/forms/stockcontrolform"),
    },
    {
      label: "Fleet",
      icon: Truck,
      onPress: () => router.push("/operations/fms"),
    },
    {
      label: "Inventory",
      icon: Package,
      onPress: () => router.push("/operations/ims"),
    },
  ];

  return (
    <View style={{ marginBottom: 20 }}>
      <LinearGradient
        colors={[theme.colors.accent + "18", theme.colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.attendanceGradient,
          { borderColor: theme.colors.border },
        ]}
      >
        <View style={styles.attendanceHeader}>
          <View>
            <ThemedText muted variant="small">
              Quick access
            </ThemedText>
          </View>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: theme.colors.success + "20",
                borderColor: theme.colors.success + "50",
              },
            ]}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={theme.colors.success} />
            ) : (
              <Wifi size={13} color={theme.colors.success} />
            )}
            <ThemedText
              style={{
                fontSize: 12,
                marginLeft: 5,
                color: theme.colors.success,
              }}
              weight="600"
            >
              {syncLabel}
            </ThemedText>
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Pressable
                key={action.label}
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.quickActionButton,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Icon size={16} color={theme.colors.accent} />
                <ThemedText
                  weight="600"
                  style={{ fontSize: 13, marginLeft: 6 }}
                >
                  {action.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
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
  const openJobCards = useOpenJobCards((user as any)?.sub);

  const { resetScrollY } = useTabBar();
  const employeeName =
    (user as any)?.preferred_username ??
    (user as any)?.name ??
    (user as any)?.email?.split("@")[0] ??
    "Employee";

  // ── Attendance (DISABLED — attendance system commented out) ─────────────
  // const {
  //   activeRecord,
  //   history: attendanceHistory,
  //   isClockedIn,
  //   isLoading: clockLoading,
  //   clockIn,
  //   clockOut,
  //   refetchHistory,
  // } = useClockInContext();
  //
  // const weekAgo = Date.now() - 7 * 24 * 3600000;
  // const weekRecords = attendanceHistory.filter(
  //   (r) => new Date(r.clockInTime).getTime() > weekAgo,
  // );
  // const weekHours = weekRecords.reduce((s, r) => s + (r.hoursWorked ?? 0), 0);
  // const weekDays = new Set(weekRecords.map((r) => r.date)).size;

  // ── Fleet & categories ──────────────────────────────────────────────────
  const {
    data: vehicles = [],
    isLoading: vehiclesLoading,
    isFetching: vehiclesFetching,
    isError: vehiclesFetchFailed,
    refetch: refetchFleets,
  } = useListFleetsQuery();

  const {
    data: categories = [],
    isLoading: categoriesLoading,
    refetch: refetchCategories,
  } = useListCategoriesQuery();

  const [getInspections] = useLazyGetInspectionsByFleetQuery();

  // Home stays mounted for the whole session (tabs are `lazy: false`), so the
  // refetch-on-mount policy never fires here. Refresh when the tab regains
  // focus, at most every 30s, and only when online.
  const lastFocusRefetch = useRef(Date.now());
  useFocusEffect(
    useCallback(() => {
      resetScrollY();
      if (!isOffline && Date.now() - lastFocusRefetch.current > 30_000) {
        lastFocusRefetch.current = Date.now();
        refetchFleets();
        refetchCategories();
      }
    }, [resetScrollY, isOffline, refetchFleets, refetchCategories]),
  );

  // The actual count of inspections across the whole fleet, ever — not the
  // highest per-vehicle inspection NUMBER, which is a different thing (each
  // vehicle numbers its own inspections 1, 2, 3... independently, so that
  // number says nothing about how many inspections actually exist). Offline/
  // last-known-good behaviour comes from RTK Query's own persisted cache —
  // no separate hand-rolled AsyncStorage cache needed, which also removes
  // the bug where a genuine "0 inspections now" (e.g. right after clearing
  // test data) could never overwrite a stale cached non-zero value.
  const { refetch: refetchInspectionCount } = useGetTotalInspectionCountQuery();
  const [recentInspections, setRecentInspections] = useState<any[]>([]);
  const [inspectionsCalculating, setInspectionsCalculating] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Load cached last-synced timestamp on mount
  useEffect(() => {
    AsyncStorage.getItem(LAST_SYNCED_KEY).then((v) => {
      if (v) setLastSyncedAt(v);
    });
  }, []);

  // Guard against running the loop multiple times for the same vehicle list
  const lastVehicleIds = useRef<string>("");
  const lastRecountAt = useRef(0);
  const forceRecount = useRef(false);
  const RECOUNT_MIN_INTERVAL_MS = 60_000;

  const calculateInspectionsSummary = useCallback(
    async (fleets: typeof vehicles) => {
      if (!fleets.length) {
        // Do not reset total to 0 – keep cached value
        setRecentInspections([]);
        return;
      }

      // Skip if the vehicle list hasn't changed (a settled fleet fetch clears
      // this guard when a recount is due – see the effect below).
      const ids = fleets.map((v) => v.id).join(",");
      if (ids === lastVehicleIds.current) return;
      lastVehicleIds.current = ids;
      lastRecountAt.current = Date.now();

      setInspectionsCalculating(true);
      try {
        // Run all fleet queries in parallel — this is only for the "recent
        // activity" list below; the total count comes from
        // useGetTotalInspectionCountQuery above, not from these.
        const results = await Promise.allSettled(
          fleets.map((v) =>
            // Same args as the inspection form's query => same cache entry, so
            // this also keeps each vehicle's last inspection available offline.
            getInspections({ fleetId: v.id, sortDirection: "DESC", limit: 1 })
              .unwrap()
              .catch(() => [] as any[]),
          ),
        );

        const allRecent: any[] = [];
        results.forEach((result) => {
          if (result.status === "fulfilled") {
            const latest = result.value?.[0];
            if (latest) allRecent.push(latest);
          }
        });

        setRecentInspections(
          allRecent
            .sort(
              (a, b) =>
                new Date(b.inspectionDate || 0).getTime() -
                new Date(a.inspectionDate || 0).getTime(),
            )
            .slice(0, 5),
        );
      } finally {
        setInspectionsCalculating(false);
      }
    },
    [getInspections],
  );

  // Recount inspections + stamp "last synced" whenever a fleet fetch settles.
  // RTK's structural sharing keeps `vehicles` referentially equal when nothing
  // changed, so a settled fetch (isFetching true -> false) is the only signal
  // that inspections may have changed on the web. Offline: keep cached values.
  const wasFetching = useRef(false);
  useEffect(() => {
    const justSettled = wasFetching.current && !vehiclesFetching;
    wasFetching.current = vehiclesFetching;
    if (vehiclesLoading || vehiclesFetching || isOffline) return;

    if (justSettled) {
      const due =
        forceRecount.current ||
        Date.now() - lastRecountAt.current > RECOUNT_MIN_INTERVAL_MS;
      if (due) {
        forceRecount.current = false;
        lastVehicleIds.current = ""; // let the recount run
      }
      if (!vehiclesFetchFailed) {
        const now = new Date().toISOString();
        setLastSyncedAt(now);
        AsyncStorage.setItem(LAST_SYNCED_KEY, now);
      }
    }
    calculateInspectionsSummary(vehicles);
  }, [
    vehicles,
    vehiclesLoading,
    vehiclesFetching,
    vehiclesFetchFailed,
    isOffline,
    calculateInspectionsSummary,
  ]);

  // Attendance disabled — quick clock handler no longer used
  // const handleQuickClock = useCallback(async () => {
  //   if (isClockedIn) await clockOut();
  //   else await clockIn();
  // }, [isClockedIn, clockIn, clockOut]);

  const handleRefresh = async () => {
    setRefresh(true);
    // Make the settle-effect recount inspections once the refetch lands.
    forceRecount.current = true;
    // refetchHistory() removed — attendance system disabled
    try {
      await Promise.all([
        refetchFleets(),
        refetchCategories(),
        refetchInspectionCount(),
      ]);
    } finally {
      setRefresh(false);
    }
  };

  // Show inspections spinner only while online and actually loading vehicles or calculating
  const showInspectionSpinner =
    !isOffline && (vehiclesLoading || inspectionsCalculating);

  const statsData = [
    {
      id: "openjobcards",
      title: "Open Job Cards",
      value: openJobCards.loaded ? String(openJobCards.count) : "...",
      icon: ClipboardCheck,
      trend:
        openJobCards.minutes && openJobCards.minutes > 0
          ? `${formatMinutes(openJobCards.minutes)} spent`
          : "open",
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
          {/* SIDEMENU: menu button next to the greeting */}
          <View
            className="mb-2"
            style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <MenuButton />
            <View style={{ flex: 1 }}>
              <ThemedText variant="h2" weight="700">
                Hello, {employeeName.split(" ")[0]}!
              </ThemedText>
              <ThemedText muted variant="small">
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </ThemedText>
            </View>
          </View>

          {/* AttendanceHeroCard disabled — replaced with HomeHeroCard (sync status + quick actions) */}
          <HomeHeroCard isSyncing={refresh} lastSyncedAt={lastSyncedAt} />
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
            title="Job Cards"
            description="Your assigned calibration work"
            icon={ClipboardCheck}
            onPress={() => router.push("/operations/jobcards")}
          />
          <ModuleCard
            title="Forms"
            description="All operational forms in one place"
            icon={FileText}
            onPress={() => router.push("/(tabs)/forms")}
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
  quickActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
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
