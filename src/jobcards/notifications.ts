// src/jobcards/notifications.ts
// What a job card push notification carries, and where tapping it should go. Pure.
//
// The server sends: { type: "jobcard-assigned", workItemId, jobCardId?, ... } in the notification's data.

export const JOBCARD_ASSIGNED = "jobcard-assigned";

export interface JobCardNotificationTarget {
  workItemId: string;
}

export function jobCardTargetFromData(
  data: unknown,
): JobCardNotificationTarget | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.type !== JOBCARD_ASSIGNED) return null;
  return typeof d.workItemId === "string" && d.workItemId.length > 0
    ? { workItemId: d.workItemId }
    : null;
}
