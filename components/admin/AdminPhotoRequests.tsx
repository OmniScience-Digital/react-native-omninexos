// components/admin/AdminPhotoRequests.tsx
import { ThemedText } from "@/components/screens/screen";
import { usePhotoRequests, PhotoChangeRequest } from "@/hooks/usePhotoRequests";
import { useTheme } from "@/src/contexts/theme-context";
import { format } from "date-fns";
import {
  AlertCircle,
  Check,
  Clock,
  RefreshCw,
  ShieldAlert,
  User,
  X,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import type { JSX } from "react";
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItemInfo,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

// ── All icon components cast once at module level ─────────────────────────────
const IAlertCircle = AlertCircle as React.ComponentType<{ size: number; color: string }>;
const ICheck       = Check       as React.ComponentType<{ size: number; color: string }>;
const IClock       = Clock       as React.ComponentType<{ size: number; color: string }>;
const IRefreshCw   = RefreshCw   as React.ComponentType<{ size: number; color: string }>;
const IShieldAlert = ShieldAlert as React.ComponentType<{ size: number; color: string }>;
const IUser        = User        as React.ComponentType<{ size: number; color: string }>;
const IX           = X           as React.ComponentType<{ size: number; color: string }>;

type FilterTab = "PENDING" | "ALL";

// ── Filter tabs ───────────────────────────────────────────────────────────────
function FilterTabs({
  active,
  onChange,
}: {
  active: FilterTab;
  onChange: (t: FilterTab) => void;
}): JSX.Element {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.filterRow,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
      ]}
    >
      {(["PENDING", "ALL"] as FilterTab[]).map((key) => (
        <Pressable
          key={key}
          onPress={() => onChange(key)}
          style={[
            styles.filterTab,
            active === key && { backgroundColor: theme.colors.accent },
          ]}
        >
          <ThemedText
            style={{
              fontSize: 13,
              color: active === key
                ? (theme.colors as any).primaryText ?? "#fff"
                : theme.colors.textMuted,
            }}
            weight={active === key ? "700" : "400"}
          >
            {key === "PENDING" ? "Pending" : "All"}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

// ── Request card ──────────────────────────────────────────────────────────────
function RequestCard({
  request,
  reviewerEmail,
  onApprove,
  onDeny,
}: {
  request: PhotoChangeRequest;
  reviewerEmail: string;
  onApprove: (id: string) => Promise<void>;
  onDeny: (id: string) => Promise<void>;
}): JSX.Element {
  const { theme } = useTheme();
  const [actioning, setActioning] = useState<"approve" | "deny" | null>(null);

  const statusColor: string =
    request.status === "APPROVED" ? theme.colors.success
    : request.status === "DENIED"   ? theme.colors.warning
    : request.status === "COMPLETED"? theme.colors.info
    :                                 theme.colors.warning;

  const statusLabel: string =
    ({ PENDING: "Pending", APPROVED: "Approved", DENIED: "Denied", COMPLETED: "Completed" } as Record<string, string>)[request.status]
    ?? request.status;

  const safeDate = (iso?: string): string => {
    if (!iso) return "—";
    try { return format(new Date(iso), "d MMM yyyy, HH:mm"); }
    catch { return iso; }
  };

  const handleApprove = async (): Promise<void> => {
    setActioning("approve");
    await onApprove(request.id);
    setActioning(null);
  };

  const handleDeny = async (): Promise<void> => {
    setActioning("deny");
    await onDeny(request.id);
    setActioning(null);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderLeftColor: statusColor,
        },
      ]}
    >
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={[styles.avatarCircle, { backgroundColor: theme.colors.accent + "18" }]}>
          <IUser size={20} color={theme.colors.accent} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <ThemedText weight="700" style={{ fontSize: 14 }}>
            {request.employeeName ?? request.userId}
          </ThemedText>
          <ThemedText muted variant="small">{request.userId}</ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "18", borderColor: statusColor + "40" }]}>
          <ThemedText style={{ color: statusColor, fontSize: 11 }} weight="600">
            {statusLabel}
          </ThemedText>
        </View>
      </View>

      {/* Timestamps */}
      <View style={styles.timeRow}>
        <IClock size={12} color={theme.colors.textMuted} />
        <ThemedText muted variant="small" style={{ marginLeft: 5 }}>
          Requested {safeDate(request.requestedAt ?? request.createdAt)}
        </ThemedText>
      </View>
      {request.reviewedAt != null && (
        <View style={styles.timeRow}>
          <ICheck size={12} color={theme.colors.textMuted} />
          <ThemedText muted variant="small" style={{ marginLeft: 5 }}>
            Reviewed {safeDate(request.reviewedAt)}
            {request.reviewedBy != null ? ` · ${request.reviewedBy}` : ""}
          </ThemedText>
        </View>
      )}

      {/* Action buttons — PENDING only */}
      {request.status === "PENDING" && (
        <View style={styles.actionRow}>
          <Pressable
            onPress={handleDeny}
            disabled={actioning != null}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                flex: 1,
                marginRight: 8,
                backgroundColor: theme.colors.warning + "10",
                borderColor: theme.colors.warning + "40",
                opacity: pressed || actioning != null ? 0.7 : 1,
              },
            ]}
          >
            {actioning === "deny" ? (
              <ActivityIndicator size="small" color={theme.colors.warning} />
            ) : (
              <>
                <IX size={14} color={theme.colors.warning} />
                <ThemedText
                  style={{ color: theme.colors.warning, marginLeft: 6, fontSize: 13 }}
                  weight="600"
                >
                  Deny
                </ThemedText>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={handleApprove}
            disabled={actioning != null}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                flex: 1,
                backgroundColor: theme.colors.success + "14",
                borderColor: theme.colors.success + "40",
                opacity: pressed || actioning != null ? 0.7 : 1,
              },
            ]}
          >
            {actioning === "approve" ? (
              <ActivityIndicator size="small" color={theme.colors.success} />
            ) : (
              <>
                <ICheck size={14} color={theme.colors.success} />
                <ThemedText
                  style={{ color: theme.colors.success, marginLeft: 6, fontSize: 13 }}
                  weight="600"
                >
                  Approve
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ filter }: { filter: FilterTab }): JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={styles.emptyState}>
      <IShieldAlert size={32} color={theme.colors.textMuted} />
      <ThemedText muted style={{ marginTop: 12, textAlign: "center" }}>
        {filter === "PENDING" ? "No pending requests" : "No requests found"}
      </ThemedText>
    </View>
  );
}

