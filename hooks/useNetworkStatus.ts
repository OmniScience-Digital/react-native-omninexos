// hooks/useNetworkStatus.ts
// Single source of truth for network state across the app.
// Components use this to skip queries and show offline banners.
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export interface NetworkStatus {
  isOnline: boolean;
  isOffline: boolean;
  checked: boolean; // false until first NetInfo response
}

export function useNetworkStatus(): NetworkStatus {
  const [state, setState] = useState<NetworkStatus>({
    isOnline: true, // optimistic default — avoids flash of offline UI
    isOffline: false,
    checked: false,
  });

  useEffect(() => {
    // Get current state immediately
    NetInfo.fetch().then((net: NetInfoState) => {
      // isInternetReachable can be null on iOS in airplane mode — treat as offline
      const online =
        net.isConnected === true && net.isInternetReachable === true;
      setState({ isOnline: online, isOffline: !online, checked: true });
    });

    // Subscribe to changes
    const unsub = NetInfo.addEventListener((net: NetInfoState) => {
      const online =
        net.isConnected === true && net.isInternetReachable === true;
      setState({ isOnline: online, isOffline: !online, checked: true });
    });

    return () => unsub();
  }, []);

  return state;
}
