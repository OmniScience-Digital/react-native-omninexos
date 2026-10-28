// src/jobcards/backgroundOutcome.ts
// Turns "what the sync did" into (a) one honest line for the background-run log and (b) the result we report to the
// OS. Kept free of Expo imports so it can be unit-tested.
//
// The rule: report Failed only when something was actually attempted and went wrong. "Nobody is signed in" and
// "no signal" are normal for a background wake; they are recorded as their own outcomes, never as a fake "synced".
import type { SyncOutcome } from "./controller";

export type BackgroundOutcome =
  | "no-user" // nobody signed in on this phone
  | "offline" // the OS woke us but there was no usable connection
  | "synced" // ran cleanly
  | "partial" // ran, but at least one send failed or the pull failed (will be retried)
  | "error"; // the sync itself threw

export interface InterpretedOutcome {
  outcome: BackgroundOutcome;
  /** true → the task should return Failed to the OS; false → Success. */
  failed: boolean;
  sent: number;
  failedSends: number;
  blocked: number;
  pulledItems: number;
  error?: string;
}

export function interpretOutcome(o: SyncOutcome): InterpretedOutcome {
  const base = { sent: 0, failedSends: 0, blocked: 0, pulledItems: 0 };
  if (o.status === "no-user")
    return { ...base, outcome: "no-user", failed: false };
  if (o.status === "error")
    return { ...base, outcome: "error", failed: true, error: o.error };

  const s = o.summary;
  if (s.offline) return { ...base, outcome: "offline", failed: false };

  const sent = s.push?.sent ?? 0;
  const failedSends = s.push?.failed ?? 0;
  const blocked = s.push?.blocked ?? 0;
  const pulledItems = s.pull?.items ?? 0;
  const partial = failedSends > 0 || !!s.pullError;
  return {
    outcome: partial ? "partial" : "synced",
    failed: partial,
    sent,
    failedSends,
    blocked,
    pulledItems,
    error: s.pullError,
  };
}
