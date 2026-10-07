// src/lib/haptics.ts
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const fire = (fn: () => Promise<void>) => {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  fn().catch(() => {});
};

export const haptics = {
  /** A routine tap — button presses, tab switches, toggles. */
  tap: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),

  /** A more deliberate action — submitting a form, confirming a dialog. */
  action: () =>
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),

  /** Something succeeded — inspection submitted, save completed. */
  success: () =>
    fire(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    ),

  /** Something needs attention but isn't a failure — a validation nudge. */
  warning: () =>
    fire(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    ),

  /** Something failed — a submit error, a network failure. */
  error: () =>
    fire(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    ),

  /** A destructive confirmation — delete, remove, sign out. */
  destructiveConfirm: () =>
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
};
