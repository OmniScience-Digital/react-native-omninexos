// // hooks/usePushNotifications.ts
// import { client } from "@/src/amplify";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import Constants from "expo-constants";
// import * as Device from "expo-device";
// import * as Notifications from "expo-notifications";
// import { useCallback, useEffect, useRef, useState } from "react";
// import { Platform } from "react-native";

// const TOKEN_CACHE_KEY = (uid: string) => `push:token:${uid}`;
// // Persist up to 50 notifications across app restarts
// const NOTIF_CACHE_KEY = (uid: string) => `push:notifications:${uid}`;
// const MAX_STORED = 50;

// const CREATE_OR_UPDATE_PUSH_TOKEN = /* GraphQL */ `
//   mutation CreatePushToken($input: CreatePushTokenInput!) {
//     createPushToken(input: $input) {
//       id
//       userId
//       token
//       platform
//     }
//   }
// `;

// // Support both old (shouldShowAlert) and new (shouldShowBanner/shouldShowList)
// // expo-notifications API shapes so the app doesn't crash on either version.
// Notifications.setNotificationHandler({
//   handleNotification: async () => {
//     const behavior: any = {
//       shouldPlaySound: true,
//       shouldSetBadge: true,
//     };
//     // expo-notifications >=0.29 uses shouldShowBanner + shouldShowList
//     // expo-notifications <0.29  uses shouldShowAlert
//     // Include all three so it works regardless of installed version.
//     behavior.shouldShowAlert = true;
//     behavior.shouldShowBanner = true;
//     behavior.shouldShowList = true;
//     return behavior;
//   },
// });

// export interface InAppNotification {
//   id: string;
//   title: string;
//   body: string;
//   data?: Record<string, any>;
//   receivedAt: Date;
//   read: boolean;
// }

// // Serialised form stored in AsyncStorage (Date → ISO string)
// interface StoredNotification extends Omit<InAppNotification, "receivedAt"> {
//   receivedAt: string;
// }

// function hydrate(stored: StoredNotification): InAppNotification {
//   return { ...stored, receivedAt: new Date(stored.receivedAt) };
// }

// export function usePushNotifications(userId: string) {
//   const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
//   const [notifications, setNotifications] = useState<InAppNotification[]>([]);
//   const [permissionStatus, setPermissionStatus] = useState<
//     "undetermined" | "granted" | "denied"
//   >("undetermined");
//   const [registering, setRegistering] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const notificationListener = useRef<Notifications.EventSubscription | null>(
//     null,
//   );
//   const responseListener = useRef<Notifications.EventSubscription | null>(null);
//   // Guard: only attempt registration once per userId mount
//   const registeredRef = useRef(false);

//   // ── Persist helpers ──────────────────────────────────────────────────────
//   const persistNotifications = useCallback(
//     (notifs: InAppNotification[]) => {
//       if (!userId || userId === "anonymous") return;
//       const stored: StoredNotification[] = notifs
//         .slice(0, MAX_STORED)
//         .map((n) => ({ ...n, receivedAt: n.receivedAt.toISOString() }));
//       AsyncStorage.setItem(
//         NOTIF_CACHE_KEY(userId),
//         JSON.stringify(stored),
//       ).catch(() => {});
//     },
//     [userId],
//   );

//   // ── Load persisted notifications on mount ────────────────────────────────
//   useEffect(() => {
//     if (!userId || userId === "anonymous") return;
//     AsyncStorage.getItem(NOTIF_CACHE_KEY(userId))
//       .then((raw) => {
//         if (!raw) return;
//         const stored: StoredNotification[] = JSON.parse(raw);
//         setNotifications(stored.map(hydrate));
//       })
//       .catch(() => {});
//   }, [userId]);

//   const storeTokenRemotely = useCallback(
//     async (token: string): Promise<void> => {
//       try {
//         await client.graphql({
//           query: CREATE_OR_UPDATE_PUSH_TOKEN,
//           variables: {
//             input: {
//               userId,
//               token,
//               platform: Platform.OS,
//               updatedAt: new Date().toISOString(),
//             },
//           },
//           authMode: "apiKey",
//         });
//       } catch {
//         // Non-critical
//       }
//     },
//     [userId],
//   );

//   const registerForPushNotifications = useCallback(async (): Promise<
//     string | null
//   > => {
//     if (!Device.isDevice) {
//       setError("Push notifications require a physical device");
//       return null;
//     }
//     setRegistering(true);
//     setError(null);
//     try {
//       const { status: existingStatus } =
//         await Notifications.getPermissionsAsync();
//       let finalStatus = existingStatus;

//       if (existingStatus !== "granted") {
//         const { status } = await Notifications.requestPermissionsAsync();
//         finalStatus = status;
//       }

//       setPermissionStatus(finalStatus as "undetermined" | "granted" | "denied");

