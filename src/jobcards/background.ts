// src/jobcards/background.ts
// The OS-level background task. It wakes up (Android WorkManager / iOS BGTaskScheduler) roughly every 15 minutes
// while the app is backgrounded but NOT force-quit, and calls requestSync() — the same function the foreground uses.
//
// Limits you cannot beat:
//   - If the user swipes the app away from recents, the OS stops the task until the app is opened again.
//   - On iOS, the OS decides when (or whether) to run it. There is no guarantee of a fixed interval.
// Both are platform rules, not something this file can change.
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { requestSync, setJobCardUser } from "./controller";
import { normEmail } from "./people";
import { getJobCardStore } from "./sqliteDriver";

const TASK_NAME = "jobcards-sync";
/** Android WorkManager will not run a periodic task more often than this. */
const MIN_INTERVAL_MINUTES = 15;

// 1. Define the task in global scope (before React mounts). This block runs at module load, once.
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    // No UI and no in-memory user in a background wake: recover the identity from the phone's store.
    const store = await getJobCardStore();
    const sub = await store.getMeta("userSub");
    if (!sub) {
      // Nobody signed in: nothing to send or pull.
      return BackgroundTask.BackgroundTaskResult.Success;
    }
    const name = (await store.getMeta("userName")) ?? "";
    const email = normEmail(await store.getMeta("userEmail")) ?? undefined;
    setJobCardUser({ sub, name, email });
    await requestSync();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    console.warn("[jobcards] background sync failed:", e);
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
