// components/jobcards/JobCardsHome.tsx
// "My work": the calibration work assigned to the signed-in technician, grouped by job card. Everything shown here is
// on the phone, so it opens instantly and works without signal; it refreshes in the background.
import { NonTabScreen } from "@/components/screens/non-tab-screen";
import { ThemedText } from "@/components/screens/screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useTheme } from "@/src/contexts/theme-context";
import {
    requestSync,
    retryBlocked,
    useJobCardData,
} from "@/src/jobcards/controller";
import { WORK_ITEM_LABEL, type WorkItemView } from "@/src/jobcards/types";
import { ChevronRight, CloudOff, RefreshCw } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
    Pressable,
    RefreshControl,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { MED } from "./ui";

const IChevron = ChevronRight as React.ComponentType<{
  size?: number;
  color?: string;
}>;
const ICloud = CloudOff as React.ComponentType<{
  size?: number;
  color?: string;
}>;
const IRefresh = RefreshCw as React.ComponentType<{
  size?: number;
  color?: string;
}>;

type Tab = "open" | "done";

const ago = (iso: string | null): string => {
  if (!iso) return "never";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

export function groupByJobCard(items: WorkItemView[]) {
  const groups = new Map<
    string,
    {
      jobCardId: string;
      jcNumber: string;
      customerName?: string | null;
      closed: boolean;
      scales: Map<string, { name: string; items: WorkItemView[] }>;
    }
  >();
  for (const w of items) {
    let g = groups.get(w.jobCardId);
    if (!g) {
      g = {
        jobCardId: w.jobCardId,
        jcNumber: w.jcNumber,
        customerName: w.customerName,
        closed: w.jobCardStatus === "CLOSED",
        scales: new Map(),
      };
      groups.set(w.jobCardId, g);
    }
    let s = g.scales.get(w.scaleId);
    if (!s) {
      s = { name: w.scaleName, items: [] };
      g.scales.set(w.scaleId, s);
    }
    s.items.push(w);
  }
  return [...groups.values()];
}

export default function JobCardsHome({
  userSub,
  onOpen,
}: {
  userSub: string | undefined;
  onOpen: (workItemId: string) => void;
}) {
  const { theme } = useTheme();
  const colors = theme.colors;
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { loaded, items, unsent, blocked, lastPullAt, reload } =
    useJobCardData(userSub);
  const [tab, setTab] = useState<Tab>("open");
  const [refreshing, setRefreshing] = useState(false);

  const shown = useMemo(
    () =>
      items.filter((w) =>
        tab === "open"
          ? w.localState !== "SUBMITTED"
          : w.localState === "SUBMITTED",
      ),
    [items, tab],
  );
  const groups = useMemo(() => groupByJobCard(shown), [shown]);
  const openCount = items.filter((w) => w.localState !== "SUBMITTED").length;

  const refresh = async () => {
    setRefreshing(true);
    await requestSync();
    await reload();
    setRefreshing(false);
  };

  const toneColor = (t: "success" | "warning" | "info" | "danger") =>
    t === "success"
      ? colors.success
      : t === "warning"
        ? colors.warning
        : t === "danger"
          ? "#DC2626"
          : colors.info;
  const Badge = ({
    label,
    tone,
  }: {
    label: string;
    tone: "success" | "warning" | "info" | "danger";
  }) => (
    <View style={[styles.badge, { backgroundColor: toneColor(tone) + "1F" }]}>
      <ThemedText style={[MED, styles.badgeText, { color: toneColor(tone) }]}>
        {label}
      </ThemedText>
    </View>
  );

  return (
    <NonTabScreen
      title="Job Cards"
      subtitle="Your assigned work"
      showBack
      scrollable={false}
    >
      <CustomScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Segmented switch (a different shape to Fleet's filled tabs, same family) */}
        <View style={styles.segment}>
          {(
            [
              ["open", `Open · ${openCount}`],
              ["done", "Done"],
            ] as const
          ).map(([key, label]) => {
            const active = tab === key;
            return (
              <TouchableOpacity
                key={key}
                testID={`tab-${key}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                activeOpacity={0.8}
                style={[styles.segmentItem, active && styles.segmentActive]}
                onPress={() => setTab(key)}
              >
                <ThemedText
                  style={[
                    active && MED,
                    {
                      fontSize: 13,
                      color: active ? colors.text : colors.textMuted,
                    },
                  ]}
                >
                  {label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sync status: one quiet line, not a card */}
        <View style={styles.status}>
          {blocked > 0 ? (
            <>
              <Badge tone="danger" label={`${blocked} need attention`} />
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={() => void retryBlocked()}
                style={styles.retry}
                hitSlop={8}
              >
                <IRefresh size={14} color={colors.primary} />
                <ThemedText
                  style={[MED, { fontSize: 12, color: colors.primary }]}
                >
                  Try again
                </ThemedText>
              </Pressable>
            </>
          ) : unsent > 0 ? (
            <>
              <ICloud size={14} color={colors.warning} />
              <ThemedText muted style={styles.sub}>
                {unsent} {unsent === 1 ? "result" : "results"} waiting to send
              </ThemedText>
            </>
          ) : (
            <>
              <View style={[styles.dot, { backgroundColor: colors.success }]} />
              <ThemedText muted style={styles.sub}>
                All sent · updated {ago(lastPullAt)}
              </ThemedText>
            </>
          )}
        </View>

        {!loaded && groups.length === 0 && (
          <ThemedText muted style={styles.sub}>
            Loading...
          </ThemedText>
        )}
        {loaded && groups.length === 0 && (
          <View style={[styles.card, { padding: 28, alignItems: "center" }]}>
            <ThemedText style={[MED, { fontSize: 15 }]}>
              {tab === "open" ? "No open job cards" : "Nothing finished yet"}
            </ThemedText>
            <ThemedText
              muted
              style={[
                styles.sub,
                { textAlign: "center", marginTop: 6, lineHeight: 18 },
              ]}
            >
              {tab === "open"
                ? "New work appears here when it is assigned to you. Pull down to refresh."
                : "Finished work stays here for two weeks."}
            </ThemedText>
          </View>
        )}

        {groups.map((g) => (
          <View
            key={g.jobCardId}
            style={styles.card}
            testID={`group-${g.jcNumber}`}
          >
            <View style={styles.groupHead}>
              <View style={{ flex: 1 }}>
                <ThemedText style={[MED, { fontSize: 15 }]}>
                  {g.jcNumber}
                </ThemedText>
                {!!g.customerName && (
                  <ThemedText muted style={styles.sub}>
                    {g.customerName}
                  </ThemedText>
                )}
              </View>
              {g.closed && <Badge tone="warning" label="Closed" />}
            </View>
            {[...g.scales.entries()].map(([scaleId, sc]) => (
              <View key={scaleId}>
                <ThemedText muted style={styles.scaleName}>
                  {sc.name}
                </ThemedText>
                {sc.items.map((w) => (
                  <Pressable
                    key={w.id}
                    onPress={() => onOpen(w.id)}
                    accessibilityRole="button"
                    testID={`item-${w.id}`}
                    accessibilityLabel={`${WORK_ITEM_LABEL[w.moduleType]}, ${w.scaleName}`}
                    style={({ pressed }) => [
                      styles.itemRow,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <ThemedText style={{ flex: 1, fontSize: 14 }}>
                      {WORK_ITEM_LABEL[w.moduleType]}
                      {w.sequence > 1 ? ` #${w.sequence}` : ""}
                    </ThemedText>
                    <Badge
                      tone={
                        w.localState === "SUBMITTED"
                          ? "success"
                          : w.localState === "QUEUED"
                            ? "warning"
                            : "info"
                      }
                      label={
                        w.localState === "SUBMITTED"
                          ? "Sent"
                          : w.localState === "QUEUED"
                            ? "Waiting to send"
                            : "Open"
                      }
                    />
                    <IChevron size={16} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        ))}
      </CustomScrollView>
    </NonTabScreen>
  );
}

// Same family as the Fleet screens (16px cards, 12-15px text) but lighter: regular text, semibold only for names
const getStyles = (colors: any) =>
  StyleSheet.create({
    content: { padding: 16, flex: 1 },
    segment: {
      flexDirection: "row",
      backgroundColor: colors.border + "66",
      borderRadius: 12,
      padding: 3,
      marginBottom: 12,
    },
    segmentItem: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 9,
      alignItems: "center",
    },
    segmentActive: { backgroundColor: colors.card },
    status: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 12,
      paddingHorizontal: 2,
      minHeight: 22,
    },
    dot: { width: 7, height: 7, borderRadius: 4 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      overflow: "hidden",
    },
    groupHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 14,
      paddingBottom: 4,
    },
    sub: { fontSize: 12, color: colors.textMuted },
    scaleName: {
      fontSize: 12,
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 2,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 99,
      alignSelf: "flex-start",
    },
    badgeText: { fontSize: 11 },
    retry: { flexDirection: "row", alignItems: "center", gap: 4 },
  });
