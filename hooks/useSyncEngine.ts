// // hooks/useSyncEngine.ts
// import { startSyncEngine, stopSyncEngine } from "@/services/syncEngine";
// import { useEffect } from "react";

// export const useSyncEngine = () => {
//   useEffect(() => {
//     startSyncEngine();
//     return () => stopSyncEngine();
//   }, []);
// };

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
