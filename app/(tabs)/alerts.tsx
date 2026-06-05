// app/(tabs)/alerts.tsx
import { Screen, ThemedText } from "@/components/screens/screen";
import { CustomHeader } from "@/components/ui/customHeader";
import { CustomScrollView } from "@/components/ui/scrollView";
import { InAppNotification } from "@/hooks/usePushNotifications";
import { useNotifications } from "@/src/contexts/notification-context";
import { useTheme } from "@/src/contexts/theme-context";
import { format, isToday, isYesterday } from "date-fns";
import {
  Bell,
  BellOff,
  Camera,
  CheckCheck,
  Clock,
  ShieldCheck,
  Trash2,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

const I = (C: any) => C as any;

function notificationMeta(
  data?: Record<string, any>,
  theme?: any,
): { Icon: any; color: string } {
  const type = data?.type as string | undefined;
  if (type === "photo_request_approved" || type === "photo_change")
    return { Icon: Camera, color: theme?.colors.success ?? "#16a34a" };
  if (type === "clock_in" || type === "clock_out")
    return { Icon: Clock, color: theme?.colors.info ?? "#0284c7" };
  if (type === "verification_failed")
    return { Icon: ShieldCheck, color: theme?.colors.warning ?? "#d97706" };
  return { Icon: Bell, color: theme?.colors.accent ?? "#3d3d3d" };
}

function relativeTime(date: Date): string {
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return `Yesterday ${format(date, "HH:mm")}`;
  return format(date, "d MMM");
}

function NotificationCard({
  notification,
  onMarkRead,
}: {
  notification: InAppNotification;
  onMarkRead: (id: string) => void;
}) {
  const { theme } = useTheme();
  const { Icon, color } = notificationMeta(notification.data, theme);

  return (
    <Pressable
      onPress={() => onMarkRead(notification.id)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: notification.read ? theme.colors.border : color + "40",
          borderLeftColor: notification.read ? theme.colors.border : color,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: color + "18" }]}>
        <Icon size={20} color={color} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={styles.cardTop}>
          <ThemedText
            weight="700"
            style={{ fontSize: 14, flex: 1 }}
            numberOfLines={1}
          >
            {notification.title}
          </ThemedText>
          <ThemedText muted variant="small" style={{ marginLeft: 8 }}>
            {relativeTime(notification.receivedAt)}
          </ThemedText>
        </View>
        <ThemedText
          muted
          variant="small"
          style={{ marginTop: 2 }}
          numberOfLines={2}
        >
          {notification.body}
        </ThemedText>
      </View>
      {!notification.read && (
        <View style={[styles.unreadDot, { backgroundColor: color }]} />
      )}
    </Pressable>
  );
}

function EmptyState() {
  const { theme } = useTheme();
  return (
    <View style={styles.emptyState}>
      <BellOff size={40} color={theme.colors.textMuted} />
      <ThemedText
        muted
        style={{ marginTop: 14, textAlign: "center", fontSize: 15 }}
      >
        No notifications yet
      </ThemedText>
      <ThemedText
        muted
        variant="small"
        style={{ marginTop: 6, textAlign: "center" }}
      >
        Alerts for attendance, photo requests{"\n"}and other events appear here
      </ThemedText>
    </View>
  );
}

export default function AlertsScreen() {
  const { theme } = useTheme();

  const {
    notifications,
    unreadCount,
    registering,
    markRead,
    markAllRead,
    clearNotifications,
  } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Pull-to-refresh resets the read state counter as a signal to re-check
    await new Promise((r) => setTimeout(r, 600));
    setRefreshing(false);
  }, []);

  return (
    <Screen>
      <CustomScrollView>
        {/* Header */}
        <View style={styles.header}>
          <CustomHeader
            title="Alerts"
            subtitle={
              unreadCount > 0 ? `${unreadCount} unread` : "All caught up"
            }
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            {unreadCount > 0 && (
              <Pressable
                onPress={markAllRead}
                style={({ pressed }) => [
                  styles.headerBtn,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <CheckCheck size={18} color={theme.colors.accent} />
              </Pressable>
            )}
            {notifications.length > 0 && (
              <Pressable
                onPress={clearNotifications}
                style={({ pressed }) => [
                  styles.headerBtn,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Trash2 size={18} color={theme.colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Push registration status */}
        {registering && (
          <View
            style={[
              styles.banner,
              {
                backgroundColor: theme.colors.info + "14",
                borderColor: theme.colors.info + "40",
              },
            ]}
          >
            <ActivityIndicator size="small" color={theme.colors.info} />
            <ThemedText
              style={{
                color: theme.colors.info,
                marginLeft: 10,
                fontSize: 13,
              }}
            >
              Setting up push notifications…
            </ThemedText>
          </View>
        )}

        {/* Notification list or empty state */}
        {notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={{ gap: 8 }}>
            {notifications.map((n: any) => (
              <NotificationCard
                key={n.id}
                notification={n}
                onMarkRead={markRead}
              />
            ))}
          </View>
        )}
      </CustomScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
    marginTop: 4,
    flexShrink: 0,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
});
