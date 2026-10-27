// src/jobcards/alerts.ts
// Alerts are per JOB CARD, never per work item. The text is "New Jc : <job card number>" with the customer underneath.
// An alert appears for a job card that is assigned to me and still has work to do; it goes away when the job card has
// no work left to do or has closed. Pure: no storage, no network.
import { isAssignedToMe, type Me } from "./people";
import type { WorkItemView } from "./types";

export interface AlertCard {
  jobCardId: string;
  jcNumber: string;
  customerName?: string | null;
  /** When the job card was assigned. Assigning it again (to someone else and back) is a new assignment, so a new alert. */
  assignedAt?: string | null;
  assignedToMe: boolean;
  /** Work still to do on this phone */
  pending: number;
  closed: boolean;
}

export const alertTitle = (jcNumber: string): string => `New Jc : ${jcNumber}`;
export const alertBody = (customerName?: string | null): string =>
  customerName?.trim() || "Assigned to you";

/** One entry per job card, from the work on this phone. */
export function cardsFromWork(items: WorkItemView[], me: Me): AlertCard[] {
  const cards = new Map<string, AlertCard>();
  for (const w of items) {
    const c = cards.get(w.jobCardId) ?? {
      jobCardId: w.jobCardId,
      jcNumber: w.jcNumber,
      customerName: w.customerName,
      assignedAt: w.assignedAt,
      assignedToMe: isAssignedToMe(
        {
          assignedTo: w.jobCardAssignedTo,
          assignedToEmail: w.jobCardAssignedToEmail,
        },
        me,
      ),
      pending: 0,
      closed: w.jobCardStatus === "CLOSED",
    };
    if (w.localState === "PENDING") c.pending += 1;
    cards.set(w.jobCardId, c);
  }
  return [...cards.values()];
}

/** Remembered per job card and assignment, so a job card is announced once for each time it is assigned to me. */
export const alertKey = (
  c: Pick<AlertCard, "jobCardId" | "assignedAt">,
): string => `${c.jobCardId}@${c.assignedAt ?? ""}`;

const isOpenForMe = (c: AlertCard) =>
  c.assignedToMe && !c.closed && c.pending > 0;

/** The job cards to announce now: assigned to me, open, with work to do, and not announced before. */
export function freshJobCardAlerts(
  cards: AlertCard[],
  seen: Set<string>,
): AlertCard[] {
  return cards.filter((c) => isOpenForMe(c) && !seen.has(alertKey(c)));
}

/** Everything that is open for me right now: the first run remembers these quietly instead of announcing them. */
export const currentAlertKeys = (cards: AlertCard[]): string[] =>
  cards.filter(isOpenForMe).map(alertKey);

/** A job card alert is one that names a job card and no work item. */
export const isJobCardAlert = (
  data: Record<string, unknown> | undefined | null,
): boolean =>
  data?.type === "jobcard-assigned" && !!data.jobCardId && !data.workItemId;

/**
 * Which job card alerts to clear. An alert goes when its job card is closed or has no work left to do, but only once
 * the phone has refreshed AFTER the alert arrived (otherwise a brand new alert would be cleared before its work had
 * been downloaded). A job card the phone no longer has counts as closed.
 */
export function jobCardAlertsToClear(
  alerts: {
    id: string;
    receivedAt: Date;
    data?: Record<string, unknown> | null;
  }[],
  cards: AlertCard[],
  lastPullAt: string | null,
): string[] {
  if (!lastPullAt) return [];
  const pulledAt = Date.parse(lastPullAt);
  const byId = new Map(cards.map((c) => [c.jobCardId, c]));
  return alerts
    .filter((a) => isJobCardAlert(a.data))
    .filter((a) => pulledAt > a.receivedAt.getTime())
    .filter((a) => {
      const c = byId.get(String(a.data!.jobCardId));
      return !c || c.closed || c.pending === 0;
    })
    .map((a) => a.id);
}
