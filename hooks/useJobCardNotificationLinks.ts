// hooks/useJobCardNotificationLinks.ts
// Job card push notifications:
//  - tapping one opens that job card (or, for an older notification, its work item), also when the app was closed and
//    the tap launched it;
//  - one arriving while the app is open refreshes the list, so the new work shows up at once.
// Mount once for a signed-in user. It does not change the existing push setup in usePushNotifications.ts.
import { requestSync } from "@/src/jobcards/controller";
import { jobCardTargetFromData } from "@/src/jobcards/notifications";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

export function useJobCardNotificationLinks(enabled: boolean) {
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const open = (
      response: Notifications.NotificationResponse | null | undefined,
    ) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handled.current === id) return; // the same tap is never handled twice
      const target = jobCardTargetFromData(
        response.notification.request.content.data,
      );
      if (!target) return;
      handled.current = id;
      router.push({
        pathname: "/operations/jobcards",
        params: target.workItemId
          ? { workItem: target.workItemId }
          : { jobCard: target.jobCardId },
      });
      void Notifications.clearLastNotificationResponseAsync?.().catch?.(
        () => {},
      );
    };

    // Android needs the channel the server names in the push ("jobcards") to exist, or the sound/priority are lost
    if (Platform.OS === "android") {
      void Notifications.setNotificationChannelAsync("jobcards", {
        name: "Job cards",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
      }).catch(() => {});
    }

    // the app was launched by tapping a notification
    void Notifications.getLastNotificationResponseAsync()
      .then(open)
      .catch(() => {});

    const tapped = Notifications.addNotificationResponseReceivedListener(open);
    const arrived = Notifications.addNotificationReceivedListener((n) => {
      if (jobCardTargetFromData(n.request.content.data)) void requestSync();
    });
    return () => {
      tapped.remove();
      arrived.remove();
    };
  }, [enabled]);
}
