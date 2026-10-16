// components/ui/SideMenu.tsx
import { ThemedText } from "@/components/screens/screen";
import { useAuth } from "@/src/contexts/auth-context";
import { useTheme } from "@/src/contexts/theme-context";
import {
  getInitials,
  isActiveRoute,
  sideMenuItems,
  type SideMenuItem,
} from "@/src/sideMenu";
import * as Application from "expo-application";
import { router, usePathname } from "expo-router";
import { ChevronRight, LogOut } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  /** 0 (closed) to 1 (open), animated by the provider */
  progress: Animated.Value;
  /** false while the panel is sliding closed */
  visible: boolean;
  onClose: () => void;
}

export default function SideMenu({ progress, visible, onClose }: Props) {
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { width: screenWidth } = useWindowDimensions();

  const width = Math.min(320, Math.round(screenWidth * 0.82));
  const drag = useRef(new Animated.Value(0)).current; // how far the finger has pulled the panel to the left

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const widthRef = useRef(width);
  widthRef.current = width;

  const pan = useRef(
    PanResponder.create({
      // only a clear leftward swipe: taps and vertical scrolling stay with the buttons
      onMoveShouldSetPanResponder: (_, g) =>
        g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => drag.setValue(Math.min(0, g.dx)),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -widthRef.current * 0.25 || g.vx < -0.6)
          onCloseRef.current();
        else
          Animated.spring(drag, { toValue: 0, useNativeDriver: false }).start();
      },
      onPanResponderTerminate: () =>
        Animated.spring(drag, { toValue: 0, useNativeDriver: false }).start(),
    }),
  ).current;

  // Logout asks for confirmation inline (no <Modal>, so the immersive nav bar stays hidden)
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!visible) {
      drag.setValue(0);
      setConfirmingLogout(false);
    }
  }, [visible, drag]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    onClose();
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoggingOut(false);
      setConfirmingLogout(false);
    }
  };

  const translateX = Animated.add(
    progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }),
    drag,
  );
  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const name = user?.preferred_username || user?.name || "";
  const email = user?.email || "";

  const select = (item: SideMenuItem) => {
    onClose();
    router.push(item.route);
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={visible ? "auto" : "none"}
      testID="side-menu"
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "#000", opacity: backdropOpacity },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          testID="side-menu-backdrop"
        />
      </Animated.View>

      <Animated.View
        {...pan.panHandlers}
        accessibilityViewIsModal
        style={[
          styles.panel,
          {
            width,
            transform: [{ translateX }],
            backgroundColor: theme.colors.background,
            borderRightColor: theme.colors.border,
            paddingTop: insets.top + 16,
            paddingBottom: Math.max(insets.bottom, 12) + 8,
          },
        ]}
      >
        {/* Who is signed in */}
        <View style={styles.profile}>
          <View
            style={[styles.avatar, { backgroundColor: theme.colors.primary }]}
          >
            <ThemedText
              weight="700"
              style={{ color: theme.colors.primaryText }}
            >
              {getInitials(name || email)}
            </ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText weight="700" numberOfLines={1}>
              {name || "Signed in"}
            </ThemedText>
            {!!email && (
              <ThemedText muted variant="small" numberOfLines={1}>
                {email}
              </ThemedText>
            )}
          </View>
        </View>

        <View
          style={[styles.divider, { backgroundColor: theme.colors.border }]}
        />

        {/* Entries (see src/sideMenu.ts) */}
        <View style={{ flex: 1, paddingTop: 8 }}>
          {sideMenuItems.map((item) => {
            const active = isActiveRoute(pathname, item.route);
            const Icon = item.icon;
            return (
              <Pressable
                key={item.key}
                onPress={() => select(item)}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                accessibilityState={{ selected: active }}
                testID={`side-menu-item-${item.key}`}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: active ? theme.colors.card : "transparent",
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Icon
                  size={20}
                  color={active ? theme.colors.text : theme.colors.textMuted}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                <ThemedText weight={active ? "700" : "600"} style={{ flex: 1 }}>
                  {item.title}
                </ThemedText>
                <ChevronRight size={16} color={theme.colors.textMuted} />
              </Pressable>
            );
          })}
        </View>

        <View
          style={[styles.divider, { backgroundColor: theme.colors.border }]}
        />

        {/* Log out */}
        <View style={styles.logoutWrap}>
          {confirmingLogout ? (
            <View
              style={[
                styles.confirmCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <ThemedText weight="700">Log out?</ThemedText>
              <ThemedText muted variant="small">
                You will need to sign in again to use the app.
              </ThemedText>
              <View style={styles.confirmButtons}>
                <Pressable
                  onPress={() => setConfirmingLogout(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel log out"
                  testID="side-menu-logout-cancel"
                  style={({ pressed }) => [
                    styles.confirmBtn,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <ThemedText weight="600" variant="small">
                    Cancel
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleLogout}
                  disabled={loggingOut}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm log out"
                  testID="side-menu-logout-confirm"
                  style={({ pressed }) => [
                    styles.confirmBtn,
                    {
                      backgroundColor: theme.colors.primary,
                      borderColor: theme.colors.primary,
                      opacity: pressed || loggingOut ? 0.7 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    weight="700"
                    variant="small"
                    style={{ color: theme.colors.primaryText }}
                  >
                    Log Out
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setConfirmingLogout(true)}
              accessibilityRole="button"
              accessibilityLabel="Log out"
              testID="side-menu-logout"
              style={({ pressed }) => [
                styles.row,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <LogOut
                size={20}
                color={theme.colors.textMuted}
                strokeWidth={1.8}
              />
              <ThemedText weight="600" style={{ flex: 1 }}>
                Log Out
              </ThemedText>
            </Pressable>
          )}
        </View>

        <ThemedText muted variant="small" style={styles.version}>
          Omni-Nexos{" "}
          {Application.nativeApplicationVersion
            ? `v${Application.nativeApplicationVersion}`
            : ""}
        </ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    elevation: 16,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 0 },
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { height: StyleSheet.hairlineWidth },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  logoutWrap: { paddingTop: 8 },
  confirmCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  confirmButtons: { flexDirection: "row", gap: 8, marginTop: 8 },
  confirmBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  version: { textAlign: "center", paddingTop: 8 },
});
