// hooks/useSyncEngine.ts
import { startSyncEngine, stopSyncEngine } from "@/services/syncEngine";
import { useEffect } from "react";

export const useSyncEngine = () => {
  useEffect(() => {
    startSyncEngine();
    return () => stopSyncEngine();
  }, []);
};
