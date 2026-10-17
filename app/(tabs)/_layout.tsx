// app/(tabs)/_layout.tsx
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useSyncEngine } from "@/hooks/useSyncEngine";
import { useAuth } from "@/src/contexts/auth-context";
import {
  ClockInProvider,
  useClockInContext,
} from "@/src/contexts/clockin-context";
import { useNotifications } from "@/src/contexts/notification-context";
import { ReferencePhotoProvider } from "@/src/contexts/reference-photo-context";
import {
  getTabBarBottom,
  TabBarProvider,
  useTabBar,
} from "@/src/contexts/tabbar-context";
import { useTheme } from "@/src/contexts/theme-context";
import { showResponseModal } from "@/src/state";
import { api } from "@/src/state/api";
import { useAppDispatch } from "@/src/state/redux";
import { tabs } from "@/src/tabs";
import { BottomTabBar, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface TabIconProps {
  focused: boolean;
  icon: any;
  label: string;
  collapse: Animated.Value; // 0 = full bar (labels shown), 1 = pill (icons only)
  badgeCount?: number;
}

const TabIcon = ({
  focused,
  icon: Icon,
  label,
  collapse,
  badgeCount,
}: TabIconProps) => {
  const { theme } = useTheme();
  const fg = "#fff";

  // Circle grows a little and the label folds away when the bar becomes a pill,
  // so the padding stays even (8px top and bottom) in both states
  const circle = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [34, 40],
  });
  const circleRadius = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [17, 20],
  });
  const labelHeight = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });
  const labelGap = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 0],
  });
  const labelOpacity = collapse.interpolate({
    inputRange: [0, 0.5],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={{ width: 56, alignItems: "center" }}>
      <Animated.View
        style={{
          width: circle,
          height: circle,
          borderRadius: circleRadius,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: focused ? "#D3DAD9" : "transparent",
        }}
      >
        <Icon
          size={18}
          color={focused ? "#393E46" : fg}
          strokeWidth={focused ? 2.2 : 1.8}
        />
        {/* Red badge */}
        {badgeCount !== undefined && badgeCount > 0 && (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              backgroundColor: "red",
              borderRadius: 12,
              minWidth: 18,
              height: 18,
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 4,
            }}
          >
            <Text
              style={{
                color: "white",
                fontSize: 11,
                fontWeight: "bold",
                textAlign: "center",
              }}
            >
              {badgeCount}
            </Text>
          </View>
        )}
      </Animated.View>
      <Animated.Text
        numberOfLines={1}
        style={{
          marginTop: labelGap,
          height: labelHeight,
          opacity: labelOpacity,
          fontSize: 10,
          lineHeight: 12,
          fontFamily: focused ? "sans-bold" : "sans-semibold",
          color: focused ? fg : fg + "99",
        }}
      >
        {label}
      </Animated.Text>
    </View>
  );
};

// Default tab bar + a soft fade behind it so scrolling content doesn't clutter the edges
const FadeTabBar = (props: BottomTabBarProps) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBar = theme.components.tabBar;

  const fadeHeight =
    getTabBarBottom(insets.bottom, tabBar.horizontalInset) + tabBar.height + 28;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: fadeHeight,
        }}
      >
        <LinearGradient
          colors={[
            theme.colors.background + "00",
            theme.colors.background + "F2",
          ]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <BottomTabBar {...props} />
    </View>
  );
};

