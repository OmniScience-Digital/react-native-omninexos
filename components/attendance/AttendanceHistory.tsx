// components/attendance/AttendanceHistory.tsx
import { ThemedText } from "@/components/screens/screen";
import { ClockRecord } from "@/hooks/useClockIn";
import { useTheme } from "@/src/contexts/theme-context";
import { format, parseISO } from "date-fns";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  Timer,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

const IconCheckCircle2 = CheckCircle2 as any;
const IconChevronDown = ChevronDown as any;
const IconChevronUp = ChevronUp as any;
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

function safeFormat(iso: string | undefined | null, fmt: string): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), fmt);
  } catch {
    return "—";
  }
}

function isCoordString(s?: string | null): boolean {
  return !!s && /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(s.trim());
}

function formatAddress(addr?: string | null): string {
  if (!addr) return "—";
  if (isCoordString(addr)) return "Location will show after sync";
  return addr;
}

interface HistoryRowProps {
  record: ClockRecord;
  onClockOut?: (record: ClockRecord) => void;
}

function HistoryRow({ record, onClockOut }: HistoryRowProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const { label, color, Icon } = statusMeta(record.verificationStatus, theme)!;
  const isOpen = !record.clockOutTime;

  const clockInTime = safeFormat(record.clockInTime, "HH:mm");
  const clockOutTime = safeFormat(record.clockOutTime, "HH:mm");
  const dateLabel = safeFormat(record.clockInTime, "EEE, d MMM yyyy");

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.card,
          borderColor: isOpen
            ? theme.colors.warning + "60"
            : theme.colors.border,
          borderLeftColor: isOpen ? theme.colors.warning : theme.colors.success,
        },
      ]}
    >
      {/* ── Collapsed row — always visible ── */}
      <Pressable onPress={() => setExpanded((v) => !v)} style={styles.summary}>
        {/* Date */}
        <View style={{ flex: 1 }}>
          <ThemedText weight="700" style={{ fontSize: 14 }}>
            {dateLabel}
          </ThemedText>
          {/* Clock in → clock out on one line */}
          <View style={styles.timeLine}>
            <IconLogIn size={12} color={theme.colors.success} />
            <ThemedText muted variant="small" style={{ marginLeft: 4 }}>
              {clockInTime}
            </ThemedText>
            <ThemedText muted variant="small" style={{ marginHorizontal: 6 }}>
              →
            </ThemedText>
            <IconLogOut
              size={12}
              color={isOpen ? theme.colors.textMuted : theme.colors.warning}
            />
            <ThemedText muted variant="small" style={{ marginLeft: 4 }}>
              {isOpen ? "Active" : clockOutTime}
            </ThemedText>
            {record.hoursWorked != null && !isOpen && (
              <>
                <ThemedText
                  muted
                  variant="small"
                  style={{ marginHorizontal: 6 }}
                >
                  ·
                </ThemedText>
                <IconClock size={11} color={theme.colors.textMuted} />
                <ThemedText muted variant="small" style={{ marginLeft: 3 }}>
                  {record.hoursWorked.toFixed(1)}h
                </ThemedText>
              </>
            )}
          </View>
        </View>

        {/* Right side: status badge + chevron */}
        <View style={styles.summaryRight}>
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
          {expanded ? (
            <IconChevronUp
              size={16}
              color={theme.colors.textMuted}
              style={{ marginTop: 6 }}
            />
          ) : (
            <IconChevronDown
              size={16}
              color={theme.colors.textMuted}
              style={{ marginTop: 6 }}
            />
          )}
        </View>
      </Pressable>

      {/* ── Expanded detail ── */}
      {expanded && (
        <View style={[styles.detail, { borderTopColor: theme.colors.border }]}>
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

          {/* Clock In row */}
          <View style={styles.detailRow}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: theme.colors.success + "18" },
              ]}
            >
              <IconLogIn size={14} color={theme.colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText muted variant="small">
                Clock In
              </ThemedText>
              <ThemedText weight="700" style={{ fontSize: 17 }}>
                {clockInTime}
              </ThemedText>
              <View style={styles.addrRow}>
                <IconMapPin size={11} color={theme.colors.textMuted} />
                <ThemedText
                  muted
                  variant="small"
                  numberOfLines={2}
                  style={{ marginLeft: 4, flex: 1 }}
                >
                  {formatAddress(record.clockInAddress)}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Clock Out row */}
          <View style={[styles.detailRow, { marginTop: 12 }]}>
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: isOpen
                    ? theme.colors.border
                    : theme.colors.warning + "18",
                },
              ]}
            >
              <IconLogOut
                size={14}
                color={isOpen ? theme.colors.textMuted : theme.colors.warning}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText muted variant="small">
                Clock Out
              </ThemedText>
              <ThemedText weight="700" style={{ fontSize: 17 }}>
                {isOpen ? "—" : clockOutTime}
              </ThemedText>
              {!isOpen && (
                <View style={styles.addrRow}>
                  <IconMapPin size={11} color={theme.colors.textMuted} />
                  <ThemedText
                    muted
                    variant="small"
                    numberOfLines={2}
                    style={{ marginLeft: 4, flex: 1 }}
                  >
                    {formatAddress(record.clockOutAddress)}
                  </ThemedText>
                </View>
              )}
            </View>
          </View>

          {/* Shift duration */}
          {record.hoursWorked != null && !isOpen && (
            <View
              style={[
                styles.durationRow,
                {
                  backgroundColor: theme.colors.accent + "12",
                  borderColor: theme.colors.accent + "30",
                },
              ]}
            >
              <IconClock size={13} color={theme.colors.accent} />
              <ThemedText
                style={{
                  color: theme.colors.accent,
                  marginLeft: 6,
                  fontSize: 13,
                }}
                weight="600"
              >
                Shift duration: {record.hoursWorked.toFixed(1)}h
              </ThemedText>
            </View>
          )}

          {/* Offline badge */}
          {record.syncedOffline && (
            <ThemedText
              style={{ color: theme.colors.info, fontSize: 11, marginTop: 8 }}
              weight="600"
            >
              Submitted offline
            </ThemedText>
          )}

          {/* Clock Out button for open shifts */}
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
                style={{
                  color: theme.colors.warning,
                  marginLeft: 6,
                  fontSize: 13,
                }}
                weight="700"
              >
                Clock Out This Shift
              </ThemedText>
            </Pressable>
          )}
        </View>
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
  row: { borderRadius: 16, borderWidth: 1, borderLeftWidth: 3 },
  summary: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
  },
  timeLine: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    flexWrap: "wrap",
  },
  summaryRight: { alignItems: "flex-end", marginLeft: 8 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  detail: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 0.5,
    paddingTop: 12,
  },
  openBanner: { padding: 8, borderRadius: 8, marginBottom: 12 },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  addrRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 3 },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  clockOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
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
