// src/jobcards/sync.ts
// Moves work between the phone and the server.
//   PULL: download every OPEN job card and its full work set (pending AND finished) into the phone's store.
//         Anyone can open and complete any of it; assigning a job card only decides who is notified.
//         Finished work on an open job card is stored with its saved form so it can be corrected (and re-sent as
//         a revision), regardless of how old it is: an open job card's done work is never dropped.
//   PUSH: send what was finished offline: photos first, then the work item's status, then the result.
// Every step is safe to repeat, so a lost connection or a closed app at any moment just means "try again later".
import { normEmail } from "./people";
import { formFromResult, isRemotePhoto, remoteKeyOf } from "./remote";
import { computeBaseline } from "./rules";
import type { JobCardStore, PullData } from "./store";
import type {
  AddScalePayload,
  EndTimePayload,
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
  closedAt?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  assignedAt?: string | null;
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
  userName?: string | null;
  userEmail?: string | null;
  startedAt?: string | null;
  minutes?: number | null;
  endedAt?: string | null;
  lastActiveAt?: string | null;
  startReason?: string | null;
}

/** Finished work on an open job card, with the result it was saved with. Kept on the phone so it can be edited. */
export interface ServerDoneItem extends ServerWorkItem {
  submittedAt: string;
  /** The latest saved result of this work item */
  submissionId: string;
  payload: Record<string, unknown>;
}

/** Everything the phone needs to show the open job cards. */
export interface OpenWork {
  jobCards: ServerJobCard[];
  scales: ServerScale[];
  /** Work still to do, on every open job card */
  items: ServerWorkItem[];
  /** Finished work of every open job card (never time-filtered: it stays editable as a revision) */
  doneItems: ServerDoneItem[];
  /** Job cards whose work could not be read this time: the phone keeps what it has for them */
  incompleteJobCardIds: string[];
}

