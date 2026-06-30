// app/(tabs)/_layout.tsx
import { useSyncEngine } from "@/hooks/useSyncEngine";
import { cn } from "@/lib/utils";
import {
  ClockInProvider,
  useClockInContext,
} from "@/src/contexts/clockin-context";
import { useNotifications } from "@/src/contexts/notification-context";
import { ReferencePhotoProvider } from "@/src/contexts/reference-photo-context";
import { TabBarProvider, useTabBar } from "@/src/contexts/tabbar-context";
import { useTheme } from "@/src/contexts/theme-context";
import { showResponseModal } from "@/src/state";
import { api } from "@/src/state/api";
import { useAppDispatch } from "@/src/state/redux";
import { tabs } from "@/src/tabs";
import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface TabIconProps {
  focused: boolean;
  icon: any;
  badgeCount?: number;
}

const TabIcon = ({ focused, icon: Icon, badgeCount }: TabIconProps) => {
  return (
    <View className="tabs-icon">
      <View className={cn("tabs-pill", focused && "tabs-active")}>
        <Icon
          size={20}
          color={focused ? "#393E46" : "#fff"}
          strokeWidth={focused ? 2.2 : 1.8}
        />
        {/* Red badge */}
        {badgeCount !== undefined && badgeCount > 0 && (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -1,
              backgroundColor: "red",
              borderRadius: 12,
              minWidth: 20,
              height: 20,
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 4,
            }}
          >
            <Text
              style={{
                color: "white",
                fontSize: 12,
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
          bottom: Math.max(insets.bottom, tabBar.horizontalInset) + 2,
          height: tabBar.height,
          marginHorizontal: tabBar.horizontalInset,
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
          paddingVertical: tabBar.height / 2 - tabBar.iconFrame / 1.6,
        },
        tabBarIconStyle: {
          width: tabBar.iconFrame,
          height: tabBar.iconFrame,
          alignItems: "center",
        },
      }}
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
    </Tabs>
  );
}

// SyncManager sits inside ClockInProvider so it can call refetchHistory
// on the shared clock-in instance after each sync completes.
function SyncManager() {
  const dispatch = useAppDispatch();
  const { refetchHistory } = useClockInContext();

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
