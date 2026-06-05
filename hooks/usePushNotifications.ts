// hooks/usePushNotifications.ts
import { client } from "@/src/amplify";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

const TOKEN_CACHE_KEY = (uid: string) => `push:token:${uid}`;

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

// ── Fix: use shouldShowBanner + shouldShowList (shouldShowAlert is deprecated) ─
Notifications.setNotificationHandler({
  handleNotification:
    async (): Promise<Notifications.NotificationBehavior> => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
});

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  receivedAt: Date;
  read: boolean;
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
          authMode: "apiKey",
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

  useEffect(() => {
    if (!userId || userId === "anonymous") return;

    AsyncStorage.getItem(TOKEN_CACHE_KEY(userId)).then((cached) => {
      if (cached) setExpoPushToken(cached);
      else registerForPushNotifications();
    });

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const { title, body, data } = notification.request.content;
        setNotifications((prev) => [
          {
            id: notification.request.identifier,
            title: title ?? "Notification",
            body: body ?? "",
            data: data as Record<string, any>,
            receivedAt: new Date(),
            read: false,
          },
          ...prev,
        ]);
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
    };
  }, [userId, registerForPushNotifications]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

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
