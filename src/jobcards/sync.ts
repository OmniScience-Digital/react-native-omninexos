// src/jobcards/sync.ts
// Moves work between the phone and the server.
//   PULL: download the technician's assigned work (and what the span calculation needs) into the phone's store.
//   PUSH: send what was finished offline: photos first, then the work item's status, then the result.
// Every step is safe to repeat, so a lost connection or a closed app at any moment just means "try again later".
import { computeBaseline } from "./rules";
import type { JobCardStore } from "./store";
import type {
    OutboxRow,
    StartTimePayload,
    SubmitResultPayload,
    WorkItemType,
} from "./types";

// ---------------------------------------------------------------- server shapes
export interface ServerWorkItem {
  id: string;
  jobCardId: string;
  scaleId: string;
  moduleType: WorkItemType;
  sequence: number;
  assignedAt?: string | null;
}
export interface ServerJobCard {
  id: string;
  jcNumber: string;
  customerName?: string | null;
  title?: string | null;
  status: string;
}
export interface ServerScale {
  id: string;
  jobCardId: string;
  scaleName: string;
}
export interface ServerSubmission {
  id: string;
  moduleType: WorkItemType;
  submittedAt: string;
  payload: Record<string, unknown>;
}
export interface ServerTimeEntry {
  id: string;
  userId: string;
  endedAt?: string | null;
}

/** The calls the sync engine needs. The real ones are in api.ts; tests use a fake. */
export interface JobCardApi {
  /** Work assigned to this user (Cognito id) that is still pending. */
  listAssignedPending(userSub: string): Promise<ServerWorkItem[]>;
  getJobCard(id: string): Promise<ServerJobCard | null>;
  getScale(id: string): Promise<ServerScale | null>;
  /** The newest saved result of this type for the scale, if any. */
  latestSubmission(
    scaleId: string,
    type: WorkItemType,
  ): Promise<ServerSubmission | null>;
  /** Mark the work item SUBMITTED. Must throw if the work item no longer exists. Repeating it is harmless. */
  markModuleSubmitted(a: {
    id: string;
    submittedAt: string;
    submittedBy: string;
  }): Promise<void>;
  /** Save the result. If a result with this id already exists it must succeed quietly (a repeat of an earlier send). */
  createSubmission(input: {
    id: string;
    moduleId: string;
    scaleId: string;
    jobCardId: string;
    moduleType: WorkItemType;
    submittedBy: string;
    submittedAt: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
  listTimeEntries(jobCardId: string): Promise<ServerTimeEntry[]>;
  /** Start a time entry. If this id already exists it must succeed quietly. */
  createTimeEntry(input: {
    id: string;
    jobCardId: string;
    userId: string;
    userName: string;
    startedAt: string;
  }): Promise<void>;
  uploadPhoto(storageKey: string, localUri: string): Promise<void>;
}

/** A problem that retrying will not fix: the row is set aside (blocked) and the technician is told. */
export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentError";
  }
}

// ------------------------------------------------------------------------ retry
/** After the Nth failure wait: 15s, 1m, 4m, 10m, 30m, then an hour between tries. */
export function retryDelayMs(failures: number): number {
  const steps = [15_000, 60_000, 240_000, 600_000, 1_800_000];
  return failures >= 1 && failures <= steps.length
    ? steps[failures - 1]
    : 3_600_000;
}
/** After this many failed tries a row is set aside for attention instead of being retried forever. */
export const MAX_ATTEMPTS_BEFORE_BLOCK = 12;

const errorText = (e: unknown): string => {
  if (e instanceof Error) return e.message || e.name;
  if (e && typeof e === "object" && "errors" in e) {
    const errs = (e as { errors?: { message?: string }[] }).errors;
    if (errs?.length) return errs.map((x) => x.message).join("; ");
  }
  return String(e);
};

// ------------------------------------------------------------------------- pull
export interface PullSummary {
  items: number;
  jobCards: number;
  failedLookups: number;
}

const inChunks = async <T>(
  list: T[],
  size: number,
  fn: (x: T) => Promise<void>,
) => {
  for (let i = 0; i < list.length; i += size)
    await Promise.all(list.slice(i, i + size).map(fn));
};

