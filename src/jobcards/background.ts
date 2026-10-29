// src/jobcards/background.ts
// The OS-level background task. It wakes up (Android WorkManager / iOS BGTaskScheduler) roughly every 15 minutes
// while the app is backgrounded but NOT force-quit, and runs the same sync the foreground uses.
//
// Limits you cannot beat:
//   - If the user swipes the app away from recents, the OS stops the task until the app is opened again.
//   - On iOS, the OS decides when (or whether) to run it. There is no guarantee of a fixed interval.
// Both are platform rules, not something this file can change.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import {
  beginBackgroundRun,
  finishBackgroundRun,
  markBackgroundStep,
  recordRegistration,
} from "../sync/backgroundLog";
import { enterBackgroundRuntime } from "../sync/backgroundRuntime";
import { DeadlineError, withDeadline } from "../sync/deadline";
import { interpretOutcome } from "./backgroundOutcome";
import {
  getSyncActivity,
  requestSyncDetailed,
  setJobCardUser,
  setSyncTrace,
} from "./controller";
import { normEmail } from "./people";
import { getJobCardStore, setSkipDelays } from "./sqliteDriver";

// Keep this name unchanged: phones that already have the task registered keep working with no migration.
const TASK_NAME = "jobcards-sync";
/** Android WorkManager will not run a periodic task more often than this. It is a floor, not a schedule. */
const MIN_INTERVAL_MINUTES = 15;
/** A running sync that has started no call for this long is treated as frozen (the OS paused it) and replaced. */
const TAKE_OVER_IDLE_MS = 120_000;
/** How long the sync may take before the run gives up and says where it stopped (instead of hanging forever). */
export const backgroundDeadlines = {
  syncMs: 180_000,
};

// 1. Define the task in global scope (before React mounts). This block runs at module load, once.
//    IMPORTANT: this file must be imported from the app entry (index.js), not from a screen or layout, so the
//    definition exists when the OS wakes the app with no UI.
// If this build was made before expo-task-manager was added (the native side is missing), defining the task
// throws at load, which would take the whole app down before anything is drawn. The app is more useful without
// background sync than not opening at all, so the failure is logged and skipped. Registration below records
// the same problem on the debug screen.
try {
  TaskManager.defineTask(TASK_NAME, async () => {
    // Written before any work, so a run that is killed mid-way still leaves a "started, never finished" record.
    const runId = await beginBackgroundRun("jobcards");
    let lastStep = "starting";
    const mark = (step: string): Promise<void> => {
      lastStep = step;
      return markBackgroundStep(runId, step);
    };
    // Timers do not fire in a headless Android wake: no timer-based waits of our own, and timers driven by native
    // calls for the libraries we do not control (Amplify sleeps on a timer between request retries).
    setSkipDelays(true);
    const leaveBackgroundRuntime = enterBackgroundRuntime({
      tick: () => AsyncStorage.getItem("bg:tick"),
      note: (step) => void mark(step),
    });
    let expiry: { remove: () => void } | null = null;
    try {
      expiry = BackgroundTask.addExpirationListener(
        () => void mark("the operating system stopped the task"),
      );
    } catch {
      /* not available on this platform */
    }
    try {
      // No UI and no in-memory user in a background wake: recover the identity from the phone's store.
      await mark("opening-database");
      const store = await getJobCardStore();
      await mark("reading-user");
      const sub = await store.getMeta("userSub");
      if (sub) {
        const name = (await store.getMeta("userName")) ?? "";
        const email = normEmail(await store.getMeta("userEmail")) ?? undefined;
        setJobCardUser({ sub, name, email });
      }

      // A sync started in the foreground can be frozen by the OS when the app goes to the background. Waiting on it
      // would wait forever, so a sync that has gone quiet is replaced. One that is still working is left to finish.
      const activity = getSyncActivity();
      const idle = Math.round(activity.idleMs / 1000);
      const last = activity.lastStep || "nothing yet";
      await mark(
        !activity.running
          ? "syncing"
          : activity.idleMs > TAKE_OVER_IDLE_MS
            ? `replacing a frozen sync (quiet for ${idle}s, last: ${last})`
            : `waiting on a running sync (quiet for ${idle}s, last: ${last})`,
      );
      setSyncTrace((step) => void mark(step));
      const result = interpretOutcome(
        await withDeadline(
          requestSyncDetailed({ takeOverIfIdleMs: TAKE_OVER_IDLE_MS }),
          backgroundDeadlines.syncMs,
          "the sync",
        ),
      );
      // Say WHY sends failed, not just how many: the message each failed row stored.
      let rowErrors: string[] | undefined;
      if (result.failedSends > 0 || result.blocked > 0) {
        try {
          rowErrors = (await store.recentOutboxErrors(5)).map(
            (r) =>
              `${r.kind}, ${r.status}, attempt ${r.attempts}: ${r.lastError.slice(0, 200)}`,
          );
        } catch {
          /* the counts are still recorded */
        }
      }
      await finishBackgroundRun(runId, {
        outcome: result.outcome,
        sent: result.sent,
        failedSends: result.failedSends,
        blocked: result.blocked,
        pulledItems: result.pulledItems,
        error: result.error,
        rowErrors,
      });
      return result.failed
        ? BackgroundTask.BackgroundTaskResult.Failed
        : BackgroundTask.BackgroundTaskResult.Success;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.warn("[jobcards] background sync failed:", e);
      // A wait that ran out is its own outcome, with the last thing the run was doing: that is what to fix next.
      await finishBackgroundRun(
        runId,
        e instanceof DeadlineError
          ? { outcome: "timeout", error: `${error}. Last step: ${lastStep}` }
          : { outcome: "error", error },
      );
      return BackgroundTask.BackgroundTaskResult.Failed;
    } finally {
      try {
        expiry?.remove();
      } catch {
        /* ignore */
      }
      leaveBackgroundRuntime();
      setSyncTrace(null);
      setSkipDelays(false);
    }
  });
} catch (e) {
  console.warn("[jobcards] background task unavailable, skipping it:", e);
}

