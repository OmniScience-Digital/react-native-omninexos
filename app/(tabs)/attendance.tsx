import { AttendanceHistory } from "@/components/attendance/AttendanceHistory";
import { FaceSetup } from "@/components/attendance/FaceSetup";
import { Screen, ThemedText } from "@/components/screens/screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useAuth } from "@/src/contexts/auth-context";
import { useClockInContext } from "@/src/contexts/clockin-context";
import { useReferencePhotoContext } from "@/src/contexts/reference-photo-context";
import { useTabBar } from "@/src/contexts/tabbar-context";
import { useTheme } from "@/src/contexts/theme-context";
import { format, parseISO } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Timer,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";

const IconShieldCheck = ShieldCheck as any;
const IconRotateCcwSmall = RotateCcw as any;
const IconAlertCircle = AlertCircle as any;
const IconCheckCircle2 = CheckCircle2 as any;
const IconClock = Clock as any;
const IconLogIn = LogIn as any;
const IconLogOut = LogOut as any;
const IconMapPin = MapPin as any;
const IconTimer = Timer as any;
const IconCamera = Camera as any;
const IconRefreshCw = RefreshCw as any;

// ── Elapsed timer ─────────────────────────────────────────────────────────────
function ElapsedTimer({ clockInTime }: { clockInTime: string }) {
  const { theme } = useTheme();
  const [elapsed, setElapsed] = useState("00:00:00");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = () => {
      const ms = Date.now() - new Date(clockInTime).getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setElapsed(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    };
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [clockInTime]);

  return (
    <View style={styles.timerRow}>
      <IconTimer size={14} color={theme.colors.success} />
      <ThemedText
        weight="700"
        style={[styles.timerText, { color: theme.colors.success }]}
      >
        {elapsed}
      </ThemedText>
    </View>
  );
}