/** The calls the sync engine needs. The real ones are in api.ts; tests use a fake. */
export interface JobCardApi {
  /**
   * Every open job card, its scales, the work still pending on it (not just work assigned to this user), and all
   * of its finished work regardless of age. Finished work on an open job card is never time-filtered: it must stay
   * on the phone so it can be corrected and re-sent as a revision.
   */
  listOpenWork(): Promise<OpenWork>;
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
  /**
   * End a session. The server may already have closed it; the implementation decides whose end wins (see resolveEnd in
   * time.ts) and works out the minutes.
   */
  closeTimeEntry(a: {
    id: string;
    startedAt: string;
    endedAt: string;
  }): Promise<void>;
  /** The phone is still working on this session. Best effort: it never throws. */
  touchTimeEntry(a: { id: string; at: string }): Promise<void>;
  /** Start a time entry. If this id already exists it must succeed quietly. */
  createTimeEntry(input: {
    id: string;
    jobCardId: string;
    userId: string;
    userName: string;
    userEmail?: string;
    startedAt: string;
  }): Promise<void>;
  /** Create a scale on a job card. If this id already exists it must succeed quietly (a repeat of an earlier send). */
  createScale(input: {
    id: string;
    jobCardId: string;
    scaleName: string;
    createdBy: string;
  }): Promise<void>;
  /** Create one work item on a scale. It is not assigned to anyone. If this id already exists it must succeed quietly. */
  createModule(input: {
    id: string;
    scaleId: string;
    jobCardId: string;
    moduleType: WorkItemType;
    sequence: number;
    addedBy: string;
    addedAt: string;
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
/** A row blocked because it reached MAX_ATTEMPTS is retried again after this long. */
export const BLOCKED_RETRY_MS = 3_600_000;

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

export async function pullOpenWork(
  store: JobCardStore,
  api: JobCardApi,
  userSub: string,
  now: Date,
): Promise<PullSummary> {
  // 1. If this fails nothing is changed: the phone keeps what it has.
  const open = await api.listOpenWork();
  const { items } = open;

  // 2. The latest zero/span, only for scales that have a span calibration to do (the only form that needs them).
  let failed = open.incompleteJobCardIds.length;
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

  // 3. Save it all at once
  await store.applyPull({
    userSub,
    nowIso: now.toISOString(),
    jobCards: open.jobCards.map((j) => ({
      id: j.id,
      jcNumber: j.jcNumber,
      customerName: j.customerName,
      title: j.title,
      status: j.status,
      assignedTo: j.assignedTo ?? null,
      assignedToName: j.assignedToName ?? null,
      assignedToEmail: normEmail(j.assignedToEmail) ?? null,
      assignedAt: j.assignedAt ?? null,
    })),
    scales: open.scales,
    items: items.map((i) => ({
      id: i.id,
      jobCardId: i.jobCardId,
      scaleId: i.scaleId,
      moduleType: i.moduleType,
      sequence: i.sequence,
      assignedAt: i.assignedAt,
    })),
    baselines,
    incompleteJobCardIds: open.incompleteJobCardIds,
    doneItems: doneItemsForStore(open.doneItems),
  });
  await store.setMeta("lastPullAt", now.toISOString());
  return {
    items: items.length,
    jobCards: open.jobCards.length,
    failedLookups: failed,
  };
}

function doneItemsForStore(
  done: ServerDoneItem[],
): NonNullable<PullData["doneItems"]> {
  const out: NonNullable<PullData["doneItems"]> = [];
  for (const d of done) {
    try {
      out.push({
        id: d.id,
        jobCardId: d.jobCardId,
        scaleId: d.scaleId,
        moduleType: d.moduleType,
        sequence: d.sequence,
        assignedAt: d.assignedAt,
        submittedAt: d.submittedAt,
        submissionId: d.submissionId,
        revision:
          Number(d.payload.revision) > 0 ? Number(d.payload.revision) : 1,
        draft: formFromResult(d.moduleType, d.payload),
      });
    } catch {
      /* a result that cannot be read cannot be reopened: leave it out */
    }
  }
  return out;
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
      if (isRemotePhoto(uri)) {
        // already saved on the server (finished work somebody else did): point at it, upload nothing
        keys.push(remoteKeyOf(uri));
        continue;
      }
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
    // Only ConditionalCheckFailed is a genuine "the work item no longer exists on the server". A bare "Not found"
    // (route warm-up, cold Lambda) is transient: retry it with backoff, do not classify as permanent. That was the
    // cause of "1 need attention" that only cleared after many manual retries.
    if (/ConditionalCheckFailed/i.test(errorText(e))) {
      throw new PermanentError(
        "This work item was removed on the server, so the result could not be attached. It is kept on this phone.",
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

async function sendEndTime(api: JobCardApi, row: OutboxRow): Promise<void> {
  const p = JSON.parse(row.payload) as EndTimePayload;
  await api.closeTimeEntry({
    id: p.sessionId,
    startedAt: p.startedAt,
    endedAt: p.endedAt,
  });
}

async function sendStartTime(api: JobCardApi, row: OutboxRow): Promise<void> {
  const p = JSON.parse(row.payload) as StartTimePayload;
  // The time entry carries this login's id AND the person's email. People are recognised by email, so one person who
  // signs in two ways is never split, and nothing has to be looked up (it works offline too).
  const userEmail = normEmail(p.userEmail);
  if (p.sessionId) {
    // a session: the time entry has the session's own id, so the end can find it and a retry cannot repeat it
    await api.createTimeEntry({
      id: p.sessionId,
      jobCardId: row.jobCardId,
      userId: p.userSub,
      userName: p.userName,
      userEmail,
      startedAt: p.startedAt,
    });
    return;
  }
  // An older queued start (no session id): do not start a second timer for the same person
  const entries = await api.listTimeEntries(row.jobCardId);
  const same = (e: { userId: string; userEmail?: string | null }) =>
    e.userId === p.userSub ||
    (!!userEmail && normEmail(e.userEmail) === userEmail);
  if (entries.some((e) => same(e) && !e.endedAt)) return;
  const mine = entries.filter(same).length;
  await api.createTimeEntry({
    id: `${row.jobCardId}#${p.userSub}#${mine + 1}`,
    jobCardId: row.jobCardId,
    userId: p.userSub,
    userName: p.userName,
    userEmail,
    startedAt: p.startedAt,
  });
}

/**
 * A scale added on the phone: create the scale, then each chosen work item.
 * The ids were made on the phone, so a retry after a dropped connection never creates duplicates.
 * Work items are not assigned to anyone: every open job card's pending work comes back in the next pull.
 */
async function sendAddScale(api: JobCardApi, row: OutboxRow): Promise<void> {
  const p = JSON.parse(row.payload) as AddScalePayload;
  await api.createScale({
    id: p.scaleId,
    jobCardId: p.jobCardId,
    scaleName: p.scaleName,
    createdBy: p.userSub,
  });
  for (const m of p.modules) {
    await api.createModule({
      id: m.id,
      scaleId: p.scaleId,
      jobCardId: p.jobCardId,
      moduleType: m.moduleType,
      sequence: 1, // first of its type on a brand-new scale
      addedBy: p.userSub,
      addedAt: p.addedAt,
    });
  }
}

export async function pushOutbox(
  store: JobCardStore,
  api: JobCardApi,
  now: () => Date,
  /** Called with the local photo files of a result once it has been sent, so they can be deleted from the phone. */
  cleanupFiles?: (uris: string[]) => Promise<void>,
): Promise<PushSummary> {
  const nowIso = now().toISOString();
  // Rows that failed 12 times are put back in the queue after BLOCKED_RETRY_MS. Without this, "1 need attention"
  // was a permanent state: a transient failure was retried only when the technician clicked "Try again", and every
  // attempt incremented the counter, so the badge survived even after the work finally reached the server.
  await store.requeueDueBlocked(nowIso);

  const summary: PushSummary = { sent: 0, failed: 0, blocked: 0 };
  const due = await store.dueOutbox(nowIso);

  for (const row of due) {
    await store.markSyncing(row.id, now().toISOString());
    try {
      if (row.kind === "submit-result") await sendResult(store, api, row, now);
      else if (row.kind === "add-scale") await sendAddScale(api, row);
      else if (row.kind === "end-time") await sendEndTime(api, row);
      else await sendStartTime(api, row);
      const submittedAt =
        row.kind === "submit-result"
          ? (JSON.parse(row.payload) as SubmitResultPayload).submittedAt
          : null;
      await store.markDone(row, submittedAt, now().toISOString());
      summary.sent += 1;
    } catch (e) {
      const failures = row.attempts + 1;
      const permanent = e instanceof PermanentError;
      const reachedMax = !permanent && failures >= MAX_ATTEMPTS_BEFORE_BLOCK;
      const blocked = permanent || reachedMax;
      // A PermanentError stays blocked forever (until the technician clicks "Try again"): the work item is gone.
      // Reaching MAX_ATTEMPTS means "stop trying every few minutes, retry once an hour" — the row keeps retrying
      // automatically until it either succeeds or the user intervenes.
      const next = permanent
        ? null
        : reachedMax
          ? new Date(now().getTime() + BLOCKED_RETRY_MS).toISOString()
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

/** A job card whose work is all done is not in the pull, so ask whether it has been closed since. */
async function refreshFinishedJobCards(
  deps: SyncDeps,
  userSub: string,
): Promise<void> {
  try {
    const nowIso = deps.now().toISOString();
    for (const id of await deps.store.jobCardIdsToRefresh(userSub)) {
      try {
        const j = await deps.api.getJobCard(id);
        if (j) await deps.store.upsertJobCard(j, nowIso);
      } catch {
        /* no signal for this one: try again next time */
      }
    }
  } catch {
    /* never fail a sync over this */
  }
}

/** Keep a copy of everyone's time on the open job cards, so the total on the phone includes other technicians. */
async function refreshTimeCache(
  deps: SyncDeps,
  userSub: string,
): Promise<void> {
  try {
    for (const id of await deps.store.jobCardIdsFor(userSub)) {
      try {
        const rows = await deps.api.listTimeEntries(id);
        await deps.store.replaceTimeCache(
          id,
          rows
            .filter((r) => !!r.startedAt)
            .map((r) => ({
              id: r.id,
              userId: r.userId,
              userName: r.userName ?? null,
              userEmail: normEmail(r.userEmail) ?? null,
              startedAt: r.startedAt as string,
              endedAt: r.endedAt ?? null,
              lastActiveAt: r.lastActiveAt ?? null,
              startReason: r.startReason ?? null,
            })),
        );
      } catch {
        /* no signal for this one: the phone keeps what it had */
      }
    }
  } catch {
    /* the total is a convenience; never fail a sync over it */
  }
}

let inFlight: Promise<SyncSummary> | null = null;

/** Send what is waiting, then refresh the open work. Only one run at a time; asking again joins the running one. */
export function runSync(deps: SyncDeps, userSub: string): Promise<SyncSummary> {
  if (inFlight) return inFlight;
  inFlight = (async (): Promise<SyncSummary> => {
    if (!(await deps.isOnline())) return { offline: true };
    const summary: SyncSummary = { offline: false };
    const expiredPhotos = await deps.store
      .expiredPhotoPaths(deps.now().toISOString())
      .catch(() => []);
    summary.push = await pushOutbox(
      deps.store,
      deps.api,
      deps.now,
      deps.cleanupFiles,
    );
    try {
      summary.pull = await pullOpenWork(
        deps.store,
        deps.api,
        userSub,
        deps.now(),
      );
    } catch (e) {
      summary.pullError = errorText(e); // the phone keeps what it has
    }
    if (summary.pull && expiredPhotos.length)
      await deps.cleanupFiles?.(expiredPhotos).catch(() => {});
    if (summary.pull) await refreshTimeCache(deps, userSub);
    if (summary.pull) await refreshFinishedJobCards(deps, userSub);
    await deps.store.pruneDone(deps.now().toISOString());
    return summary;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
