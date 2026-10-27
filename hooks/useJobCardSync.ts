// hooks/useJobCardSync.ts
// Keeps job cards in step with the server in the background: when the app opens, when the signal comes back,
// when the app returns to the foreground, and every minute while it is open. Mount it once, for a signed-in user.
import { requestSync, startJobCards } from "@/src/jobcards/controller";
import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { AppState } from "react-native";

const EVERY_MS = 60_000;

export function useJobCardSync(
  user: { sub: string; name: string; email?: string } | null,
) {
  const sub = user?.sub;
  const name = user?.name ?? "";
  const email = user?.email;

  useEffect(() => {
    if (!sub) return;
    let stopped = false;
    const startTimer = setTimeout(() => {
      void startJobCards({ sub, name, email }).then(() => {
        if (!stopped) void requestSync();
      });
    }, 1500);

    // signal comes back
    let wasOnline = true;
    const unsubNet = NetInfo.addEventListener((s) => {
      const online = !!s.isConnected && s.isInternetReachable !== false;
      if (online && !wasOnline) void requestSync();
      wasOnline = online;
    });
    // back to the app
    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active") void requestSync();
    });
    // and regularly while it is open
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void requestSync();
    }, EVERY_MS);

    return () => {
      stopped = true;
      clearTimeout(startTimer);
      unsubNet();
      appSub.remove();
      clearInterval(timer);
    };
  }, [sub, name, email]);
}