function TabLayoutInner() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const tabBar = theme.components.tabBar;
  const { scrollY } = useTabBar();
  const { unreadCount } = useNotifications();

  const { width: screenWidth } = useWindowDimensions();

  // 0 = full-width bar, 1 = compact floating pill (like Sofascore)
  const collapse = useRef(new Animated.Value(0)).current;
  const lastY = useRef(0);
  const isCollapsed = useRef(false);

  const setCollapsed = useCallback(
    (to: boolean) => {
      if (isCollapsed.current === to) return;
      isCollapsed.current = to;
      Animated.timing(collapse, {
        toValue: to ? 1 : 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // animating layout (margin/height)
      }).start();
    },
    [collapse],
  );

  // Scrolling down shrinks the bar, scrolling up (or reaching the top) expands it
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      const delta = value - lastY.current;
      lastY.current = value;
      if (value < 24) setCollapsed(false);
      else if (delta > 4) setCollapsed(true);
      else if (delta < -4) setCollapsed(false);
    });
    return () => scrollY.removeListener(id);
  }, [scrollY, setCollapsed]);

  const expand = useCallback(() => setCollapsed(false), [setCollapsed]);

  // Side margin when collapsed: pill is ~72% of the screen width
  const collapsedMargin = screenWidth * 0.14;
  const marginHorizontal = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.spacing.sm, collapsedMargin],
  });
  const barHeight = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [tabBar.height, tabBar.height - 8],
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        // freezeOnBlur: true,
        lazy: false,
        tabBarStyle: {
          position: "absolute",
          bottom: getTabBarBottom(insets.bottom, tabBar.horizontalInset),
          height: barHeight as any,
          // Full width = same side inset as the page cards; shrinks on scroll
          marginHorizontal: marginHorizontal as any,
          borderRadius: tabBar.radius,
          backgroundColor: theme.colors.primary,
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: theme.colors.shadow,
          shadowOpacity: 1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        },
        tabBarItemStyle: {
          paddingVertical: 0,
          justifyContent: "center",
        },
        tabBarIconStyle: {
          width: 56,
          height: 48,
          alignItems: "center",
          justifyContent: "center",
        },
      }}
      screenListeners={{ tabPress: expand, focus: expand }}
      tabBar={(props) => <FadeTabBar {...props} />}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused }) => (
              <TabIcon
                focused={focused}
                icon={tab.icon}
                label={tab.title}
                collapse={collapse}
                badgeCount={tab.name === "alerts" ? unreadCount : undefined}
              />
            ),
          }}
        />
      ))}
      {/* SIDEMENU: Settings is opened from the side menu, so it gets no tab button */}
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

// SyncManager sits inside ClockInProvider so it can call refetchHistory
// on the shared clock-in instance after each sync completes.
function SyncManager() {
  const dispatch = useAppDispatch();
  const { refetchHistory } = useClockInContext();

  // Live auto-sync of fleet + inventory changes made on the web app.
  useRealtimeSync();

  useSyncEngine({
    onDebugLog: (message) => {
      dispatch(
        showResponseModal({
          successful: true,
          message: `🔍 ${message}`,
        }),
      );
    },
    onSyncSuccess: (count) => {
      dispatch(
        showResponseModal({
          successful: true,
          message: `${count} offline change${count !== 1 ? "s" : ""} synced successfully`,
        }),
      );
    },
    onSyncError: (err) => {
      dispatch(
        showResponseModal({
          successful: false,
          message: `Sync failed: ${err}`,
        }),
      );
    },
    onItemSynced: (type, payload) => {
      if (type === "clockin" || type === "clockout") {
        // Invalidate RTK tag AND explicitly re-run the lazy query.
        // usePaginatedClockRecords uses a lazy query whose local state
        // does NOT react to tag invalidation — refetchHistory() is needed.
        const userId = payload?.userId ?? payload?.originalClockIn?.userId;
        if (userId) {
          dispatch(
            api.util.invalidateTags([{ type: "ClockRecord", id: userId }]),
          );
        }
        refetchHistory();
      } else if (type === "vif") {
        const fleetId =
          payload?.fleetKmUpdate?.id ?? payload?.inspectionData?.fleetid;
        if (fleetId) {
          dispatch(
            api.util.invalidateTags([{ type: "Inspection", id: fleetId }]),
          );
        }
        dispatch(api.util.invalidateTags(["Fleet"]));
      } else if (type === "stock") {
        dispatch(api.util.invalidateTags(["Categories", "Components"]));
      }
    },
  });

  return null;
}

export default function TabLayout() {
  // Don't mount the tabs (and with them the live sync, the offline-queue sync
  // and every screen's data queries) until a user is signed in. These calls
  // now require a Cognito session, so running them on the sign-in screen's
  // first frame is what produced "No federated user" errors on app open.
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;

  return (
    <ClockInProvider>
      <ReferencePhotoProvider>
        <SyncManager />
        <TabBarProvider>
          <TabLayoutInner />
        </TabBarProvider>
      </ReferencePhotoProvider>
    </ClockInProvider>
  );
}
