// src/jobcards/notifications.ts
// What a job card push notification carries, and where tapping it should go. Pure.
//
// The server sends: { type: "jobcard-assigned", jobCardId } in the notification's data. A job card is assigned as a
// whole, so there is no work item in it. An older notification may still carry a workItemId, so that is still understood.

export const JOBCARD_ASSIGNED = "jobcard-assigned";

export interface JobCardNotificationTarget {
  /** Open this job card */
  jobCardId?: string;
  /** Open this work item (an older notification) */
  workItemId?: string;
}

const text = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

export function jobCardTargetFromData(
  data: unknown,
): JobCardNotificationTarget | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.type !== JOBCARD_ASSIGNED) return null;
  const workItemId = text(d.workItemId);
  const jobCardId = text(d.jobCardId);
  if (workItemId) return { workItemId, jobCardId }; // an older notification still opens its work item
  return jobCardId ? { jobCardId } : null;
}
