// components/jobcards/JobCardsHome.tsx
// Job cards for the signed-in technician. Three levels, all read from the phone so they open instantly offline:
//   list  ->  job card page (details, notes)  ->  scales and work (where work is opened and scales are added)
import { NonTabScreen } from "@/components/screens/non-tab-screen";
import { ThemedText } from "@/components/screens/screen";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useTheme } from "@/src/contexts/theme-context";
import {
    noteWorkStarted,
    requestSync,
    retryBlocked,
    useJobCardData,
    useJobCardSyncing,
} from "@/src/jobcards/controller";
import { WORK_ITEM_LABEL, type WorkItemView } from "@/src/jobcards/types";
import { useNetInfo } from "@react-native-community/netinfo";
import {
    Building2,
    CalendarDays,
    Check,
    ChevronRight,
    ClipboardList,
    CloudOff,
    ExternalLink,
    Layers,
    Package,
    Plus,
    RefreshCw,
    Search,
    SlidersHorizontal,
    StickyNote,
    Timer,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    RefreshControl,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import AddScaleSheet from "./AddScaleSheet";
import { MED } from "./ui";

type IconType = React.ComponentType<{ size?: number; color?: string }>;
const asIcon = (c: unknown) => c as IconType;
const IChevron = asIcon(ChevronRight);
const ICloud = asIcon(CloudOff);
const IRefresh = asIcon(RefreshCw);
const ISearch = asIcon(Search);
const ISliders = asIcon(SlidersHorizontal);
const ICalendar = asIcon(CalendarDays);
const ILayers = asIcon(Layers);
const IBuilding = asIcon(Building2);
const IPackage = asIcon(Package);
const INote = asIcon(StickyNote);
const IClipboard = asIcon(ClipboardList);
const IExternal = asIcon(ExternalLink);
const IPlus = asIcon(Plus);
const ICheck = asIcon(Check);
const ITimer = asIcon(Timer);

// Tuning knob for the white gap under the header (all three pages).
// Too tight against the header line -> lower it (try 20). Gap still there -> raise it (try 36).
const PULL_UP = 28;

type Tab = "open" | "done";
type Sort = "newest" | "oldest" | "number";
const SORT_LABEL: Record<Sort, string> = {
  newest: "Newest assigned first",
  oldest: "Oldest assigned first",
  number: "Job card number",
};

const ago = (iso: string | null): string => {
  if (!iso) return "never";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const dayStart = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const assignedLabel = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.round((dayStart(new Date()) - dayStart(d)) / 86_400_000);
  if (days <= 0) return "Assigned today";
  if (days === 1) return "Assigned yesterday";
  return `Assigned ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

// Theme-shape-agnostic dark detection: prefer explicit flags, fall back to background luminance.
const isDarkHex = (hex?: string | null): boolean => {
  if (!hex) return false;
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return false;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
};

export function groupByJobCard(items: WorkItemView[]) {
  const groups = new Map<
    string,
    {
      jobCardId: string;
      jcNumber: string;
      customerName?: string | null;
      title?: string | null;
      closed: boolean;
      assignedAt: string | null;
      lastSubmittedAt: string | null;
      scales: Map<
        string,
        { name: string; scopeOfWork?: string | null; items: WorkItemView[] }
      >;
    }
  >();
  for (const w of items) {
    let g = groups.get(w.jobCardId);
    if (!g) {
      g = {
        jobCardId: w.jobCardId,
        jcNumber: w.jcNumber,
        customerName: w.customerName,
        title: w.jcTitle,
        closed: w.jobCardStatus === "CLOSED",
        assignedAt: w.assignedAt ?? null,
        lastSubmittedAt: null,
        scales: new Map(),
      };
      groups.set(w.jobCardId, g);
    }
    if (w.assignedAt && (!g.assignedAt || w.assignedAt < g.assignedAt))
      g.assignedAt = w.assignedAt;
    if (
      w.submittedAt &&
      (!g.lastSubmittedAt || w.submittedAt > g.lastSubmittedAt)
    )
      g.lastSubmittedAt = w.submittedAt;
    let s = g.scales.get(w.scaleId);
    if (!s) {
      s = { name: w.scaleName, scopeOfWork: w.scopeOfWork, items: [] };
      g.scales.set(w.scaleId, s);
    }
    s.items.push(w);
  }
  return [...groups.values()];
}

export default function JobCardsHome({
  userSub,
  onOpen,
  jobCardId,
  onSelectJobCard,
  onBackToList,
  showWork,
  onShowWork,
  onHideWork,
}: {
  userSub: string | undefined;
  onOpen: (workItemId: string) => void;
  jobCardId: string | null;
  onSelectJobCard: (jobCardId: string) => void;
  onBackToList: () => void;
  showWork: boolean;
  onShowWork: () => void;
  onHideWork: () => void;
}) {
  const { theme } = useTheme();
  const colors = theme.colors;

  const scheme = (theme as any).scheme ?? (theme as any).mode ?? undefined;
  const isDark: boolean =
    typeof (theme as any).dark === "boolean"
      ? (theme as any).dark
      : typeof (theme as any).isDark === "boolean"
        ? (theme as any).isDark
        : scheme === "dark"
          ? true
          : scheme === "light"
            ? false
            : isDarkHex(colors.background);

  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  // The scroll view is pulled up under the header to remove the gap.
  // The offline banner must not be pulled up with it, so it gets the space back while offline.
  const net = useNetInfo();
  const offline =
    net.isConnected === false || net.isInternetReachable === false;

  const {
    loaded,
    items: allItems,
    unsent,
    blocked,
    lastPullAt,
    reload,
  } = useJobCardData(userSub);
  // Closed job cards are no longer the technician's concern: they leave the app (the results stay with the office)
  const items = useMemo(
    () => allItems.filter((w) => w.jobCardStatus !== "CLOSED"),
    [allItems],
  );
  const syncing = useJobCardSyncing();
  const [tab, setTab] = useState<Tab>("open");
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const shown = useMemo(
    () =>
      items.filter((w) =>
        tab === "open"
          ? w.localState === "PENDING"
          : w.localState !== "PENDING",
      ),
    [items, tab],
  );
  const groups = useMemo(() => groupByJobCard(shown), [shown]);

  const listGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const found = q
      ? groups.filter(
          (g) =>
            g.jcNumber.toLowerCase().includes(q) ||
            (g.customerName ?? "").toLowerCase().includes(q),
        )
      : groups;
    const byDate = (a: string | null, b: string | null) =>
      (a ?? "").localeCompare(b ?? "");
    // In Done, "newest" means most recently finished (or edited), so edited work comes back to the top
    const when = (g: (typeof groups)[number]) =>
      tab === "done" ? g.lastSubmittedAt : g.assignedAt;
    return [...found].sort((a, b) =>
      sort === "number"
        ? a.jcNumber.localeCompare(b.jcNumber)
        : sort === "oldest"
          ? byDate(when(a), when(b))
          : byDate(when(b), when(a)),
    );
  }, [groups, query, sort, tab]);

  const detailGroup = jobCardId
    ? groups.find((g) => g.jobCardId === jobCardId)
    : undefined;
  const detailInfo = jobCardId
    ? items.find((w) => w.jobCardId === jobCardId)
    : undefined;
  const detailClosed = detailInfo?.jobCardStatus === "CLOSED";
  const detailScales = detailGroup ? detailGroup.scales.size : 0;
  const detailItems = detailGroup
    ? [...detailGroup.scales.values()].reduce((n, s) => n + s.items.length, 0)
    : 0;
  const empty = jobCardId ? !detailGroup : listGroups.length === 0;
  const openCount = items.filter((w) => w.localState === "PENDING").length;

  const refresh = async () => {
    setRefreshing(true);
    await requestSync();
    await reload();
    setRefreshing(false);
  };

  // Danger red #DC2626 disappears against a dark card, so lift it in dark mode.
  const dangerColor = isDark ? "#F87171" : "#DC2626";
  const toneColor = (t: "success" | "warning" | "info" | "danger") =>
    t === "success"
      ? colors.success
      : t === "warning"
        ? colors.warning
        : t === "danger"
          ? dangerColor
          : colors.info;
  // Bump tint opacity in dark so badges stay legible on a dark surface.
  const tintAlpha = isDark ? "2E" : "1F";

  const Badge = ({
    label,
    tone,
    dot,
  }: {
    label: string;
    tone: "success" | "warning" | "info" | "danger";
    dot?: boolean;
  }) => (
    <View
      style={[
        styles.badge,
        dot && styles.badgeWithDot,
        { backgroundColor: toneColor(tone) + tintAlpha },
      ]}
    >
      {dot && (
        <View style={[styles.badgeDot, { backgroundColor: toneColor(tone) }]} />
      )}
      <ThemedText style={[MED, styles.badgeText, { color: toneColor(tone) }]}>
        {label}
      </ThemedText>
    </View>
  );

  const statusBadge = (closed: boolean) =>
    closed ? (
      <Badge tone="warning" label="Closed" />
    ) : tab === "open" ? (
      <Badge tone="info" label="Open" />
    ) : (
      <Badge tone="success" label="Done" />
    );

  const level: "list" | "summary" | "work" = !jobCardId
    ? "list"
    : showWork
      ? "work"
      : "summary";
  const title =
    level === "list"
      ? "Job Cards"
      : level === "summary"
        ? "Job Card"
        : (detailInfo?.jcNumber ?? "Job card");
  const subtitle =
    level === "list"
      ? "Your assigned work"
      : level === "work"
        ? "Scales and work"
        : undefined;

  const assigned = assignedLabel(detailGroup?.assignedAt);

  return (
    <NonTabScreen
      title={title}
      subtitle={subtitle}
      showBack
      onBack={
        level === "work"
          ? onHideWork
          : level === "summary"
            ? onBackToList
            : undefined
      }
      scrollable={false}
    >
      <CustomScrollView
        style={[
          styles.content,
          {
            marginHorizontal: -theme.spacing.sm,
            marginTop: -PULL_UP,
          },
        ]}
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: level === "work" && !detailClosed ? 96 : 4,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={offline ? { marginTop: PULL_UP } : undefined}>
          <OfflineBanner />
        </View>

        {level === "list" && (
          <>
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
                    activeOpacity={0.85}
                    style={[styles.segmentItem, active && styles.segmentActive]}
                    onPress={() => setTab(key)}
                  >
                    <ThemedText
                      style={[
                        MED,
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

            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <ISearch size={16} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search job cards..."
                  placeholderTextColor={colors.textMuted}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  accessibilityLabel="Search job cards"
                  testID="jc-search"
                  style={styles.searchInput}
                />
              </View>
              <Pressable
                onPress={() => setSortOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Sort job cards"
                testID="jc-sort"
                style={({ pressed }) => [
                  styles.filterBtn,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <ISliders size={16} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.status}>
              {syncing ? (
                <>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <ThemedText muted style={styles.sub}>
                    Syncing...
                  </ThemedText>
                </>
              ) : blocked > 0 ? (
                <>
                  <Badge tone="danger" label={`${blocked} need attention`} />
                  <View style={{ flex: 1 }} />
                  <Pressable
                    onPress={() => void retryBlocked()}
                    style={styles.retry}
                    hitSlop={8}
                  >
                    <IRefresh size={13} color={colors.primary} />
                    <ThemedText
                      style={[MED, { fontSize: 12, color: colors.primary }]}
                    >
                      Try again
                    </ThemedText>
                  </Pressable>
                </>
              ) : unsent > 0 ? (
                <>
                  <ICloud size={13} color={colors.warning} />
                  <ThemedText muted style={styles.sub}>
                    {unsent} {unsent === 1 ? "result" : "results"} waiting to
                    send
                  </ThemedText>
                </>
              ) : (
                <>
                  <View
                    style={[styles.dot, { backgroundColor: colors.success }]}
                  />
                  <ThemedText muted style={styles.sub}>
                    All sent · updated {ago(lastPullAt)}
                  </ThemedText>
                </>
              )}
            </View>
          </>
        )}

        {!loaded && empty && (
          <ThemedText muted style={[styles.sub, { paddingHorizontal: 4 }]}>
            Loading...
          </ThemedText>
        )}
        {loaded && empty && (
          <View style={[styles.card, { padding: 24, alignItems: "center" }]}>
            <ThemedText style={[MED, { fontSize: 14 }]}>
              {jobCardId
                ? "Nothing here"
                : query.trim()
                  ? "No job cards match"
                  : tab === "open"
                    ? "No open job cards"
                    : "Nothing finished yet"}
            </ThemedText>
            <ThemedText
              muted
              style={[
                styles.sub,
                { textAlign: "center", marginTop: 6, lineHeight: 17 },
              ]}
            >
              {jobCardId
                ? "Go back to see your other job cards."
                : query.trim()
                  ? "Try a different job card number or customer."
                  : tab === "open"
                    ? "New work appears here when it is assigned to you. Pull down to refresh."
                    : "Finished work stays here for two weeks."}
            </ThemedText>
          </View>
        )}

        {/* ---------------------------------------------------------- list */}
        {level === "list" &&
          listGroups.map((g) => {
            const scaleCount = g.scales.size;
            const itemCount = [...g.scales.values()].reduce(
              (n, s) => n + s.items.length,
              0,
            );
            const when = assignedLabel(g.assignedAt);
            return (
              <Pressable
                key={g.jobCardId}
                onPress={() => {
                  if (tab === "open" && !g.closed)
                    void noteWorkStarted(g.jobCardId);
                  onSelectJobCard(g.jobCardId);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${g.jcNumber}${g.customerName ? `, ${g.customerName}` : ""}. Open job card`}
                testID={`group-${g.jcNumber}`}
                style={({ pressed }) => [
                  styles.jcCard,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <View style={styles.jcIcon}>
                  <IClipboard size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[MED, { fontSize: 14 }]} numberOfLines={1}>
                    {g.jcNumber}
                  </ThemedText>
                  <ThemedText
                    muted
                    style={{ fontSize: 12, marginTop: 1 }}
                    numberOfLines={1}
                  >
                    {g.customerName ? `${g.customerName} · ` : ""}
                    {scaleCount} {scaleCount === 1 ? "scale" : "scales"} ·{" "}
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </ThemedText>
                  {!!when && (
                    <View style={styles.assignedRow}>
                      <ICalendar size={12} color={colors.accent} />
                      <ThemedText muted style={{ fontSize: 11 }}>
                        {when}
                      </ThemedText>
                    </View>
                  )}
                </View>
                <View style={styles.jcRight}>
                  {statusBadge(g.closed)}
                  <IChevron size={16} color={colors.textMuted} />
                </View>
              </Pressable>
            );
          })}

        {/* -------------------------------------------------- job card page */}
        {level === "summary" && (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <IClipboard size={24} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[MED, { fontSize: 18 }]} numberOfLines={1}>
                  {detailInfo?.jcNumber ?? "Job card"}
                </ThemedText>
                {!!detailInfo?.customerName && (
                  <ThemedText
                    muted
                    style={{ fontSize: 13, marginTop: 2 }}
                    numberOfLines={1}
                  >
                    {detailInfo.customerName}
                  </ThemedText>
                )}
              </View>
            </View>

            <View style={styles.pills}>
              {statusBadge(detailClosed)}
              {!!assigned && (
                <View style={styles.pillItem}>
                  <ICalendar size={13} color={colors.accent} />
                  <ThemedText muted style={{ fontSize: 12 }}>
                    {assigned}
                  </ThemedText>
                </View>
              )}
              <View style={styles.pillItem}>
                <ILayers size={13} color={colors.accent} />
                <ThemedText muted style={{ fontSize: 12 }}>
                  {detailScales} {detailScales === 1 ? "scale" : "scales"} ·{" "}
                  {detailItems} {detailItems === 1 ? "item" : "items"}
                </ThemedText>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <ThemedText style={[MED, { fontSize: 14 }]}>
                  Job Card Details
                </ThemedText>
              </View>
              {(
                [
                  [IBuilding, "Customer", detailInfo?.customerName || "—"],
                  [ILayers, "Scale(s)", String(detailScales)],
                  [IPackage, "Item(s)", String(detailItems)],
                ] as const
              ).map(([Icon, label, value], i) => (
                <View
                  key={label}
                  style={[styles.detailRow, i === 0 && { borderTopWidth: 0 }]}
                >
                  <View style={styles.detailIcon}>
                    <Icon size={15} color={colors.accent} />
                  </View>
                  <ThemedText muted style={{ flex: 1, fontSize: 13 }}>
                    {label}
                  </ThemedText>
                  <ThemedText
                    style={[
                      MED,
                      { fontSize: 14, flexShrink: 1, textAlign: "right" },
                    ]}
                    numberOfLines={1}
                  >
                    {value}
                  </ThemedText>
                </View>
              ))}
            </View>

            <Pressable
              onPress={onShowWork}
              accessibilityRole="button"
              accessibilityLabel="View scales and work"
              testID="view-details"
              style={({ pressed }) => [
                styles.primaryBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <IExternal size={16} color={colors.primaryText} />
              <ThemedText
                weight="600"
                style={{ fontSize: 14, color: colors.primaryText }}
              >
                View Work
              </ThemedText>
            </Pressable>
          </>
        )}

        {/* -------------------------------------------- scales and work page */}
        {level === "work" &&
          detailGroup &&
          [...detailGroup.scales.entries()].map(([scaleId, sc], idx) => (
            <View
              key={scaleId}
              style={styles.scaleCard}
              testID={`scale-${scaleId}`}
            >
              <View style={styles.scaleHead}>
                <View style={styles.scaleIcon}>
                  <ILayers size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText
                    weight="600"
                    style={{ fontSize: 14 }}
                    numberOfLines={1}
                  >
                    {sc.name}
                  </ThemedText>
                  <ThemedText muted style={{ fontSize: 10, marginTop: 1 }}>
                    Scale {idx + 1} · {sc.items.length}{" "}
                    {sc.items.length === 1 ? "item" : "items"}
                  </ThemedText>
                </View>
              </View>

              {!!sc.scopeOfWork && (
                <ThemedText muted style={styles.scopeLine} numberOfLines={3}>
                  {sc.scopeOfWork}
                </ThemedText>
              )}

              {sc.items.map((w) => {
                const tone =
                  w.localState === "SUBMITTED"
                    ? "success"
                    : w.localState === "QUEUED"
                      ? "warning"
                      : "info";
                return (
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
                    <View style={styles.itemIcon}>
                      <ITimer size={14} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <ThemedText style={{ fontSize: 12 }} numberOfLines={1}>
                        {WORK_ITEM_LABEL[w.moduleType]}
                        {w.sequence > 1 ? ` #${w.sequence}` : ""}
                      </ThemedText>
                      <Badge
                        dot
                        tone={tone}
                        label={
                          w.localState === "SUBMITTED"
                            ? "Sent"
                            : w.localState === "QUEUED"
                              ? "Waiting to send"
                              : "Open"
                        }
                      />
                    </View>
                    <IChevron size={18} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          ))}

        {level === "work" && !!jobCardId && (
          <AddScaleSheet
            visible={adding}
            jobCardId={jobCardId}
            jcNumber={detailInfo?.jcNumber ?? "this job card"}
            onClose={() => setAdding(false)}
          />
        )}

        {/* sort options (the filter button in the design) */}
        <Modal
          visible={sortOpen}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setSortOpen(false)}
        >
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setSortOpen(false)}
            accessibilityLabel="Close"
          >
            <View style={styles.sheet}>
              <ThemedText style={[MED, { fontSize: 15, marginBottom: 6 }]}>
                Sort job cards
              </ThemedText>
              {(Object.keys(SORT_LABEL) as Sort[]).map((key) => (
                <Pressable
                  key={key}
                  onPress={() => {
                    setSort(key);
                    setSortOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sort === key }}
                  style={styles.sheetRow}
                >
                  <ThemedText style={{ flex: 1, fontSize: 14 }}>
                    {SORT_LABEL[key]}
                  </ThemedText>
                  {sort === key && <ICheck size={16} color={colors.primary} />}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      </CustomScrollView>

      {/* floating add-scale button (work page only) */}
      {level === "work" && !detailClosed && (
        <Pressable
          onPress={() => setAdding(true)}
          accessibilityRole="button"
          accessibilityLabel="Add a scale to this job card"
          testID="add-scale"
          style={({ pressed }) => [
            styles.fab,
            {
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
        >
          <IPlus size={26} color={colors.primaryText} />
        </Pressable>
      )}
    </NonTabScreen>
  );
}

// Sizes follow the compact list design: 34px icon tile, 14/12px text, 10-12px padding, 12-14px radii.
// `isDark` swaps the few surfaces where the light palette would collapse on a dark card.
const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    content: { paddingHorizontal: 12, paddingTop: 0, flex: 1 },

    segment: {
      flexDirection: "row",
      backgroundColor: isDark ? colors.card : colors.border + "55",
      borderRadius: 12,
      padding: 3,
      marginBottom: 8,
    },
    segmentItem: {
      flex: 1,
      paddingVertical: 4,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentActive: {
      backgroundColor: isDark ? colors.border : colors.card,
    },

    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    searchBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 38,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      fontFamily: "sans-regular",
      paddingVertical: 0,
    },
    filterBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },

    status: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 10,
      paddingHorizontal: 4,
      minHeight: 20,
    },
    dot: { width: 6, height: 6, borderRadius: 3 },
    sub: { fontSize: 12, color: colors.textMuted },
    retry: { flexDirection: "row", alignItems: "center", gap: 4 },

    jcCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 8,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    jcIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary + (isDark ? "26" : "16"),
    },
    assignedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 4,
    },
    jcRight: {
      alignSelf: "stretch",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 6,
    },

    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    heroIcon: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary + (isDark ? "26" : "16"),
    },
    pills: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
      paddingHorizontal: 2,
    },
    pillItem: { flexDirection: "row", alignItems: "center", gap: 5 },

    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      overflow: "hidden",
    },
    cardHead: {
      paddingHorizontal: 14,
      paddingVertical: 11,
      backgroundColor: colors.background,
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    detailIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary + (isDark ? "26" : "14"),
    },
    noteHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: colors.primary,
      marginTop: 4,
      marginBottom: 12,
    },

    // scales and work page: one card per scale, header strip + item rows
    scaleCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
      overflow: "hidden",
    },
    scaleHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.background,
    },
    scaleIcon: {
      width: 28,
      height: 28,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary + (isDark ? "26" : "14"),
    },
    scopeLine: {
      fontSize: 12,
      lineHeight: 17,
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 0,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    itemIcon: {
      width: 32,
      height: 32,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary + (isDark ? "26" : "16"),
    },

    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 99,
      alignSelf: "flex-start",
    },
    badgeWithDot: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    badgeDot: { width: 6, height: 6, borderRadius: 3 },
    badgeText: { fontSize: 11 },

    fab: {
      position: "absolute",
      right: 16,
      bottom: 16,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      elevation: 6,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.4 : 0.2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },

    sheetBackdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 16,
      paddingBottom: 28,
    },
    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 13,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
  });