export async function pullAssignedWork(
  store: JobCardStore,
  api: JobCardApi,
  userSub: string,
  now: Date,
): Promise<PullSummary> {
  // 1. If this fails nothing is changed: the phone keeps what it has.
  const items = await api.listAssignedPending(userSub);

  // 2. Details. A failed lookup only means that job card's details stay as they were.
  let failed = 0;
  const jobCards = new Map<string, ServerJobCard>();
  const scales = new Map<string, ServerScale>();
  await inChunks([...new Set(items.map((i) => i.jobCardId))], 4, async (id) => {
    try {
      const j = await api.getJobCard(id);
      if (j) jobCards.set(id, j);
    } catch {
      failed += 1;
    }
  });
  await inChunks([...new Set(items.map((i) => i.scaleId))], 4, async (id) => {
    try {
      const s = await api.getScale(id);
      if (s) scales.set(id, s);
    } catch {
      failed += 1;
    }
  });

  // 3. The latest zero/span, only for scales that have a span calibration to do (the only form that needs them).
  const baselines: {
    scaleId: string;
    latestZero: string | null;
    latestSpan: string | null;
  }[] = [];
  const spanScales = [
    ...new Set(
      items
        .filter((i) => i.moduleType === "SPAN_CALIBRATION")
        .map((i) => i.scaleId),
    ),
  ];
  await inChunks(spanScales, 3, async (scaleId) => {
    try {
      const [zero, span, inspection] = await Promise.all([
        api.latestSubmission(scaleId, "ZERO_CALIBRATION"),
        api.latestSubmission(scaleId, "SPAN_CALIBRATION"),
        api.latestSubmission(scaleId, "INSPECTION"),
      ]);
      baselines.push({
        scaleId,
        ...computeBaseline({
          zero: zero?.payload,
          span: span?.payload,
          inspection: inspection?.payload,
        }),
      });
    } catch {
      failed += 1; // keep whatever baseline the phone already has for this scale
    }
  });

  // 4. Save it all at once
  await store.applyPull({
    userSub,
    nowIso: now.toISOString(),
    jobCards: [...jobCards.values()].map((j) => ({
      id: j.id,
      jcNumber: j.jcNumber,
      customerName: j.customerName,
      title: j.title,
      status: j.status,
    })),
    scales: [...scales.values()],
    items: items.map((i) => ({
      id: i.id,
      jobCardId: i.jobCardId,
      scaleId: i.scaleId,
      moduleType: i.moduleType,
      sequence: i.sequence,
      assignedAt: i.assignedAt,
    })),
    baselines,
  });
  await store.setMeta("lastPullAt", now.toISOString());
  return {
    items: items.length,
    jobCards: jobCards.size,
    failedLookups: failed,
  };
}

// ------------------------------------------------------------------------- push
export interface PushSummary {
  sent: number;
  failed: number;
  blocked: number;
}

/** Where a photo goes in storage. The same photo always gets the same key, so re-uploading just overwrites it. */
export const photoStorageKey = (
  jobCardId: string,
  workItemId: string,
  outboxId: string,
  field: string,
  index?: number,
): string =>
  `jobcards/${jobCardId}/${workItemId}/${outboxId}-${field}${index === undefined ? "" : `-${index + 1}`}.jpg`;

async function sendResult(
  store: JobCardStore,
  api: JobCardApi,
  row: OutboxRow,
  now: () => Date,
): Promise<void> {
  const p = JSON.parse(row.payload) as SubmitResultPayload;

  // 1. Photos (progress is saved after each one, so a dropped connection resumes where it stopped)
  const photoKeys: Record<string, string | string[]> = {};
  for (const [field, value] of Object.entries(p.photos)) {
    const uris = Array.isArray(value) ? value : [value];
    const keys: string[] = [];
    for (let i = 0; i < uris.length; i++) {
      const uri = uris[i];
      const key =
        p.uploaded[uri] ??
        photoStorageKey(
          row.jobCardId,
          p.workItemId,
          row.id,
          field,
          Array.isArray(value) ? i : undefined,
        );
      if (!p.uploaded[uri]) {
        await api.uploadPhoto(key, uri);
        p.uploaded[uri] = key;
        await store.updatePayload(
          row.id,
          JSON.stringify(p),
          now().toISOString(),
        );
      }
      keys.push(key);
    }
    photoKeys[field] = Array.isArray(value) ? keys : keys[0];
  }

  // 2. The work item becomes SUBMITTED. This comes BEFORE the result, so when the server handles the result it
  //    already sees the work item as done (that is what lets it stop the timer on the last one).
  try {
    await api.markModuleSubmitted({
      id: p.workItemId,
      submittedAt: p.submittedAt,
      submittedBy: p.submittedBy,
    });
  } catch (e) {
    if (/ConditionalCheckFailed|not\s*found/i.test(errorText(e))) {
      throw new PermanentError(
        "This work item was removed or reassigned, so the result could not be attached. It is kept on this phone.",
      );
    }
    throw e;
  }

  // 3. The result
  await api.createSubmission({
    id: row.id,
    moduleId: p.workItemId,
    scaleId: p.scaleId,
    jobCardId: row.jobCardId,
    moduleType: p.moduleType,
    submittedBy: p.submittedBy,
    submittedAt: p.submittedAt,
    payload: { ...p.result, photos: photoKeys },
  });
}

