// hooks/useRealtimeSync.ts
import { startRealtimeSync } from "@/src/state/realtime";
import { useEffect } from "react";
import { useStore } from "react-redux";

/**
 * Keeps fleet / inventory data live while the app is open and online
 * (see src/state/realtime.ts). Mount once, inside the signed-in tab layout.
 */
export function useRealtimeSync() {
  const store = useStore();
  useEffect(
    () =>
      startRealtimeSync({
        dispatch: store.dispatch as (action: any) => any,
        getState: store.getState,
      }),
    [store],
  );
}
