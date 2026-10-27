// hooks/usePushNotifications.ts
import { client } from "@/src/amplify";
import {
  alertBody,
  alertKey,
  alertTitle,
  cardsFromWork,
  currentAlertKeys,
  freshJobCardAlerts,
  isJobCardAlert,
  jobCardAlertsToClear,
} from "@/src/jobcards/alerts";
import { getWorkItemState } from "@/src/jobcards/api";
import { getJobCardUser, subscribeJobCards } from "@/src/jobcards/controller";
import { normEmail } from "@/src/jobcards/people";
import { getJobCardStore } from "@/src/jobcards/sqliteDriver";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

const TOKEN_CACHE_KEY = (uid: string) => `push:token:${uid}`;
const NOTIF_CACHE_KEY = (uid: string) => `push:notifications:${uid}`;
const MAX_STORED = 50;
const TOKEN_SAVED_KEY = (uid: string) => `push:token-saved:${uid}`;
const JC_ALERTED_KEY = (uid: string) => `push:jc-alerted-cards:${uid}`; // job cards announced (per assignment)
const JC_DONE_KEY = (uid: string) => `push:jc-done:${uid}`;

const LIST_PUSH_TOKENS = `
  query PushTokensByUser($userId: String!) {
    pushTokensByUser(userId: $userId, limit: 50) {
      items {
        token
      }
    }
  }
`;

const CREATE_OR_UPDATE_PUSH_TOKEN = `
  mutation CreatePushToken($input: CreatePushTokenInput!) {
    createPushToken(input: $input) {
      id
      userId
      token
      platform
    }
  }
`;