async function sendStartTime(api: JobCardApi, row: OutboxRow): Promise<void> {
  const p = JSON.parse(row.payload) as StartTimePayload;
  const entries = await api.listTimeEntries(row.jobCardId);
  if (entries.some((e) => e.userId === p.userSub && !e.endedAt)) return; // already being timed
  const mine = entries.filter((e) => e.userId === p.userSub).length;
  await api.createTimeEntry({
    id: `${row.jobCardId}#${p.userSub}#${mine + 1}`, // same rule as the web app: two devices cannot both start
    jobCardId: row.jobCardId,
    userId: p.userSub,
    userName: p.userName,
    startedAt: p.startedAt,
  });
}

export async function pushOutbox(
  store: JobCardStore,
  api: JobCardApi,
  now: () => Date,
  /** Called with the local photo files of a result once it has been sent, so they can be deleted from the phone. */
  cleanupFiles?: (uris: string[]) => Promise<void>,
): Promise<PushSummary> {
  const summary: PushSummary = { sent: 0, failed: 0, blocked: 0 };
  const due = await store.dueOutbox(now().toISOString());

  for (const row of due) {
    await store.markSyncing(row.id, now().toISOString());
    try {
      if (row.kind === "submit-result") await sendResult(store, api, row, now);
      else await sendStartTime(api, row);
      const submittedAt =
        row.kind === "submit-result"
          ? (JSON.parse(row.payload) as SubmitResultPayload).submittedAt
          : null;
      await store.markDone(row, submittedAt, now().toISOString());
      summary.sent += 1;
      if (cleanupFiles && row.kind === "submit-result") {
        try {
          const p = JSON.parse(row.payload) as SubmitResultPayload;
          await cleanupFiles(Object.values(p.photos).flat());
        } catch {
          /* a photo that cannot be deleted is not a reason to fail a result that was sent */
        }
      }
    } catch (e) {
      const failures = row.attempts + 1;
      const blocked =
        e instanceof PermanentError || failures >= MAX_ATTEMPTS_BEFORE_BLOCK;
      const next = blocked
        ? null
        : new Date(now().getTime() + retryDelayMs(failures)).toISOString();
      await store.markFailed(
        row.id,
        errorText(e),
        next,
        blocked,
        now().toISOString(),
      );
      summary[blocked ? "blocked" : "failed"] += 1;
      // keep going: one bad row must not hold up the others
    }
  }
  return summary;
}

// -------------------------------------------------------------------- the runner
export interface SyncDeps {
  store: JobCardStore;
  api: JobCardApi;
  now: () => Date;
  isOnline: () => Promise<boolean>;
  cleanupFiles?: (uris: string[]) => Promise<void>;
}
export interface SyncSummary {
  offline: boolean;
  push?: PushSummary;
  pull?: PullSummary;
  pullError?: string;
}

let inFlight: Promise<SyncSummary> | null = null;

/** Send what is waiting, then refresh the assigned work. Only one run at a time; asking again joins the running one. */
export function runSync(deps: SyncDeps, userSub: string): Promise<SyncSummary> {
  if (inFlight) return inFlight;
  inFlight = (async (): Promise<SyncSummary> => {
    if (!(await deps.isOnline())) return { offline: true };
    const summary: SyncSummary = { offline: false };
    summary.push = await pushOutbox(
      deps.store,
      deps.api,
      deps.now,
      deps.cleanupFiles,
    );
    try {
      summary.pull = await pullAssignedWork(
        deps.store,
        deps.api,
        userSub,
        deps.now(),
      );
    } catch (e) {
      summary.pullError = errorText(e); // the phone keeps what it has
    }
    await deps.store.pruneDone(deps.now().toISOString());
    return summary;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
