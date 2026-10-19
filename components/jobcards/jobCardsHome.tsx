// components/jobcards/JobCardsHome.tsx
// "My work": the calibration work assigned to the signed-in technician, grouped by job card. Everything shown here is
// on the phone, so it opens instantly and works without signal; it refreshes in the background.
import { NonTabScreen } from "@/components/screens/non-tab-screen";
import { ThemedText } from "@/components/screens/screen";
import { useTheme } from "@/src/contexts/theme-context";
import {
    requestSync,
    retryBlocked,
    useJobCardData,
} from "@/src/jobcards/controller";
import { WORK_ITEM_LABEL, type WorkItemView } from "@/src/jobcards/types";
import { ChevronRight, CloudOff, RefreshCw } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Card, Chip, SecondaryButton } from "./ui";

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

type Tab = "todo" | "done";

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
  const { loaded, items, unsent, blocked, lastPullAt, reload } =
    useJobCardData(userSub);
  const [tab, setTab] = useState<Tab>("todo");
  const [refreshing, setRefreshing] = useState(false);

  const shown = useMemo(
    () =>
      items.filter((w) =>
        tab === "todo"
          ? w.localState !== "SUBMITTED"
          : w.localState === "SUBMITTED",
      ),
    [items, tab],
  );
  const groups = useMemo(() => groupByJobCard(shown), [shown]);
  const todoCount = items.filter((w) => w.localState !== "SUBMITTED").length;

  const refresh = async () => {
    setRefreshing(true);
    await requestSync();
    await reload();
    setRefreshing(false);
  };

  return (
    <NonTabScreen
      title="Job Cards"
      subtitle="Your assigned calibration work"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      <View style={{ gap: 14 }}>
        {/* What is waiting to be sent */}
        <Card>
          {blocked > 0 ? (
            <>
              <Chip
                tone="danger"
                label={`${blocked} ${blocked === 1 ? "result needs" : "results need"} attention`}
              />
              <ThemedText muted variant="small">
                These could not be sent. They are safe on this phone. Open each
                one to see why.
              </ThemedText>
              <SecondaryButton
                title="Try again"
                onPress={() => void retryBlocked()}
                icon={<IRefresh size={16} color={theme.colors.text} />}
              />
            </>
          ) : unsent > 0 ? (
            <View style={styles.row}>
              <ICloud size={18} color={theme.colors.warning} />
              <View style={{ flex: 1 }}>
                <ThemedText weight="700">
                  {unsent} {unsent === 1 ? "result is" : "results are"} waiting
                  to send
                </ThemedText>
                <ThemedText muted variant="small">
                  Saved on this phone. They are sent automatically when there is
                  signal.
                </ThemedText>
              </View>
            </View>
          ) : (
            <View style={styles.row}>
              <Chip tone="success" label="All sent" />
              <ThemedText
                muted
                variant="small"
                style={{ flex: 1, textAlign: "right" }}
              >
                Updated {ago(lastPullAt)}
              </ThemedText>
            </View>
          )}
        </Card>

        <View style={styles.segment}>
          {(
            [
              ["todo", `To do (${todoCount})`],
              ["done", "Done"],
            ] as const
          ).map(([key, label]) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                testID={`tab-${key}`}
                style={[
                  styles.segmentItem,
                  {
                    backgroundColor: active
                      ? theme.colors.primary
                      : theme.colors.card,
                    borderColor: active
                      ? theme.colors.primary
                      : theme.colors.border,
                  },
                ]}
              >
                <ThemedText
                  weight="600"
                  style={{
                    color: active
                      ? theme.colors.primaryText
                      : theme.colors.text,
                  }}
                >
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {!loaded && <ThemedText muted>Loading...</ThemedText>}
        {loaded && groups.length === 0 && (
          <Card>
            <ThemedText weight="700">
              {tab === "todo"
                ? "Nothing to do right now"
                : "Nothing finished yet"}
            </ThemedText>
            <ThemedText muted variant="small">
              {tab === "todo"
                ? "New work appears here when the office assigns it to you. Pull down to refresh."
                : "Finished work stays here for two weeks."}
            </ThemedText>
          </Card>
        )}

        {groups.map((g) => (
          <View
            key={g.jobCardId}
            style={{ gap: 8 }}
            testID={`group-${g.jcNumber}`}
          >
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText weight="700">{g.jcNumber}</ThemedText>
                {!!g.customerName && (
                  <ThemedText muted variant="small">
                    {g.customerName}
                  </ThemedText>
                )}
              </View>
              {g.closed && <Chip tone="warning" label="Closed" />}
            </View>
            {[...g.scales.entries()].map(([scaleId, s]) => (
              <Card key={scaleId}>
                <ThemedText weight="600">{s.name}</ThemedText>
                {s.items.map((w) => (
                  <Pressable
                    key={w.id}
                    onPress={() => onOpen(w.id)}
                    accessibilityRole="button"
                    testID={`item-${w.id}`}
                    accessibilityLabel={`${WORK_ITEM_LABEL[w.moduleType]}, ${w.scaleName}`}
                    style={({ pressed }) => [
                      styles.itemRow,
                      {
                        opacity: pressed ? 0.7 : 1,
                        borderTopColor: theme.colors.border,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <ThemedText>
                        {WORK_ITEM_LABEL[w.moduleType]}
                        {w.sequence > 1 ? ` #${w.sequence}` : ""}
                      </ThemedText>
                      <Chip
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
                              ? "Saved, waiting to send"
                              : "To do"
                        }
                      />
                    </View>
                    <IChevron size={18} color={theme.colors.textMuted} />
                  </Pressable>
                ))}
              </Card>
            ))}
          </View>
        ))}
      </View>
    </NonTabScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  segment: { flexDirection: "row", gap: 8 },
  segmentItem: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
