// components/attendance/AttendanceHistory.tsx
import { ThemedText } from "@/components/screens/screen";
import { ClockRecord } from "@/hooks/useClockIn";
import { useTheme } from "@/src/contexts/theme-context";
import { format, parseISO } from "date-fns";
import {
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  Timer,
} from "lucide-react-native";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

const IconCheckCircle2 = CheckCircle2 as any;
const IconClock = Clock as any;
const IconLogIn = LogIn as any;
const IconLogOut = LogOut as any;
const IconMapPin = MapPin as any;
const IconRefreshCw = RefreshCw as any;
const IconTimer = Timer as any;

function statusMeta(status: ClockRecord["verificationStatus"], theme: any) {
  switch (status) {
    case "VERIFIED":
      return {
        label: "Verified",
        color: theme.colors.success,
        Icon: IconCheckCircle2,
      };
    case "PENDING_VERIFICATION":
      return {
        label: "Pending sync",
        color: theme.colors.warning,
        Icon: IconRefreshCw,
      };
    case "REVIEW_REQUIRED":
      return {
        label: "Review needed",
        color: theme.colors.warning,
        Icon: IconRefreshCw,
      };
  }
}

interface HistoryRowProps {
  record: ClockRecord;
  onClockOut?: (record: ClockRecord) => void;
}

function HistoryRow({ record, onClockOut }: HistoryRowProps) {
  const { theme } = useTheme();
  const { label, color, Icon } = statusMeta(record.verificationStatus, theme)!;
  const isOpen = !record.clockOutTime;

  const safeFormat = (iso?: string) => {
    if (!iso) return "—";
    try {
      return format(parseISO(iso), "HH:mm");
    } catch {
      return "—";
    }
  };

  const safeDate = (iso: string) => {
    try {
      return format(parseISO(iso), "EEE, d MMM yyyy");
    } catch {
      return iso;
    }
  };

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.card,
          borderColor: isOpen
            ? theme.colors.warning + "60"
            : theme.colors.border,
          borderLeftColor: isOpen ? theme.colors.warning : theme.colors.card,
        },
      ]}
    >
      {/* Date + status badge */}
      <View style={styles.rowTop}>
        <ThemedText weight="600" style={{ fontSize: 14 }}>
          {safeDate(record.clockInTime)}
        </ThemedText>
        <View
          style={[
            styles.badge,
            { backgroundColor: color + "18", borderColor: color + "40" },
          ]}
        >
          <Icon size={10} color={color} />
          <ThemedText
            style={{ color, fontSize: 11, marginLeft: 4 }}
            weight="600"
          >
            {label}
          </ThemedText>
        </View>
      </View>

      {/* Open shift warning */}
      {isOpen && (
        <View
          style={[
            styles.openBanner,
            { backgroundColor: theme.colors.warning + "14" },
          ]}
        >
          <ThemedText
            style={{ color: theme.colors.warning, fontSize: 12 }}
            weight="600"
          >
            Shift not closed
          </ThemedText>
        </View>
      )}

      {/* Times */}
      <View style={styles.times}>
        <View style={styles.timeBlock}>
          <View
            style={[
              styles.timeIcon,
              { backgroundColor: theme.colors.success + "18" },
            ]}
          >
            <IconLogIn size={14} color={theme.colors.success} />
          </View>
          <View>
            <ThemedText muted variant="small">
              Clock In
            </ThemedText>
            <ThemedText weight="700" style={{ fontSize: 18 }}>
              {safeFormat(record.clockInTime)}
            </ThemedText>
          </View>
        </View>

        {record.hoursWorked != null && (
          <View
            style={[
              styles.durationPill,
              {
                backgroundColor: theme.colors.accent + "14",
                borderColor: theme.colors.accent + "30",
              },
            ]}
          >
            <IconClock size={11} color={theme.colors.accent} />
            <ThemedText
              style={{
                color: theme.colors.accent,
                fontSize: 12,
                marginLeft: 4,
              }}
              weight="600"
            >
              {(record.hoursWorked ?? 0).toFixed(1)}h
            </ThemedText>
          </View>
        )}

        <View style={styles.timeBlock}>
          <View
            style={[
              styles.timeIcon,
              {
                backgroundColor: record.clockOutTime
                  ? theme.colors.warning + "18"
                  : theme.colors.border,
              },
            ]}
          >
            <IconLogOut
              size={14}
              color={
                record.clockOutTime
                  ? theme.colors.warning
                  : theme.colors.textMuted
              }
            />
          </View>
          <View>
            <ThemedText muted variant="small">
              Clock Out
            </ThemedText>
            <ThemedText weight="700" style={{ fontSize: 18 }}>
              {safeFormat(record.clockOutTime)}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Location */}
      {!!record.clockInAddress && (
        <View
          style={[styles.location, { borderTopColor: theme.colors.border }]}
        >
          <IconMapPin size={12} color={theme.colors.textMuted} />
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

      {/* Clock Out button — only on unclosed shifts */}
      {isOpen && onClockOut && (
        <Pressable
          onPress={() => onClockOut(record)}
          style={({ pressed }) => [
            styles.clockOutBtn,
            {
              backgroundColor: pressed
                ? theme.colors.warning + "30"
                : theme.colors.warning + "18",
              borderColor: theme.colors.warning + "50",
            },
          ]}
        >
          <IconLogOut size={14} color={theme.colors.warning} />
          <ThemedText
            style={{ color: theme.colors.warning, marginLeft: 6, fontSize: 13 }}
            weight="700"
          >
            Clock Out This Shift
          </ThemedText>
        </Pressable>
      )}

      {record.syncedOffline && (
        <ThemedText
          style={{ color: theme.colors.info, fontSize: 11, marginTop: 6 }}
          weight="600"
        >
          Submitted offline
        </ThemedText>
      )}
    </View>
  );
}

interface AttendanceHistoryProps {
  records: ClockRecord[];
  onClockOut?: (record: ClockRecord) => void;
  onLoadMore?: () => void;
  fetchingMore?: boolean;
  hasMore?: boolean;
}

export function AttendanceHistory({
  records,
  onClockOut,
  onLoadMore,
  fetchingMore,
  hasMore,
}: AttendanceHistoryProps) {
  const { theme } = useTheme();

  if (records.length === 0) {
    return (
      <View
        style={[
          styles.empty,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <IconTimer size={28} color={theme.colors.textMuted} />
        <ThemedText muted style={{ marginTop: 12, textAlign: "center" }}>
          No shifts yet.{"\n"}Clock in to start tracking your hours.
        </ThemedText>
      </View>
    );
  }

  return (
    <FlatList
      data={records}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => (
        <HistoryRow
          record={item}
          onClockOut={!item.clockOutTime ? onClockOut : undefined}
        />
      )}
      scrollEnabled={false}
      contentContainerStyle={{ gap: 10 }}
      onEndReached={() => {
        if (!fetchingMore && hasMore) onLoadMore?.();
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        fetchingMore ? (
          <ActivityIndicator
            size="small"
            color={theme.colors.accent}
            style={{ marginTop: 12 }}
          />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  row: { borderRadius: 16, borderWidth: 1, borderLeftWidth: 3, padding: 16 },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  openBanner: { padding: 8, borderRadius: 8, marginBottom: 10 },
  times: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  timeBlock: { flexDirection: "row", alignItems: "center", gap: 10 },
  timeIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  durationPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  location: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 0.5,
  },
  clockOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  empty: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
  },
});
