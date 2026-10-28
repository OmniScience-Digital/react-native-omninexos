// src/jobcards/background.ts
// The OS-level background task. It wakes up (Android WorkManager / iOS BGTaskScheduler) roughly every 15 minutes
// while the app is backgrounded but NOT force-quit, and runs the same sync the foreground uses.
//
// Limits you cannot beat:
//   - If the user swipes the app away from recents, the OS stops the task until the app is opened again.
//   - On iOS, the OS decides when (or whether) to run it. There is no guarantee of a fixed interval.
// Both are platform rules, not something this file can change.
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { beginBackgroundRun, finishBackgroundRun } from "../sync/backgroundLog";
import { interpretOutcome } from "./backgroundOutcome";
import { requestSyncDetailed, setJobCardUser } from "./controller";
import { normEmail } from "./people";
import { getJobCardStore } from "./sqliteDriver";

// Keep this name unchanged: phones that already have the task registered keep working with no migration.
const TASK_NAME = "jobcards-sync";
/** Android WorkManager will not run a periodic task more often than this. It is a floor, not a schedule. */
const MIN_INTERVAL_MINUTES = 15;

// 1. Define the task in global scope (before React mounts). This block runs at module load, once.
//    IMPORTANT: this file must be imported from the app entry (index.js), not from a screen or layout, so the
//    definition exists when the OS wakes the app with no UI.
TaskManager.defineTask(TASK_NAME, async () => {
  // Written before any work, so a run that is killed mid-way still leaves a "started, never finished" record.
  const runId = await beginBackgroundRun("jobcards");
  try {
    // No UI and no in-memory user in a background wake: recover the identity from the phone's store.
    const store = await getJobCardStore();
    const sub = await store.getMeta("userSub");
    if (sub) {
      const name = (await store.getMeta("userName")) ?? "";
      const email = normEmail(await store.getMeta("userEmail")) ?? undefined;
      setJobCardUser({ sub, name, email });
    }
    const result = interpretOutcome(await requestSyncDetailed());
    await finishBackgroundRun(runId, {
      outcome: result.outcome,
      sent: result.sent,
      failedSends: result.failedSends,
      blocked: result.blocked,
      pulledItems: result.pulledItems,
      error: result.error,
    });
    return result.failed
      ? BackgroundTask.BackgroundTaskResult.Failed
      : BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.warn("[jobcards] background sync failed:", e);
    await finishBackgroundRun(runId, { outcome: "error", error });
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Register the task once, after the user signs in. Safe to call repeatedly. */
export async function registerJobCardBackgroundSync(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TASK_NAME)) return;
    await BackgroundTask.registerTaskAsync(TASK_NAME, {
      minimumInterval: MIN_INTERVAL_MINUTES,
    });
  } catch (e) {
    console.warn("[jobcards] could not register background sync:", e);
  }
}

/** Remove the task on sign-out. Safe to call when it was never registered. */
export async function unregisterJobCardBackgroundSync(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TASK_NAME))
      await BackgroundTask.unregisterTaskAsync(TASK_NAME);
  } catch (e) {
    console.warn("[jobcards] could not unregister background sync:", e);
  }
}
