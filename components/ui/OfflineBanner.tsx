// components/ui/OfflineBanner.tsx
// Drop this inside any screen that fetches data.
// Shows a subtle banner when offline, nothing when online.
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useTheme } from "@/src/contexts/theme-context";
import { WifiOff } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";

const IWifiOff = WifiOff as React.ComponentType<any>;

export function OfflineBanner(): React.ReactElement | null {
  const { isOffline, checked } = useNetworkStatus();
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!checked) return;
    Animated.timing(opacity, {
      toValue: isOffline ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline, checked, opacity]);

  if (!checked) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.warning + "18",
          borderColor: theme.colors.warning + "40",
          opacity,
        },
      ]}
      pointerEvents="none"
    >
      <IWifiOff size={13} color={theme.colors.warning} />
      <Text style={[styles.text, { color: theme.colors.warning }]}>
        You're offline — showing cached data
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 5,
    marginHorizontal: 0,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
});