//       if (finalStatus !== "granted") {
//         setError("Push notification permission not granted");
//         return null;
//       }

//       if (Platform.OS === "android") {
//         await Notifications.setNotificationChannelAsync("default", {
//           name: "Default",
//           importance: Notifications.AndroidImportance.MAX,
//           vibrationPattern: [0, 250, 250, 250],
//           lightColor: "#1A1A1A",
//         });
//         await Notifications.setNotificationChannelAsync("attendance", {
//           name: "Attendance",
//           importance: Notifications.AndroidImportance.HIGH,
//           vibrationPattern: [0, 250, 250, 250],
//         });
//       }

//       const projectId =
//         Constants?.expoConfig?.extra?.eas?.projectId ??
//         (Constants as any)?.easConfig?.projectId;

//       const tokenResponse = await Notifications.getExpoPushTokenAsync(
//         projectId ? { projectId } : undefined,
//       );
//       const token = tokenResponse.data;

//       setExpoPushToken(token);
//       await AsyncStorage.setItem(TOKEN_CACHE_KEY(userId), token);
//       await storeTokenRemotely(token);
//       return token;
//     } catch (e: any) {
//       setError(e?.message ?? "Failed to register for notifications");
//       return null;
//     } finally {
//       setRegistering(false);
//     }
//   }, [userId, storeTokenRemotely]);

//   // ── Register token & attach listeners — runs once per userId ────────────
//   useEffect(() => {
//     if (!userId || userId === "anonymous") return;
//     if (registeredRef.current) return;
//     registeredRef.current = true;

//     // Load cached token or register fresh — does NOT re-run on every render
//     AsyncStorage.getItem(TOKEN_CACHE_KEY(userId)).then((cached) => {
//       if (cached) setExpoPushToken(cached);
//       else registerForPushNotifications();
//     });

//     notificationListener.current =
//       Notifications.addNotificationReceivedListener((notification) => {
//         const { title, body, data } = notification.request.content;
//         const newNotif: InAppNotification = {
//           id: notification.request.identifier,
//           title: title ?? "Notification",
//           body: body ?? "",
//           data: data as Record<string, any>,
//           receivedAt: new Date(),
//           read: false,
//         };
//         setNotifications((prev) => {
//           const updated = [newNotif, ...prev];
//           // Persist immediately so the notification survives a restart
//           const stored: StoredNotification[] = updated
//             .slice(0, MAX_STORED)
//             .map((n) => ({ ...n, receivedAt: n.receivedAt.toISOString() }));
//           AsyncStorage.setItem(
//             NOTIF_CACHE_KEY(userId),
//             JSON.stringify(stored),
//           ).catch(() => {});
//           return updated;
//         });
//       });

//     responseListener.current =
//       Notifications.addNotificationResponseReceivedListener((response) => {
//         const id = response.notification.request.identifier;
//         setNotifications((prev) =>
//           prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
//         );
//       });

//     return () => {
//       notificationListener.current?.remove();
//       responseListener.current?.remove();
//       registeredRef.current = false;
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [userId]); // intentionally exclude registerForPushNotifications to avoid loop

//   const markAllRead = useCallback(() => {
//     setNotifications((prev) => {
//       const updated = prev.map((n) => ({ ...n, read: true }));
//       persistNotifications(updated);
//       return updated;
//     });
//   }, [persistNotifications]);

//   const markRead = useCallback(
//     (id: string) => {
//       setNotifications((prev) => {
//         const updated = prev.map((n) =>
//           n.id === id ? { ...n, read: true } : n,
//         );
//         persistNotifications(updated);
//         return updated;
//       });
//     },
//     [persistNotifications],
//   );

//   const clearNotifications = useCallback(() => {
//     setNotifications([]);
//     if (userId && userId !== "anonymous") {
//       AsyncStorage.removeItem(NOTIF_CACHE_KEY(userId)).catch(() => {});
//     }
//   }, [userId]);

//   const unreadCount = notifications.filter((n) => !n.read).length;

//   return {
//     expoPushToken,
//     notifications,
//     unreadCount,
//     permissionStatus,
//     registering,
//     error,
//     registerForPushNotifications,
//     markRead,
//     markAllRead,
//     clearNotifications,
//   };
// }

// hooks/usePushNotifications.ts
import { client } from "@/src/amplify";
import { getJobCardUser, subscribeJobCards } from "@/src/jobcards/controller";
import { getJobCardStore } from "@/src/jobcards/sqliteDriver";
import { WORK_ITEM_LABEL } from "@/src/jobcards/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

const TOKEN_CACHE_KEY = (uid: string) => `push:token:${uid}`;
// Persist up to 50 notifications across app restarts
const NOTIF_CACHE_KEY = (uid: string) => `push:notifications:${uid}`;
const MAX_STORED = 50;
// ids of job card work we have already raised an alert for (so each assignment alerts once)
const JC_ALERTED_KEY = (uid: string) => `push:jc-alerted:${uid}`;

