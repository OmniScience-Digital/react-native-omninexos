// src/jobcards/sync.ts
// Moves work between the phone and the server.
//   PULL: download every OPEN job card and its work set into the phone's store.
//   PUSH: send what was finished offline: photos first, then the work item's status, then the result.
// Every step is safe to repeat, so a lost connection or a closed app at any moment just means "try again later".
import { normEmail } from "./people";
import { formFromResult, isRemotePhoto, remoteKeyOf } from "./remote";
import { computeBaseline } from "./rules";
import { isConditionalFailure } from "./serverErrors";
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

export interface ServerDoneItem extends ServerWorkItem {
  submittedAt: string;
  submissionId: string;
  payload: Record<string, unknown>;
}

export interface OpenWork {
  jobCards: ServerJobCard[];
  scales: ServerScale[];
  items: ServerWorkItem[];
  doneItems: ServerDoneItem[];
  incompleteJobCardIds: string[];
}

export interface JobCardApi {
  listOpenWork(known?: Record<string, string>): Promise<OpenWork>;
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
export function retryDelayMs(failures: number): number {
  const steps = [15_000, 60_000, 240_000, 600_000, 1_800_000];
  return failures >= 1 && failures <= steps.length
    ? steps[failures - 1]
    : 3_600_000;
}
export const MAX_ATTEMPTS_BEFORE_BLOCK = 12;
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

/** How long a stored baseline is trusted before the 3 latestSubmission lookups are made again. */
const BASELINE_FRESH_MS = 60 * 60_000;

export async function pullOpenWork(
  store: JobCardStore,
  api: JobCardApi,
  userSub: string,
  now: Date,
): Promise<PullSummary> {
  const known = await store.knownRemoteResults().catch(() => ({}));
  const open = await api.listOpenWork(known);
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
  const nowMs = now.getTime();
  await inChunks(spanScales, 3, async (scaleId) => {
    try {
      // R1: reuse a stored baseline when it is still fresh — the 3 lookups
      // (zero / span / inspection) only change when a new submission lands on
      // the scale, so refetching them on every sync is wasted bandwidth.
      //
      // When we DO reuse, we do NOT push the entry into `baselines`. If we
      // did, applyPull would bump `updated_at` to nowIso on every sync — the
      // window would reset forever and the baseline would never refetch even
      // when a new submission changed it. Leaving it out keeps updated_at at
      // the real fetch time, so the 1h window closes correctly.
      const existing = await store.getBaseline(scaleId);
      if (
        existing?.updatedAt &&
        nowMs - Date.parse(existing.updatedAt) < BASELINE_FRESH_MS
      ) {
        return;
      }
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
    if (isConditionalFailure(errorText(e))) {
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
  /**
   * The job card the technician is currently viewing, if any.
   *
   * R2: refreshTimeCache only runs for this one card. Time entries from other
   * people only matter while the technician is looking at a card; on the list
   * screen (or during a background wake, when there is no UI) the totals stay
   * as they were last refreshed.
   *
   * Returning null means "not on a card": skip the cache refresh entirely.
   * That is the common case in a background wake and on the home screen.
   */
  foregroundJobCardId?: () => string | null;
}
export interface SyncSummary {
  offline: boolean;
  push?: PushSummary;
  pull?: PullSummary;
  pullError?: string;
}

// R3: refreshFinishedJobCards is gone.
// applyPull already marks any locally-cached card that is not in the fresh
// OPEN list as CLOSED (see store.applyPull -> closeJobCard). Calling
// getJobCard(id) per card was confirming what the pull had already told us.

async function refreshTimeCache(deps: SyncDeps): Promise<void> {
  // R2: only the foreground card. On the home screen or a background wake the
  // technician is not looking at a card, so refreshing every card's time cache
  // is bandwidth spent on numbers nobody is watching.
  const jobCardId = deps.foregroundJobCardId?.() ?? null;
  if (!jobCardId) return;

  try {
    const rows = await deps.api.listTimeEntries(jobCardId);
    await deps.store.replaceTimeCache(
      jobCardId,
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

let inFlight: Promise<SyncSummary> | null = null;

export function runSync(deps: SyncDeps, userSub: string): Promise<SyncSummary> {
  if (inFlight) return inFlight;
  const run: Promise<SyncSummary> = (async (): Promise<SyncSummary> => {
    if (!(await deps.isOnline())) return { offline: true };

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
    if (summary.pull) await refreshTimeCache(deps);
    await deps.store
      .closeObsoleteResults(deps.now().toISOString())
      .catch(() => 0);
    await deps.store
      .closeOrphanedRows(deps.now().toISOString(), MAX_ATTEMPTS_BEFORE_BLOCK)
      .catch(() => 0);
    await deps.store.pruneDone(deps.now().toISOString());
    return summary;
  })().finally(() => {
    if (inFlight === run) inFlight = null;
  });
  inFlight = run;
  return run;
}

export function abandonRunningSync(): void {
  inFlight = null;
}
