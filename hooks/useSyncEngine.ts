// hooks/useSyncEngine.ts
import {
  startSyncEngine,
  stopSyncEngine,
  SyncCallbacks,
} from "@/services/syncEngine";
import { useEffect } from "react";

export const useSyncEngine = (callbacks: SyncCallbacks = {}) => {
  useEffect(() => {
    startSyncEngine(callbacks);
    return () => stopSyncEngine();
  }, []);
};