const CREATE_OR_UPDATE_PUSH_TOKEN = /* GraphQL */ `
  mutation CreatePushToken($input: CreatePushTokenInput!) {
    createPushToken(input: $input) {
      id
      userId
      token
      platform
    }
  }
`;

// Support both old (shouldShowAlert) and new (shouldShowBanner/shouldShowList)
// expo-notifications API shapes so the app doesn't crash on either version.
Notifications.setNotificationHandler({
  handleNotification: async () => {
    const behavior: any = {
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
    // expo-notifications >=0.29 uses shouldShowBanner + shouldShowList
    // expo-notifications <0.29  uses shouldShowAlert
    // Include all three so it works regardless of installed version.
    behavior.shouldShowAlert = true;
    behavior.shouldShowBanner = true;
    behavior.shouldShowList = true;
    return behavior;
  },
});

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  receivedAt: Date;
  read: boolean;
}

// Serialised form stored in AsyncStorage (Date → ISO string)
interface StoredNotification extends Omit<InAppNotification, "receivedAt"> {
  receivedAt: string;
}

function hydrate(stored: StoredNotification): InAppNotification {
  return { ...stored, receivedAt: new Date(stored.receivedAt) };
}

export function usePushNotifications(userId: string) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<
    "undetermined" | "granted" | "denied"
  >("undetermined");
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notificationListener = useRef<Notifications.EventSubscription | null>(
    null,
  );
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  // Guard: only attempt registration once per userId mount
  const registeredRef = useRef(false);

  // ── Persist helpers ──────────────────────────────────────────────────────
  const persistNotifications = useCallback(
    (notifs: InAppNotification[]) => {
      if (!userId || userId === "anonymous") return;
      const stored: StoredNotification[] = notifs
        .slice(0, MAX_STORED)
        .map((n) => ({ ...n, receivedAt: n.receivedAt.toISOString() }));
      AsyncStorage.setItem(
        NOTIF_CACHE_KEY(userId),
        JSON.stringify(stored),
      ).catch(() => {});
    },
    [userId],
  );

  // ── Load persisted notifications on mount ────────────────────────────────
  useEffect(() => {
    if (!userId || userId === "anonymous") return;
    AsyncStorage.getItem(NOTIF_CACHE_KEY(userId))
      .then((raw) => {
        if (!raw) return;
        const stored: StoredNotification[] = JSON.parse(raw);
        setNotifications(stored.map(hydrate));
      })
      .catch(() => {});
  }, [userId]);

  const storeTokenRemotely = useCallback(
    async (token: string): Promise<void> => {
      try {
        await client.graphql({
          query: CREATE_OR_UPDATE_PUSH_TOKEN,
          variables: {
            input: {
              userId,
              token,
              platform: Platform.OS,
              updatedAt: new Date().toISOString(),
            },
          },
          authMode: "userPool",
        });
      } catch {
        // Non-critical
      }
    },
    [userId],
  );

  const registerForPushNotifications = useCallback(async (): Promise<
    string | null
  > => {
    if (!Device.isDevice) {
      setError("Push notifications require a physical device");
      return null;
    }
    setRegistering(true);
    setError(null);
    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      setPermissionStatus(finalStatus as "undetermined" | "granted" | "denied");

      if (finalStatus !== "granted") {
        setError("Push notification permission not granted");
        return null;
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#1A1A1A",
        });
        await Notifications.setNotificationChannelAsync("attendance", {
          name: "Attendance",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        (Constants as any)?.easConfig?.projectId;

      const tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      const token = tokenResponse.data;

      setExpoPushToken(token);
      await AsyncStorage.setItem(TOKEN_CACHE_KEY(userId), token);
      await storeTokenRemotely(token);
      return token;
    } catch (e: any) {
      setError(e?.message ?? "Failed to register for notifications");
      return null;
    } finally {
      setRegistering(false);
    }
  }, [userId, storeTokenRemotely]);

  // ── Register token & attach listeners — runs once per userId ────────────
  useEffect(() => {
    if (!userId || userId === "anonymous") return;
    if (registeredRef.current) return;
    registeredRef.current = true;

    // Load cached token or register fresh — does NOT re-run on every render
    AsyncStorage.getItem(TOKEN_CACHE_KEY(userId)).then((cached) => {
      if (cached) setExpoPushToken(cached);
      else registerForPushNotifications();
    });

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const { title, body, data } = notification.request.content;
        const newNotif: InAppNotification = {
          id: notification.request.identifier,
          title: title ?? "Notification",
          body: body ?? "",
          data: data as Record<string, any>,
          receivedAt: new Date(),
          read: false,
        };
        setNotifications((prev) => {
          const updated = [newNotif, ...prev];
          // Persist immediately so the notification survives a restart
          const stored: StoredNotification[] = updated
            .slice(0, MAX_STORED)
            .map((n) => ({ ...n, receivedAt: n.receivedAt.toISOString() }));
          AsyncStorage.setItem(
            NOTIF_CACHE_KEY(userId),
            JSON.stringify(stored),
          ).catch(() => {});
          return updated;
        });
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const id = response.notification.request.identifier;
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
        );
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
      registeredRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // intentionally exclude registerForPushNotifications to avoid loop

  // ── Alerts that arrived while the app was CLOSED ─────────────────────────
  // The phone shows the push in its tray, but the in-app listener only fires while the app runs.
  // On start and whenever the app comes back, copy what the tray holds into the Alerts tab.
  // Also raise an alert for any job card work that sync found assigned to this user (survives the
  // tray being cleared, and covers a push that never arrived).
  useEffect(() => {
    if (!userId || userId === "anonymous") return;
    let stopped = false;

    const add = (incoming: InAppNotification[]) => {
      if (stopped || incoming.length === 0) return;
      setNotifications((prev) => {
        const haveId = new Set(prev.map((n) => n.id));
        const haveWork = new Set(
          prev.map((n) => n.data?.workItemId).filter(Boolean),
        );
        const fresh = incoming.filter(
          (n) =>
            !haveId.has(n.id) &&
            !(n.data?.workItemId && haveWork.has(n.data.workItemId)),
        );
        if (fresh.length === 0) return prev;
        const updated = [...fresh, ...prev].sort(
          (a, b) => b.receivedAt.getTime() - a.receivedAt.getTime(),
        );
        const stored: StoredNotification[] = updated
          .slice(0, MAX_STORED)
          .map((n) => ({ ...n, receivedAt: n.receivedAt.toISOString() }));
        AsyncStorage.setItem(
          NOTIF_CACHE_KEY(userId),
          JSON.stringify(stored),
        ).catch(() => {});
        return updated;
      });
    };

    const importDelivered = async () => {
      try {
        const presented = await Notifications.getPresentedNotificationsAsync();
        add(
          presented.map((n) => ({
            id: n.request.identifier,
            title: n.request.content.title ?? "Notification",
            body: n.request.content.body ?? "",
            data: n.request.content.data as Record<string, any>,
            receivedAt: new Date(n.date),
            read: false,
          })),
        );
      } catch {}
    };

    const alertNewWork = async () => {
      try {
        const u = getJobCardUser();
        if (!u) return;
        const store = await getJobCardStore();
        const items = await store.listMyWork(u.sub);
        const raw = await AsyncStorage.getItem(JC_ALERTED_KEY(userId));
        const seen = new Set<string>(raw ? JSON.parse(raw) : []);
        const open = items.filter((w) => w.localState === "PENDING");
        if (raw === null) {
          // first run on this phone: existing work is not "new", just remember it
          await AsyncStorage.setItem(
            JC_ALERTED_KEY(userId),
            JSON.stringify(open.map((w) => w.id)),
          );
          return;
        }
        const fresh = open.filter((w) => !seen.has(w.id));
        if (fresh.length === 0) return;
        add(
          fresh.map((w) => ({
            id: `jc-${w.id}`,
            title: "New job card work",
            body: `${WORK_ITEM_LABEL[w.moduleType]} - ${w.scaleName} (${w.jcNumber})`,
            data: {
              type: "jobcard-assigned",
              workItemId: w.id,
              jobCardId: w.jobCardId,
            },
            receivedAt: w.assignedAt ? new Date(w.assignedAt) : new Date(),
            read: false,
          })),
        );
        for (const w of fresh) seen.add(w.id);
        await AsyncStorage.setItem(
          JC_ALERTED_KEY(userId),
          JSON.stringify([...seen]),
        );
      } catch {}
    };

    void importDelivered();
    void alertNewWork();
    const unsubJc = subscribeJobCards(() => void alertNewWork());
    const app = AppState.addEventListener("change", (st) => {
      if (st === "active") {
        void importDelivered();
        void alertNewWork();
      }
    });
    return () => {
      stopped = true;
      unsubJc();
      app.remove();
    };
  }, [userId]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      persistNotifications(updated);
      return updated;
    });
  }, [persistNotifications]);

  const markRead = useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const updated = prev.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        );
        persistNotifications(updated);
        return updated;
      });
    },
    [persistNotifications],
  );

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    if (userId && userId !== "anonymous") {
      AsyncStorage.removeItem(NOTIF_CACHE_KEY(userId)).catch(() => {});
    }
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    expoPushToken,
    notifications,
    unreadCount,
    permissionStatus,
    registering,
    error,
    registerForPushNotifications,
    markRead,
    markAllRead,
    clearNotifications,
  };
}