Notifications.setNotificationHandler({
  handleNotification: async () => {
    const behavior: any = {
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
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
  const registeredRef = useRef(false);
  const notifRef = useRef<InAppNotification[]>([]);
  notifRef.current = notifications;

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
    async (token: string): Promise<boolean> => {
      try {
        const existing: any = await client.graphql({
          query: LIST_PUSH_TOKENS,
          variables: { userId },
          authMode: "userPool",
        });
        const have = (existing?.data?.pushTokensByUser?.items ?? []).some(
          (t: any) => t?.token === token,
        );
        if (!have) {
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
        }
        return true;
      } catch (e) {
        console.warn("[push] could not save the push token:", e);
        return false;
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
      const saved = await storeTokenRemotely(token);
      if (saved) await AsyncStorage.setItem(TOKEN_SAVED_KEY(userId), token);
      else await AsyncStorage.removeItem(TOKEN_SAVED_KEY(userId));
      return token;
    } catch (e: any) {
      setError(e?.message ?? "Failed to register for notifications");
      return null;
    } finally {
      setRegistering(false);
    }
  }, [userId, storeTokenRemotely]);

  useEffect(() => {
    if (!userId || userId === "anonymous") return;
    if (registeredRef.current) return;
    registeredRef.current = true;

    if (Platform.OS === "android") {
      void Notifications.setNotificationChannelAsync("jobcards", {
        name: "Job cards",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1A1A1A",
      }).catch(() => {});
    }

    const ensureRegistered = async () => {
      const cached = await AsyncStorage.getItem(TOKEN_CACHE_KEY(userId));
      const saved = await AsyncStorage.getItem(TOKEN_SAVED_KEY(userId));
      if (cached) setExpoPushToken(cached);
      if (!cached || saved !== cached) await registerForPushNotifications();
    };
    const registerTimer = setTimeout(() => void ensureRegistered(), 2500);
    const appSub = AppState.addEventListener("change", (st) => {
      if (st === "active") void ensureRegistered();
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
      clearTimeout(registerTimer);
      appSub.remove();
      notificationListener.current?.remove();
      responseListener.current?.remove();
      registeredRef.current = false;
    };
  }, [userId]);

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
        // one alert per job card: the push and the one this phone makes itself must not both show
        const haveCard = new Set(
          prev
            .filter((n) => isJobCardAlert(n.data))
            .map((n) => n.data!.jobCardId),
        );
        const fresh = incoming.filter(
          (n) =>
            !haveId.has(n.id) &&
            !(n.data?.workItemId && haveWork.has(n.data.workItemId)) &&
            !(isJobCardAlert(n.data) && haveCard.has(n.data!.jobCardId)),
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
        const doneRaw = await AsyncStorage.getItem(JC_DONE_KEY(userId));
        const done = new Set<string>(doneRaw ? JSON.parse(doneRaw) : []);
        const live = presented.filter((n) => {
          const wid = (n.request.content.data as any)?.workItemId;
          if (wid && done.has(wid)) {
            Notifications.dismissNotificationAsync(n.request.identifier).catch(
              () => {},
            );
            return false;
          }
          return true;
        });
        add(
          live.map((n) => ({
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

        const doneRaw = await AsyncStorage.getItem(JC_DONE_KEY(userId));
        const done = new Set<string>(doneRaw ? JSON.parse(doneRaw) : []);
        let doneChanged = false;
        for (const w of items)
          if (w.localState !== "PENDING" && !done.has(w.id)) {
            done.add(w.id);
            doneChanged = true;
          }
        if (doneChanged)
          await AsyncStorage.setItem(
            JC_DONE_KEY(userId),
            JSON.stringify([...done].slice(-300)),
          );

        if (await store.getMeta("lastPullAt")) {
          const pending = new Set(
            items.filter((w) => w.localState === "PENDING").map((w) => w.id),
          );
          const present = new Set(items.map((w) => w.id));
          const gone = notifRef.current.filter(
            (n) =>
              n.data?.type === "jobcard-assigned" &&
              n.data.workItemId &&
              !pending.has(n.data.workItemId),
          );

          const verdict = new Map<string, "finished" | "removed" | "unknown">();
          for (const n of gone) {
            const wid: string = n.data!.workItemId;
            if (verdict.has(wid)) continue;
            if (present.has(wid) || done.has(wid)) {
              verdict.set(wid, "finished");
              continue;
            }
            try {
              const st = await getWorkItemState(wid);
              // work items are no longer assigned per person, so "someone else's" is never a reason to remove it
              verdict.set(
                wid,
                !st
                  ? "removed"
                  : st.status === "SUBMITTED"
                    ? "finished"
                    : "unknown",
              );
            } catch {
              verdict.set(wid, "unknown");
            }
          }

          try {
            for (const n of await Notifications.getPresentedNotificationsAsync()) {
              const d = n.request.content.data as any;
              const v = d?.workItemId ? verdict.get(d.workItemId) : undefined;
              if (
                d?.type === "jobcard-assigned" &&
                (v === "finished" || v === "removed")
              )
                await Notifications.dismissNotificationAsync(
                  n.request.identifier,
                );
            }
          } catch {}

          if (!stopped && [...verdict.values()].some((v) => v !== "unknown")) {
            setNotifications((prev) => {
              const decided = (n: InAppNotification) => {
                const v = n.data?.workItemId
                  ? verdict.get(n.data.workItemId)
                  : undefined;
                return n.data?.type === "jobcard-assigned" &&
                  (v === "finished" || v === "removed")
                  ? v
                  : null;
              };
              const removed: InAppNotification[] = prev
                .filter((n) => decided(n) === "removed")
                .map((n) => ({
                  id: `jc-removed-${n.data!.workItemId}`,
                  title: "Work removed",
                  body: n.body,
                  data: {
                    type: "jobcard-removed",
                    workItemId: n.data!.workItemId,
                  },
                  receivedAt: new Date(),
                  read: false,
                }));
              const updated = [
                ...removed,
                ...prev.filter((n) => !decided(n)),
              ].sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
              const stored: StoredNotification[] = updated
                .slice(0, MAX_STORED)
                .map((n) => ({ ...n, receivedAt: n.receivedAt.toISOString() }));
              AsyncStorage.setItem(
                NOTIF_CACHE_KEY(userId),
                JSON.stringify(stored),
              ).catch(() => {});
              return updated;
            });
          }
        }

        // ----- alerts are per JOB CARD: "New Jc : <number>" -----
        const me = { ids: new Set([u.sub]), email: normEmail(u.email) };
        const cards = cardsFromWork(items, me);

        // clear the alerts of job cards that are closed or have no work left to do
        const clear = new Set(
          jobCardAlertsToClear(
            notifRef.current,
            cards,
            await store.getMeta("lastPullAt"),
          ),
        );
        if (clear.size > 0 && !stopped) {
          const clearedCards = new Set(
            notifRef.current
              .filter((n) => clear.has(n.id))
              .map((n) => n.data!.jobCardId),
          );
          try {
            for (const n of await Notifications.getPresentedNotificationsAsync()) {
              const d = n.request.content.data as any;
              if (isJobCardAlert(d) && clearedCards.has(d.jobCardId))
                await Notifications.dismissNotificationAsync(
                  n.request.identifier,
                );
            }
          } catch {}
          setNotifications((prev) => {
            const updated = prev.filter(
              (n) =>
                !(
                  clear.has(n.id) ||
                  (isJobCardAlert(n.data) &&
                    clearedCards.has(n.data!.jobCardId))
                ),
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
        }

        // announce job cards newly assigned to me
        const raw = await AsyncStorage.getItem(JC_ALERTED_KEY(userId));
        const seen = new Set<string>(raw ? JSON.parse(raw) : []);
        if (raw === null) {
          // first run: what is already assigned to me is remembered quietly, not announced
          await AsyncStorage.setItem(
            JC_ALERTED_KEY(userId),
            JSON.stringify(currentAlertKeys(cards)),
          );
          return;
        }
        const fresh = freshJobCardAlerts(cards, seen);
        if (fresh.length === 0) return;
        add(
          fresh.map((c: any) => ({
            id: `jc-${c.jobCardId}`,
            title: alertTitle(c.jcNumber),
            body: alertBody(c.customerName),
            data: { type: "jobcard-assigned", jobCardId: c.jobCardId },
            receivedAt: c.assignedAt ? new Date(c.assignedAt) : new Date(),
            read: false,
          })),
        );
        for (const c of fresh) seen.add(alertKey(c));
        await AsyncStorage.setItem(
          JC_ALERTED_KEY(userId),
          JSON.stringify([...seen].slice(-300)),
        );
      } catch {}
    };

    const firstCheck = setTimeout(() => {
      void importDelivered();
      void alertNewWork();
    }, 1500);
    const unsubJc = subscribeJobCards(() => void alertNewWork());
    const app = AppState.addEventListener("change", (st) => {
      if (st === "active") {
        void importDelivered();
        void alertNewWork();
      }
    });
    return () => {
      stopped = true;
      clearTimeout(firstCheck);
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
