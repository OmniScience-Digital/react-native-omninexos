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
  listOpenWork(): Promise<OpenWork>;
  getJobCard(id: string): Promise<ServerJobCard | null>;
  getScale(id: string): Promise<ServerScale | null>;
  latestSubmission(
    scaleId: string,
    type: WorkItemType,
  ): Promise<ServerSubmission | null>;
  markModuleSubmitted(a: {
    id: string;
    submittedAt: string;
    submittedBy: string;
  }): Promise<void>;
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
  closeTimeEntry(a: {
    id: string;
    startedAt: string;
    endedAt: string;
  }): Promise<void>;
  touchTimeEntry(a: { id: string; at: string }): Promise<void>;
  createTimeEntry(input: {
    id: string;
    jobCardId: string;
    userId: string;
    userName: string;
    userEmail?: string;
    startedAt: string;
  }): Promise<void>;
  createScale(input: {
    id: string;
    jobCardId: string;
    scaleName: string;
    createdBy: string;
  }): Promise<void>;
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
  const open = await api.listOpenWork();
  const { items } = open;

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
      failed += 1;
    }
  });

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

  const photoKeys: Record<string, string | string[]> = {};
  for (const [field, value] of Object.entries(p.photos)) {
    const uris = Array.isArray(value) ? value : [value];
    const keys: string[] = [];
    for (let i = 0; i < uris.length; i++) {
      const uri = uris[i];
      if (isRemotePhoto(uri)) {
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

  try {
    await api.markModuleSubmitted({
      id: p.workItemId,
      submittedAt: p.submittedAt,
      submittedBy: p.submittedBy,
    });
  } catch (e) {
    if (/ConditionalCheckFailed/i.test(errorText(e))) {
      throw new PermanentError(
        "This work item was removed on the server, so the result could not be attached. It is kept on this phone.",
      );
    }
    throw e;
  }

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
  const userEmail = normEmail(p.userEmail);
  if (p.sessionId) {
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
      sequence: 1,
      addedBy: p.userSub,
      addedAt: p.addedAt,
    });
  }
}

export async function pushOutbox(
  store: JobCardStore,
  api: JobCardApi,
  now: () => Date,
  cleanupFiles?: (uris: string[]) => Promise<void>,
): Promise<PushSummary> {
  const nowIso = now().toISOString();
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
  const run: Promise<SyncSummary> = (async (): Promise<SyncSummary> => {
    if (!(await deps.isOnline())) return { offline: true };

    // Recover rows the OS killed mid-send. If a background wake was terminated after markSyncing() but before
    // markDone() (the app is closed while a network call is in flight), the row stays at 'syncing' forever:
    // dueOutbox only returns 'pending', so pushOutbox never sees it, and it never retries. Before this call
    // recoverStuck only ran once per launch, in startJobCards. Now it runs on every fresh sync — background
    // wake, foreground return, network-up, interval — and covers every outbox kind (result, start-time,
    // end-time, add-scale). Wrapped in try/catch: if SQLite is momentarily unusable, the sync should still
    // try to push and pull, not abort on the recovery step.
    try {
      await deps.store.recoverStuck(deps.now().toISOString());
    } catch (e) {
      console.warn("[jobcards] recoverStuck failed (continuing):", e);
    }

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
      summary.pullError = errorText(e);
    }
    if (summary.pull && expiredPhotos.length)
      await deps.cleanupFiles?.(expiredPhotos).catch(() => {});
    if (summary.pull) await refreshTimeCache(deps, userSub);
    if (summary.pull) await refreshFinishedJobCards(deps, userSub);
    await deps.store
      .closeObsoleteResults(deps.now().toISOString())
      .catch(() => 0);
    await deps.store.pruneDone(deps.now().toISOString());
    return summary;
  })().finally(() => {
    // Only clear our own marker: a run we abandoned may finish much later, after a newer run has started.
    if (inFlight === run) inFlight = null;
  });
  inFlight = run;
  return run;
}

/**
 * Forget a sync that has stopped making progress, so the next `runSync` starts a fresh one instead of waiting on it
 * forever. The old run is not cancelled (it cannot be); if it ever wakes up it carries on harmlessly, because every
 * send has a client-made id the server de-duplicates on.
 */
export function abandonRunningSync(): void {
  inFlight = null;
}
