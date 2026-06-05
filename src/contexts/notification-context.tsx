// src/contexts/notification-context.tsx
// Thin context that holds push notification state so tab badge count
// can be read from the layout without prop-drilling.
import {
    InAppNotification,
    usePushNotifications,
} from "@/hooks/usePushNotifications";
import { createContext, ReactNode, useContext } from "react";

interface NotificationContextValue {
  notifications: InAppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  expoPushToken: string | null;
  registering: boolean;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  markRead: () => {},
  markAllRead: () => {},
  clearNotifications: () => {},
  expoPushToken: null,
  registering: false,
});

export function NotificationProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const value = usePushNotifications(userId);
  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
