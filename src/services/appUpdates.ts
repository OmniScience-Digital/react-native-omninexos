// src/services/appUpdates.ts
//
// OTA (over-the-air) JS bundle updates via EAS Update. Lets us ship a bug
// fix or small feature by publishing an update, instead of a full app store
// release + waiting for users to manually update. Does NOT cover native
// code changes (a new native module, a new permission) — those still need a
// real store release.
//
// SETUP REQUIRED before this does anything: app.json's `updates.url` and
// `extra.eas.projectId` both have placeholder values
// ("REPLACE_WITH_YOUR_EAS_PROJECT_ID") — run `eas init` (or
// `eas update:configure`) to get a real project ID, or paste it in directly
// if the project already exists in your EAS account. Until that's done,
// `Updates.isEnabled` is false and everything here safely no-ops.
import NetInfo from "@react-native-community/netinfo";
import * as Updates from "expo-updates";

export interface UpdateCheckOutcome {
  status:
    | "fetched" // a new update was found and downloaded; call applyPendingUpdate() when ready
    | "not-available"
    | "skipped" // dev build, OTA not configured yet, or offline
    | "error";
  error?: unknown;
}

/**
 * Checks for a published update and, if one exists, downloads it. Does NOT
 * reload the app — call `applyPendingUpdate()` (e.g. from a user-visible
 * "Restart to update" prompt) when ready to switch to it, so an update never
 * interrupts someone mid-inspection.
 */
export async function checkForUpdate(): Promise<UpdateCheckOutcome> {
  // Never in dev/Expo Go, and never if this build has no real EAS project
  // configured yet (see the setup note above).
  if (__DEV__ || !Updates.isEnabled) {
    return { status: "skipped" };
  }

  // Offline-first app: don't let an update check hang or fail loudly while
  // the device has no signal. A missed check just means we try again next
  // launch/foreground.
  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    return { status: "skipped" };
  }

  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) {
      return { status: "not-available" };
    }

    await Updates.fetchUpdateAsync();
    return { status: "fetched" };
  } catch (error) {
    // A failed check/fetch (e.g. connection dropped mid-download) should
    // never crash or block the app — just report it and move on. The app
    // keeps running on its current, working bundle.
    console.warn("[appUpdates] check/fetch failed:", error);
    return { status: "error", error };
  }
}

/** Reloads the app onto the update fetched by checkForUpdate(). */
export async function applyPendingUpdate(): Promise<void> {
  if (!Updates.isEnabled) return;
  await Updates.reloadAsync();
}