// ── Active shift card ─────────────────────────────────────────────────────────
function ActiveShiftCard({
  record,
}: {
  record: NonNullable<ReturnType<typeof useClockInContext>["activeRecord"]>;
}) {
  const { theme } = useTheme();

  const safeFormat = (iso: string) => {
    try {
      return format(parseISO(iso), "HH:mm");
    } catch {
      return "--:--";
    }
  };

  return (
    <View
      style={[
        styles.shiftCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.success + "40",
          borderLeftColor: theme.colors.success,
        },
      ]}
    >
      <View style={styles.shiftCardRow}>
        <View
          style={[styles.shiftDot, { backgroundColor: theme.colors.success }]}
        />
        <ThemedText weight="700" style={{ fontSize: 15 }}>
          Shift in progress
        </ThemedText>
      </View>
      <View style={{ gap: 6, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <IconClock size={13} color={theme.colors.textMuted} />
          <ThemedText muted variant="small" style={{ marginLeft: 5 }}>
            Started {safeFormat(record.clockInTime)}
          </ThemedText>
        </View>
        {!!record.clockInAddress && (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <IconMapPin size={13} color={theme.colors.textMuted} />
            <ThemedText
              muted
              variant="small"
              numberOfLines={1}
              style={{ marginLeft: 5, flex: 1 }}
            >
              {record.clockInAddress}
            </ThemedText>
          </View>
        )}
      </View>
      <ElapsedTimer clockInTime={record.clockInTime} />
    </View>
  );
}

// ── Clock button ──────────────────────────────────────────────────────────────
function ClockButton({
  isClockedIn,
  isLoading,
  onPress,
}: {
  isClockedIn: boolean;
  isLoading: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  const gradientColors: [string, string] = isClockedIn
    ? [theme.colors.success, "#10a37a"]
    : [theme.colors.accent, theme.colors.primary];

  return (
    <Pressable
      onPress={onPress}
      disabled={isLoading}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.clockBtn}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : isClockedIn ? (
          <>
            <IconLogOut size={32} color="#fff" />
            <ThemedText
              weight="700"
              style={{ color: "#fff", fontSize: 13, letterSpacing: 0.5 }}
            >
              Clock Out
            </ThemedText>
          </>
        ) : (
          <>
            <IconLogIn size={32} color="#fff" />
            <ThemedText
              weight="700"
              style={{ color: "#fff", fontSize: 13, letterSpacing: 0.5 }}
            >
              Clock In
            </ThemedText>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

// ── Week summary pills ────────────────────────────────────────────────────────
function WeekSummary({
  history,
}: {
  history: ReturnType<typeof useClockInContext>["history"];
}) {
  const { theme } = useTheme();
  // Use start of the current ISO week (Monday 00:00 local time) so the
  // summary always reflects Mon–today rather than a rolling 168-hour window.
  const startOfWeek = (() => {
    const d = new Date();
    const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
    const diffToMonday = day === 0 ? -6 : 1 - day; // days back to Monday
    d.setDate(d.getDate() + diffToMonday);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  // Use `r.hoursWorked != null` instead of `&& r.hoursWorked` so a 0h shift
  // (e.g. clock-in/out within seconds) isn't incorrectly excluded.
  const weekRecords = history.filter(
    (r) =>
      new Date(r.clockInTime).getTime() >= startOfWeek && r.hoursWorked != null,
  );
  const totalHours = weekRecords.reduce((s, r) => s + (r.hoursWorked ?? 0), 0);
  const daysWorked = new Set(weekRecords.map((r) => r.date)).size;

  const pills = [
    { label: "This week", value: `${totalHours.toFixed(1)}h`, Icon: IconClock },
    { label: "Days worked", value: String(daysWorked), Icon: IconCheckCircle2 },
    { label: "Total shifts", value: String(history.length), Icon: IconTimer },
  ];

  return (
    <View style={styles.pillRow}>
      {pills.map((p) => (
        <View
          key={p.label}
          style={[
            styles.pill,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <p.Icon size={16} color={theme.colors.accent} />
          <ThemedText weight="700" style={{ fontSize: 20, marginTop: 6 }}>
            {p.value}
          </ThemedText>
          <ThemedText muted variant="small" style={{ textAlign: "center" }}>
            {p.label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

// ── Photo card with request-gated change ─────────────────────────────────────
function ReferencePhotoCard({
  referencePhotoUri,
  canChangePhoto,
  photoUploading,
  photoError,
  onRequestChange,
  onCaptureAndUpload,
}: {
  referencePhotoUri: string | null;
  canChangePhoto: boolean;
  photoUploading: boolean;
  photoError: string | null;
  onRequestChange: () => void;
  onCaptureAndUpload: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.photoCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <ThemedText weight="700" style={{ fontSize: 14, marginBottom: 12 }}>
        Face Verification Photo
      </ThemedText>
      <View style={styles.photoCardRow}>
        {/* Avatar */}
        <View
          style={[
            styles.photoCircle,
            {
              borderColor: referencePhotoUri
                ? theme.colors.success
                : theme.colors.border,
            },
          ]}
        >
          {referencePhotoUri ? (
            <Image
              source={{ uri: referencePhotoUri }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <IconShieldCheck size={28} color={theme.colors.accent} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <ThemedText style={{ fontSize: 13 }} weight="600">
            {referencePhotoUri ? "Photo registered" : "No photo set"}
          </ThemedText>
          <ThemedText
            muted
            variant="small"
            style={{ marginTop: 2, marginBottom: 10 }}
          >
            {referencePhotoUri
              ? canChangePhoto
                ? "Change approved — tap to update"
                : "Tap 'Request Change' to update"
              : "Required for face verification at clock-in"}
          </ThemedText>

          {/* Show action button depending on state */}
          {canChangePhoto ? (
            <Pressable
              onPress={onCaptureAndUpload}
              disabled={photoUploading}
              style={({ pressed }) => [
                {
                  flexDirection: "row" as const,
                  alignItems: "center" as const,
                  paddingVertical: 7,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: theme.colors.success + "60",
                  backgroundColor: theme.colors.success + "12",
                  opacity: pressed || photoUploading ? 0.7 : 1,
                  alignSelf: "flex-start" as const,
                },
              ]}
            >
              {photoUploading ? (
                <ActivityIndicator size="small" color={theme.colors.success} />
              ) : (
                <>
                  <IconCamera size={13} color={theme.colors.success} />
                  <ThemedText
                    style={{
                      color: theme.colors.success,
                      fontSize: 12,
                      marginLeft: 5,
                    }}
                    weight="600"
                  >
                    Take New Photo
                  </ThemedText>
                </>
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={onRequestChange}
              style={({ pressed }) => [
                {
                  flexDirection: "row" as const,
                  alignItems: "center" as const,
                  paddingVertical: 7,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: theme.colors.accent + "60",
                  backgroundColor: theme.colors.accent + "10",
                  opacity: pressed ? 0.7 : 1,
                  alignSelf: "flex-start" as const,
                },
              ]}
            >
              <IconRotateCcwSmall size={13} color={theme.colors.accent} />
              <ThemedText
                style={{
                  color: theme.colors.accent,
                  fontSize: 12,
                  marginLeft: 5,
                }}
                weight="600"
              >
                {referencePhotoUri ? "Request Change" : "Set Up Now"}
              </ThemedText>
            </Pressable>
          )}

          {photoError && (
            <ThemedText
              style={{
                color: theme.colors.warning,
                fontSize: 11,
                marginTop: 6,
              }}
            >
              {photoError}
            </ThemedText>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AttendanceScreen() {
  const { theme } = useTheme();
  const { onScroll } = useTabBar();
  const { user } = useAuth();

  // Always key on email. During Cognito auth the `user` object can briefly
  // be the raw session containing only `sub` (a UUID) before
  // fetchUserAttributes resolves. If we passed the UUID to useReferencePhoto
  // it would look up the wrong AsyncStorage key and show the setup screen
  // even though setup is complete. Falling back to "anonymous" when there's
  // no email yet lets the hook stay idle until the real identity arrives.
  const userId: string =
    typeof (user as any)?.email === "string" &&
    (user as any).email.includes("@")
      ? (user as any).email
      : "anonymous";

  const {
    activeRecord,
    history,
    isClockedIn,
    isLoading,
    step,
    stepLabel,
    error,
    clearError,
    clockIn,
    clockOut,
    loadMore,
    fetchingMore,
    hasMore,
    refetchHistory,
  } = useClockInContext();

  const {
    isSetupComplete,
    photoUri: referencePhotoUri,
    uploading: photoUploading,
    error: photoError,
    captureAndUpload,
    canChangePhoto,
    requestPhotoChange,
    pendingRequest,
  } = useReferencePhotoContext();

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  const flash = useCallback((msg: string) => {
    setSuccessMsg(msg);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccessMsg(null), 3000);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchHistory();
    setRefreshing(false);
  }, [refetchHistory]);

  const handleOrphanClockOut = useCallback(
    async (record: any) => {
      const r = await clockOut(record);
      if (r)
        flash(
          `Shift closed · ${r.hoursWorked != null && r.hoursWorked < 0.1 ? Math.round(r.hoursWorked * 60) + "min" : (r.hoursWorked?.toFixed(2) ?? "0")}h worked`,
        );
    },
    [clockOut, flash],
  );

  const handleButtonPress = useCallback(async () => {
    if (isClockedIn) {
      const r = await clockOut();
      if (r)
        flash(
          `Clocked out · ${r.hoursWorked != null && r.hoursWorked < 0.1 ? Math.round(r.hoursWorked * 60) + "min" : (r.hoursWorked?.toFixed(2) ?? "0")}h worked`,
        );
    } else {
      const r = await clockIn();
      if (r) flash("Clocked in successfully");
    }
  }, [isClockedIn, clockIn, clockOut, flash]);

  const handleRequestPhotoChange = useCallback(async () => {
    const ok = await requestPhotoChange();
    if (ok) flash("Photo change request submitted — awaiting admin approval");
  }, [requestPhotoChange, flash]);

  // If face setup is incomplete, show the setup screen (full screen)
  if (isSetupComplete === false) {
    return (
      <Screen>
        <FaceSetup
          photoUri={referencePhotoUri}
          uploading={photoUploading}
          error={photoError}
          onCapture={captureAndUpload}
          onRetake={() => {}}
        />
      </Screen>
    );
  }

  // If still loading face setup status, show ONLY a centered loader (no header)
  if (isSetupComplete === null) {
    return (
      <Screen>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </Screen>
    );
  }

  // Main UI (isSetupComplete === true)
  return (
    <Screen
      scrollable
      onScroll={onScroll}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <CustomScrollView>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <ThemedText variant="h2" weight="700">
              Attendance
            </ThemedText>
            <ThemedText muted variant="small">
              {format(new Date(), "EEEE, d MMMM yyyy")}
            </ThemedText>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isClockedIn
                  ? theme.colors.success + "18"
                  : theme.colors.card,
                borderColor: isClockedIn
                  ? theme.colors.success + "40"
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
              {isClockedIn ? "On shift" : "Off shift"}
            </ThemedText>
          </View>
        </View>

        {/* Pending photo request notice */}
        {pendingRequest && (
          <View
            style={[
              styles.banner,
              {
                backgroundColor: theme.colors.info + "14",
                borderColor: theme.colors.info + "40",
              },
            ]}
          >
            <IconRefreshCw size={14} color={theme.colors.info} />
            <ThemedText
              style={{
                color: theme.colors.info,
                marginLeft: 8,
                fontSize: 13,
                flex: 1,
              }}
            >
              Photo change request pending admin approval
            </ThemedText>
          </View>
        )}

        {/* Error banner */}
        {!!error && (
          <Pressable
            onPress={clearError}
            style={[
              styles.banner,
              {
                backgroundColor: theme.colors.warning + "18",
                borderColor: theme.colors.warning + "40",
              },
            ]}
          >
            <IconAlertCircle size={16} color={theme.colors.warning} />
            <ThemedText
              style={{
                color: theme.colors.warning,
                marginLeft: 8,
                fontSize: 13,
                flex: 1,
              }}
            >
              {error}
            </ThemedText>
          </Pressable>
        )}

        {/* Success banner */}
        {!!successMsg && (
          <View
            style={[
              styles.banner,
              {
                backgroundColor: theme.colors.success + "18",
                borderColor: theme.colors.success + "40",
              },
            ]}
          >
            <IconCheckCircle2 size={16} color={theme.colors.success} />
            <ThemedText
              style={{
                color: theme.colors.success,
                marginLeft: 8,
                fontSize: 13,
              }}
            >
              {successMsg}
            </ThemedText>
          </View>
        )}

        {/* Active shift card */}
        {!!activeRecord && <ActiveShiftCard record={activeRecord} />}

        {/* Clock button */}
        <View style={styles.clockBtnWrapper}>
          <ClockButton
            isClockedIn={isClockedIn}
            isLoading={isLoading}
            onPress={handleButtonPress}
          />
          <ThemedText
            muted
            variant="small"
            style={{ marginTop: 20, textAlign: "center" }}
          >
            {isLoading
              ? stepLabel
              : isClockedIn
                ? "Tap to clock out and end your shift"
                : "Tap to start your shift"}
          </ThemedText>
        </View>

        {/* Week summary */}
        <View style={styles.section}>
          <ThemedText variant="h2" weight="700" style={styles.sectionTitle}>
            This Week
          </ThemedText>
          <WeekSummary history={history} />
        </View>

        {/* Reference photo card */}
        <ReferencePhotoCard
          referencePhotoUri={referencePhotoUri}
          canChangePhoto={canChangePhoto}
          photoUploading={photoUploading}
          photoError={photoError}
          onRequestChange={handleRequestPhotoChange}
          onCaptureAndUpload={captureAndUpload}
        />

        {/* History */}
        <View style={styles.section}>
          <ThemedText variant="h2" weight="700" style={styles.sectionTitle}>
            Recent Shifts
          </ThemedText>
          <AttendanceHistory
            records={history}
            onClockOut={handleOrphanClockOut}
            onLoadMore={loadMore}
            fetchingMore={fetchingMore}
            hasMore={hasMore}
          />
        </View>
      </CustomScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  statusDot: { width: 7, height: 7, borderRadius: 999 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  shiftCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 16,
    marginBottom: 16,
  },
  shiftCardRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  shiftDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  timerText: { fontSize: 22, letterSpacing: 2 },
  clockBtnWrapper: { alignItems: "center", paddingVertical: 32 },
  clockBtn: {
    width: 136,
    height: 136,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  section: { marginBottom: 24 },
  sectionTitle: { marginBottom: 12 },
  pillRow: { flexDirection: "row", gap: 10 },
  pill: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  photoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  photoCardRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  photoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
