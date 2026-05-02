// services/syncEngine.ts
// Runs in the background. Watches for network and drains the queue.
// Import and call startSyncEngine() once in your root _layout.tsx.

import { SCF_clickUpService } from "@/services/scf.clickUp.service";
import {
    uploadPhoto,
    Vif_clickUpService,
} from "@/services/vif.clickUp.service";
import NetInfo from "@react-native-community/netinfo";
import {
    getPending,
    markCompleted,
    markFailed,
    markSyncing,
    pruneCompleted,
    QueuedSubmission,
} from "./submissionQueue";

// ─── VIF submission handler ───────────────────────────────────
const submitVif = async (payload: any): Promise<void> => {
  const {
    inspectionData,
    clickUpPayload,
    photos,
    updateFleetKmFn,
    createInspectionFn,
  } = payload;

  // 1. Update fleet km — call your RTK mutation via a passed-in thunk
  // Note: Since we can't use hooks here, the payload must include
  // everything pre-built. See VehicleInspectionForm for how we build it.
  await updateFleetKmFn();

  // 2. Create inspection record
  await createInspectionFn();

  // 3. Create ClickUp task
  const taskResponse = await Vif_clickUpService.createTask(clickUpPayload);
  if (!taskResponse.success) {
    throw new Error(taskResponse.message || "ClickUp task creation failed");
  }

  const taskId = String(taskResponse.taskId);

  // 4. Attach photos to ClickUp task
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const result = await uploadPhoto({
      photo: { uri: photo.uri, name: `photo_${i + 1}.jpg`, type: "image/jpeg" },
      taskId,
    });
    if (!result?.success) {
      throw new Error(`Photo ${i + 1} attach failed: ${result?.error}`);
    }
  }
};

// ─── Stock Control submission handler ────────────────────────
const submitStock = async (payload: any): Promise<void> => {
  const { username, result } = payload;
  const response = await SCF_clickUpService.createTask(username, result);
  if (
    !response.success &&
    !response.message?.toLowerCase().includes("success")
  ) {
    throw new Error(response.message || "Stock submission failed");
  }
};

// ─── Process a single queued row ─────────────────────────────
const processRow = async (row: QueuedSubmission): Promise<void> => {
  await markSyncing(row.id);

  let parsed: any;
  try {
    parsed = JSON.parse(row.payload);
  } catch {
    await markFailed(row.id, "Payload JSON parse error");
    return;
  }

  try {
    if (row.type === "vif") {
      await submitVif(parsed);
    } else if (row.type === "stock") {
      await submitStock(parsed);
    }
    await markCompleted(row.id);
    console.log(`[SyncEngine] Row ${row.id} (${row.type}) completed`);
  } catch (error: any) {
    const msg = error?.message ?? "Unknown error";
    await markFailed(row.id, msg);
    console.warn(`[SyncEngine] Row ${row.id} failed: ${msg}`);
  }
};

// ─── Drain the full queue ─────────────────────────────────────
const drainQueue = async (): Promise<void> => {
  const rows = await getPending();
  if (rows.length === 0) return;

  console.log(`[SyncEngine] Draining ${rows.length} pending submission(s)`);

  for (const row of rows) {
    // Re-check network before each row in case we drop mid-drain
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      console.log("[SyncEngine] Lost network mid-drain, stopping");
      break;
    }
    await processRow(row);
  }

  // Housekeeping: prune old completed rows
  await pruneCompleted();
};

// ─── Public: start the engine ────────────────────────────────
let unsubscribe: (() => void) | null = null;

export const startSyncEngine = (): void => {
  if (unsubscribe) return; // already running

  // Attempt drain immediately on start (app may have been offline last session)
  NetInfo.fetch().then((state) => {
    if (state.isConnected) drainQueue();
  });

  // Subscribe to connectivity changes
  unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      drainQueue();
    }
  });

  console.log("[SyncEngine] Started");
};

export const stopSyncEngine = (): void => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
    console.log("[SyncEngine] Stopped");
  }
};

// ─── Manually trigger a sync (e.g. from a retry button) ──────
export const triggerSync = async (): Promise<void> => {
  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    throw new Error("No network connection");
  }
  await drainQueue();
};