// Register and unregister run one at a time, in the order they were asked. Before this, the layout could ask to
// unregister (user not loaded yet) and register (user loaded) back to back; they overlapped, "already registered"
// was still true for the second call, and the task ended up unregistered.
let opChain: Promise<unknown> = Promise.resolve();
const oneAtATime = (fn: () => Promise<void>): Promise<void> => {
  const run = opChain.then(fn, fn);
  opChain = run.catch(() => undefined);
  return run;
};

/** Register the task once, after the user signs in. Safe to call repeatedly. */
export function registerJobCardBackgroundSync(): Promise<void> {
  return oneAtATime(async () => {
    let error: string | undefined;
    let status: number | undefined;
    try {
      status = await BackgroundTask.getStatusAsync();
      if (!(await TaskManager.isTaskRegisteredAsync(TASK_NAME))) {
        await BackgroundTask.registerTaskAsync(TASK_NAME, {
          minimumInterval: MIN_INTERVAL_MINUTES,
        });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      console.warn("[jobcards] could not register background sync:", e);
    }
    // Ask the OS side again rather than assuming the call worked.
    let registered = false;
    try {
      registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    } catch {
      /* leave false */
    }
    await recordRegistration({ action: "register", registered, status, error });
  });
}

/** Remove the task on sign-out. Safe to call when it was never registered. */
export function unregisterJobCardBackgroundSync(): Promise<void> {
  return oneAtATime(async () => {
    let error: string | undefined;
    try {
      if (await TaskManager.isTaskRegisteredAsync(TASK_NAME))
        await BackgroundTask.unregisterTaskAsync(TASK_NAME);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      console.warn("[jobcards] could not unregister background sync:", e);
    }
    await recordRegistration({
      action: "unregister",
      registered: false,
      error,
    });
  });
}

/** Live state for the debug screen: is the task registered with the OS right now, and is the OS allowing it? */
export async function getJobCardBackgroundState(): Promise<{
  registered: boolean | null;
  status: number | null;
}> {
  let registered: boolean | null = null;
  let status: number | null = null;
  try {
    registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  } catch {
    /* unknown */
  }
  try {
    status = await BackgroundTask.getStatusAsync();
  } catch {
    /* unknown */
  }
  return { registered, status };
}
