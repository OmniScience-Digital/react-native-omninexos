// app/debug/background-runs.tsx
// Shows what the OS background sync did: one card per wake, newest first. If this list stays empty after the app
// has been in the background for an hour or more, the OS is not waking the app at all.
import { NonTabScreen } from "@/components/screens/non-tab-screen";
import { ThemedText } from "@/components/screens/screen";
import { useTheme } from "@/src/contexts/theme-context";
import {
    clearBackgroundRuns,
    getBackgroundRuns,
    type BackgroundRun,
} from "@/src/sync/backgroundLog";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, Share, View } from "react-native";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString() : "—";

function describe(run: BackgroundRun): { label: string; tone: string } {
  if (run.finishedAt === null)
    return {
      label: "Started, never finished (killed mid-run)",
      tone: "warning",
    };
  switch (run.outcome) {
    case "synced":
      return { label: "Synced", tone: "success" };
    case "offline":
      return { label: "Woke up, no signal", tone: "info" };
    case "no-user":
      return { label: "Woke up, nobody signed in", tone: "info" };
    case "partial":
      return { label: "Ran, some items failed", tone: "warning" };
    case "error":
      return { label: "Error", tone: "warning" };
    default:
      return { label: run.outcome ?? "Unknown", tone: "info" };
  }
}

export default function BackgroundRunsScreen() {
  const { theme } = useTheme();
  const [runs, setRuns] = useState<BackgroundRun[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => setRuns(await getBackgroundRuns()), []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const share = () =>
    Share.share({ message: JSON.stringify(runs, null, 2) }).catch(
      () => undefined,
    );

  const clear = async () => {
    await clearBackgroundRuns();
    await load();
  };

  const toneColor = (tone: string) =>
    (theme.colors as Record<string, string>)[tone] ?? theme.colors.textMuted;

  return (
    <NonTabScreen
      title="Background sync log"
      subtitle="Last 20 times the phone woke the app to send work"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.accent}
          colors={[theme.colors.accent]}
        />
      }
    >
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <Pressable
          onPress={share}
          disabled={runs.length === 0}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card,
            alignItems: "center",
            opacity: runs.length === 0 ? 0.5 : 1,
          }}
        >
          <ThemedText weight="600">Share log</ThemedText>
        </Pressable>
        <Pressable
          onPress={clear}
          disabled={runs.length === 0}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card,
            alignItems: "center",
            opacity: runs.length === 0 ? 0.5 : 1,
          }}
        >
          <ThemedText weight="600">Clear</ThemedText>
        </Pressable>
      </View>

      {runs.length === 0 ? (
        <ThemedText muted>
          No background runs recorded yet. Leave the app in the background (not
          swiped away) for an hour or more, then pull down to refresh.
        </ThemedText>
      ) : (
        runs.map((run) => {
          const d = describe(run);
          const counts = [
            run.sent ? `${run.sent} sent` : null,
            run.failedSends ? `${run.failedSends} failed` : null,
            run.blocked ? `${run.blocked} need attention` : null,
            run.pulledItems ? `${run.pulledItems} downloaded` : null,
          ].filter(Boolean);
          return (
            <View
              key={run.id}
              style={{
                padding: 12,
                marginBottom: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.card,
                gap: 2,
              }}
            >
              <ThemedText weight="700" style={{ color: toneColor(d.tone) }}>
                {d.label}
              </ThemedText>
              <ThemedText muted variant="small">
                Started {fmt(run.startedAt)}
              </ThemedText>
              <ThemedText muted variant="small">
                Finished {fmt(run.finishedAt)}
              </ThemedText>
              {counts.length > 0 && (
                <ThemedText variant="small">{counts.join(" · ")}</ThemedText>
              )}
              {run.error ? (
                <ThemedText muted variant="small">
                  {run.error}
                </ThemedText>
              ) : null}
            </View>
          );
        })
      )}
    </NonTabScreen>
  );
}