// ── Main exported component ───────────────────────────────────────────────────
export function AdminPhotoRequests({
  reviewerEmail,
}: {
  reviewerEmail: string;
}): JSX.Element {
  const { theme } = useTheme();
  const [filter, setFilter] = useState<FilterTab>("PENDING");

  const {
    items,
    loading,
    fetchingMore,
    hasMore,
    error,
    clearError,
    loadFirstPage,
    loadMore,
    approveRequest,
    denyRequest,
  } = usePhotoRequests(filter);

  useEffect(() => {
    loadFirstPage();
  }, [filter, loadFirstPage]);

  const handleApprove = async (id: string): Promise<void> => {
    await approveRequest(id, reviewerEmail);
  };

  const handleDeny = async (id: string): Promise<void> => {
    await denyRequest(id, reviewerEmail);
  };

  const renderItem = ({
    item,
  }: ListRenderItemInfo<PhotoChangeRequest>): JSX.Element => (
    <RequestCard
      request={item}
      reviewerEmail={reviewerEmail}
      onApprove={handleApprove}
      onDeny={handleDeny}
    />
  );

  return (
    <View>
      {/* Header */}
      <View style={styles.sectionHead}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <IShieldAlert size={18} color={theme.colors.accent} />
          <ThemedText variant="h2" weight="700">
            Photo Requests
          </ThemedText>
        </View>
        <Pressable
          onPress={loadFirstPage}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <IRefreshCw size={18} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      <FilterTabs active={filter} onChange={setFilter} />

      {/* Error banner */}
      {error != null && (
        <Pressable
          onPress={clearError}
          style={[
            styles.errorBanner,
            {
              backgroundColor: theme.colors.warning + "14",
              borderColor: theme.colors.warning + "40",
            },
          ]}
        >
          <IAlertCircle size={14} color={theme.colors.warning} />
          <ThemedText style={{ color: theme.colors.warning, marginLeft: 8, fontSize: 13 }}>
            {error}
          </ThemedText>
        </Pressable>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList<PhotoChangeRequest>
          data={items}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
          scrollEnabled={false}
          onEndReached={() => { if (!fetchingMore && hasMore) loadMore(); }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<EmptyState filter={filter} />}
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  filterRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginBottom: 14,
    alignSelf: "flex-start",
    gap: 3,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 10,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 14,
  },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  timeRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  actionRow: { flexDirection: "row", marginTop: 12 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyState: { alignItems: "center", paddingVertical: 40 },
});