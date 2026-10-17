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
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface TabIconProps {
  focused: boolean;
  icon: any;
  badgeCount?: number;
}

const TabIcon = ({ focused, icon: Icon, badgeCount }: TabIconProps) => {
  const { theme } = useTheme();
  const fg = "#fff";
  return (
    <View style={{ width: 64, alignItems: "center" }}>
      {/* Softer, smaller active circle */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
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
      </View>
    </View>
  );
};

// Default tab bar + a soft fade behind it so scrolling content doesn't clutter the edges
const FadeTabBar = (props: BottomTabBarProps) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollY } = useTabBar();
  const tabBar = theme.components.tabBar;

  const fadeHeight =
    getTabBarBottom(insets.bottom, tabBar.horizontalInset) + tabBar.height + 28;

  const translateY = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [0, fadeHeight],
    extrapolate: "clamp",
  });

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
          transform: [{ translateY }],
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

  const tabBarHeight =
    tabBar.height + Math.max(insets.bottom, tabBar.horizontalInset) + 20;

  const translateY = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [0, tabBarHeight],
    extrapolate: "clamp",
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
          height: tabBar.height,
          // Same side inset as the page cards (theme.spacing.sm)
          marginHorizontal: theme.spacing.sm,
          borderRadius: tabBar.radius,
          backgroundColor: theme.colors.primary,
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: theme.colors.shadow,
          shadowOpacity: 1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          transform: [{ translateY }],
        },
        tabBarItemStyle: {
          paddingVertical: 0,
          justifyContent: "center",
        },
        tabBarIconStyle: {
          width: 64,
          height: 52,
          alignItems: "center",
          justifyContent: "center",
        },
      }}
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
