// src/contexts/clockin-context.tsx
//
// Shared ClockIn context — a single useClockIn instance lives here so that:
//   1. Both the Home tab and the Attendance tab read the same activeRecord.
//      An offline clock-in on Attendance immediately shows on Home.
//   2. After sync, calling refetchHistory() from anywhere refreshes both screens.
//
import { useClockIn } from "@/hooks/useClockIn";
import { useAuth } from "@/src/contexts/auth-context";
import React, { createContext, useContext } from "react";

type ClockInContextValue = ReturnType<typeof useClockIn>;

const ClockInContext = createContext<ClockInContextValue | undefined>(
  undefined,
);

export function ClockInProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = (user as any)?.sub ?? (user as any)?.username ?? "anonymous";
  const employeeName =
    (user as any)?.preferred_username ??
    (user as any)?.name ??
    (user as any)?.email?.split("@")[0] ??
    "Employee";

  const clockIn = useClockIn(userId, employeeName);

  return (
    <ClockInContext.Provider value={clockIn}>
      {children}
    </ClockInContext.Provider>
  );
}

export function useClockInContext(): ClockInContextValue {
  const ctx = useContext(ClockInContext);
  if (!ctx)
    throw new Error("useClockInContext must be used within ClockInProvider");
  return ctx;
}
