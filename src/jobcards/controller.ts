// src/jobcards/controller.ts
// The one place the screens talk to: it owns the store, the server calls and "tell me when something changed".
import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useMemo, useState } from "react";
import { jobCardApi, resolveMyIds } from "./api";
import { newId } from "./ids";
import { normEmail, type Me } from "./people";
import { deletePhotoFiles } from "./photos";
import { getJobCardStore } from "./sqliteDriver";
import { prepareSubmission, type PrepareResult } from "./submission";
import { abandonRunningSync, runSync, type SyncSummary } from "./sync";
import { computeTimes, type JobCardTime } from "./time";
import type {
  AnyForm,
  ScaleBaseline,
  WorkItemType,
  WorkItemView,
} from "./types";

// ----------------------------------------------------------- who is signed in
export interface JobCardUser {
  sub: string;
  name: string;
  /** Time and assignment are matched by email, so one person's two logins are one person. */
  email?: string;
}
let currentUser: JobCardUser | null = null;
export const getJobCardUser = () => currentUser;
export const setJobCardUser = (u: JobCardUser | null) => {
  currentUser = u;
};

/**
 * Persist the signed-in user in the phone's store, so the OS background task can sync without a UI. Called by
 * startJobCards (foreground) and read by src/jobcards/background.ts (background). Passing null clears it, so a
 * signed-out phone cannot sync as the previous technician.
 */
export async function persistJobCardUser(
  user: JobCardUser | null,
): Promise<void> {
  const store = await getJobCardStore();
  if (user) {
    await store.setMeta("userSub", user.sub);
    await store.setMeta("userName", user.name);
    await store.setMeta("userEmail", normEmail(user.email) ?? "");
  } else {
    await store.setMeta("userSub", "");
    await store.setMeta("userName", "");
    await store.setMeta("userEmail", "");
  }
}

// ------------------------------------------------------------ change notices
const listeners = new Set<() => void>();
export const subscribeJobCards = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const notify = () => listeners.forEach((l) => l());

export async function isOnline(): Promise<boolean> {
  const s = await NetInfo.fetch();
  return !!s.isConnected && s.isInternetReachable !== false;
}

// ---------------------------------------------------------------------- sync
let syncDepth = 0;
export const isSyncing = () => syncDepth > 0;
let lastSummary: SyncSummary | null = null;
export const getLastSyncSummary = () => lastSummary;

// ---------------------------------------------------------------------- tracing
// Used only by the background task: it records the last network call or database operation the sync started, so a
// background run that hangs or is killed shows where it stopped. Off (null) in the foreground, so it costs nothing.
let trace: ((step: string) => void) | null = null;
export function setSyncTrace(fn: ((step: string) => void) | null): void {
  trace = fn;
}
let lastTraced = "";
// Always on and in memory only: when did the running sync last start a call, and which one? Lets the background
// task tell a sync that is working from one the OS froze, instead of waiting on it forever.
let lastActivityAt = Date.now();
let lastStepLive = "";
export function getSyncActivity(): {
  running: boolean;
  idleMs: number;
  lastStep: string;
} {
  return {
    running: isSyncing(),
    idleMs: Date.now() - lastActivityAt,
    lastStep: lastStepLive,
  };
}
function note(step: string): void {
  lastActivityAt = Date.now();
  lastStepLive = step;
  if (!trace || step === lastTraced) return;
  lastTraced = step;
  trace(step);
}
/** Wraps every method of `target` so that starting a call is noted. Behaviour is otherwise unchanged. */
function traced<T extends object>(target: T, prefix: string): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      if (typeof value !== "function" || typeof prop !== "string") return value;
      return (...args: unknown[]) => {
        note(`${prefix}:${prop}`);
        return value.apply(obj, args);
      };
    },
  });
}

/** What a sync attempt did. `requestSync` hides this for the screens; the background task needs it to be honest. */
export type SyncOutcome =
  | { status: "no-user" } // nobody signed in: nothing was attempted
  | { status: "error"; error: string } // the sync itself threw
  | { status: "done"; summary: SyncSummary }; // ran (summary.offline says whether there was any signal)

/** Send what is waiting and refresh the assigned work. Never throws, and says what happened. */
export async function requestSyncDetailed(opts?: {
  /** If a sync is running but has started no call for this long, assume it is frozen and start a fresh one. */
  takeOverIfIdleMs?: number;
}): Promise<SyncOutcome> {
  if (!currentUser) return { status: "no-user" };
  const frozen =
    !!opts?.takeOverIfIdleMs &&
    isSyncing() &&
    Date.now() - lastActivityAt > opts.takeOverIfIdleMs;
  if (frozen) abandonRunningSync();
  // Only a run we start ourselves counts as fresh activity; joining a running one must not hide that it is frozen.
  if (!isSyncing() || frozen) {
    lastActivityAt = Date.now();
    lastStepLive = "";
  }
  syncDepth += 1;
  notify();
  try {
    const store = await getJobCardStore();
    // The frozen run may have been halfway through sending a result, leaving it marked "sending". Put those back.
    if (frozen) await store.recoverStuck(new Date().toISOString());
    lastTraced = "";
    lastSummary = await runSync(
      {
        store: traced(store, "store"),
        api: traced(jobCardApi, "api"),
        now: () => new Date(),
        isOnline: () => {
          note("isOnline");
          return isOnline();
        },
        cleanupFiles: deletePhotoFiles,
      },
      currentUser.sub,
    );
    notify();
    return { status: "done", summary: lastSummary };
  } catch (e) {
    console.warn("[jobcards] sync failed:", e);
    return {
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    syncDepth -= 1;
    notify();
  }
}

/** Send what is waiting and refresh the assigned work. Never throws: problems are kept for the next try. */
export async function requestSync(): Promise<SyncSummary | null> {
  const outcome = await requestSyncDetailed();
  return outcome.status === "done" ? outcome.summary : null;
}

/**
 * Send what was just saved. If a sync is already running it may have finished its sending step before this change
 * was saved, and asking again only joins it; so once it ends, run once more. With no signal both are quick no-ops
 * and the work simply stays saved on the phone.
 */
export async function requestSyncAfterChange(): Promise<void> {
  const wasRunning = isSyncing();
  await requestSync();
  if (wasRunning) await requestSync();
}

/**
 * The signal came back. Sends that failed on poor signal are resting until their retry time (up to an hour), which
 * is wrong now that the network is good: release them, then sync.
 */
export async function requestSyncAfterSignalReturn(): Promise<void> {
  try {
    const store = await getJobCardStore();
    await store.releaseBackoff(new Date().toISOString());
  } catch {
    /* the normal sync still runs */
  }
  await requestSync();
}

/** What the "Send now" button tells the technician. */
export type SendNowResult =
  | { status: "offline" } // no signal: nothing was attempted, the work is safe on the phone
  | { status: "nothing" } // everything is already sent
  | { status: "sent"; sent: number } // all that was waiting went
  | { status: "waiting"; waiting: number } // still waiting: the try failed or something is still queued
  | { status: "error" }; // could not even start

export function describeSendNow(
  outcome: SyncOutcome,
  waitingAfter: number,
): SendNowResult {
  if (outcome.status !== "done") return { status: "error" };
  const s = outcome.summary;
  if (s.offline) return { status: "offline" };
  const sent = s.push?.sent ?? 0;
  if (waitingAfter > 0) return { status: "waiting", waiting: waitingAfter };
  return sent > 0 ? { status: "sent", sent } : { status: "nothing" };
}

/** "Send now": check the signal first, skip any retry wait, send, and report honestly what happened. */
export async function sendNow(): Promise<SendNowResult> {
  if (!currentUser) return { status: "error" };
  if (!(await isOnline())) return { status: "offline" };
  const store = await getJobCardStore();
  await store.releaseBackoff(new Date().toISOString()).catch(() => 0);
  const outcome = await requestSyncDetailed();
  const waiting = await store.unsentResultCount(currentUser.sub).catch(() => 0);
  return describeSendNow(outcome, waiting);
}

/** True while a sync is running, so the screen can say so. */
export function useJobCardSyncing(): boolean {
  const [s, setS] = useState(isSyncing());
  useEffect(() => subscribeJobCards(() => setS(isSyncing())), []);
  return s;
}

/** Called once at start: anything left half-sent by a crash goes back in the queue. */
export async function startJobCards(user: JobCardUser): Promise<void> {
  setJobCardUser(user);
  await persistJobCardUser(user); // so the OS background task can sync without a UI
  const store = await getJobCardStore();
  const nowIso = new Date().toISOString();
  await store.recoverStuck(nowIso);
  // One-shot cleanup: any row stuck with next_attempt_at = NULL is a PermanentError the server has already
  // rejected as "no longer exists". Mark it done so the "N need attention" badge clears on open.
  await store.autoDismissStuckPermanent(nowIso);
  await store.closeObsoleteResults(nowIso).catch(() => 0);
  // A session the app never got to close (crash, phone off): it ended when the app was last seen working
  for (const s of await store.openSessions(user.sub))
    await store.endSession(s.id, s.beatAt, nowIso);
  notify();
}

/** Called on sign-out: stop the background task from syncing as this user. */
export async function stopJobCards(): Promise<void> {
  setJobCardUser(null);
  await persistJobCardUser(null);
  notify();
}

// ------------------------------------------------------------- time sessions
// Time worked is the time a job card is OPEN in the app. A session starts when the technician opens the job card
// and ends the moment they leave it, lock the phone or switch to another app (it starts again when they return).
// Each session is saved on the phone first and sent later, so it works without signal.
let activeSession: { id: string; jobCardId: string } | null = null;
let wantedJobCard: string | null = null;
let beatTimer: ReturnType<typeof setInterval> | null = null;
const BEAT_MS = 30_000;
const SERVER_BEAT_EVERY = 2;
let sessionQueue: Promise<unknown> = Promise.resolve();
const inOrder = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = sessionQueue.then(fn, fn);
  sessionQueue = run.catch(() => undefined);
  return run;
};

const endActive = async () => {
  if (beatTimer) {
    clearInterval(beatTimer);
    beatTimer = null;
  }
  const s = activeSession;
  activeSession = null;
  if (!s) return;
  const store = await getJobCardStore();
  const now = new Date().toISOString();
  await store.endSession(s.id, now, now);
  notify();
  void requestSyncAfterChange();
};

export const startJobCardSession = (jobCardId: string): Promise<void> =>
  inOrder(async () => {
    if (!currentUser) return;
    wantedJobCard = jobCardId;
    if (activeSession?.jobCardId === jobCardId) return;
    await endActive();
    const store = await getJobCardStore();
    const id = newId();
    await store.startSession({
      id,
      jobCardId,
      userSub: currentUser.sub,
      userName: currentUser.name,
      userEmail: normEmail(currentUser.email),
      nowIso: new Date().toISOString(),
    });
    activeSession = { id, jobCardId };
    let beats = 0;
    beatTimer = setInterval(() => {
      const s = activeSession;
      if (!s) return;
      const at = new Date().toISOString();
      void getJobCardStore().then((st) => st.beatSession(s.id, at));
      beats += 1;
      if (beats % SERVER_BEAT_EVERY === 0)
        void isOnline()
          .then((online) =>
            online ? jobCardApi.touchTimeEntry({ id: s.id, at }) : undefined,
          )
          .catch(() => {});
    }, BEAT_MS);
    notify();
    void requestSyncAfterChange();
  });

export const pauseJobCardSession = (): Promise<void> => inOrder(endActive);

export const resumeJobCardSession = (): Promise<void> => {
  const id = wantedJobCard;
  return id ? startJobCardSession(id) : Promise.resolve();
};

export const leaveJobCardSession = (): Promise<void> =>
  inOrder(async () => {
    wantedJobCard = null;
    await endActive();
  });

export const noteWorkStarted = startJobCardSession;

export async function loadWorkItem(id: string) {
  const store = await getJobCardStore();
  const item = await store.getWorkItem(id);
  if (!item) return null;
  const [draft, baseline, outbox] = await Promise.all([
    store.getDraft<AnyForm>(id),
    store.getBaseline(item.scaleId),
    store.outboxFor(id),
  ]);
  return { item, draft, baseline, outbox };
}

export async function saveDraft(
  workItemId: string,
  form: AnyForm,
): Promise<void> {
  const store = await getJobCardStore();
  await store.saveDraft(workItemId, form, new Date().toISOString());
}

const ALL_WORK_TYPES: readonly WorkItemType[] = [
  "INSPECTION",
  "ZERO_CALIBRATION",
  "SPAN_CALIBRATION",
];

export async function addScale(args: {
  jobCardId: string;
  scaleName: string;
  scopeOfWork: string;
  moduleTypes?: WorkItemType[];
}): Promise<void> {
  if (!currentUser) throw new Error("Not signed in");
  const scaleName = args.scaleName.trim();
  if (!scaleName) throw new Error("Enter the scale name");
  const chosen = args.moduleTypes?.length
    ? ALL_WORK_TYPES.filter((t) => args.moduleTypes!.includes(t))
    : ALL_WORK_TYPES;
  const store = await getJobCardStore();
  const nowIso = new Date().toISOString();
  await store.enqueueAddScale({
    id: newId(),
    nowIso,
    payload: {
      scaleId: newId(),
      jobCardId: args.jobCardId,
      scaleName,
      scopeOfWork: args.scopeOfWork.trim() || null,
      userSub: currentUser.sub,
      userName: currentUser.name,
      addedAt: nowIso,
      modules: chosen.map((moduleType) => ({ id: newId(), moduleType })),
    },
  });
  notify();
  void requestSyncAfterChange();
}

export async function submitWorkItem(
  item: WorkItemView,
  form: AnyForm,
  baseline: ScaleBaseline | null,
  opts?: { edit?: boolean },
): Promise<PrepareResult> {
  if (!currentUser) throw new Error("Not signed in");
  const nowIso = new Date().toISOString();
  const store = await getJobCardStore();
  let edit: { revision: number; editOf: string } | undefined;
  if (opts?.edit) {
    const history = await store.resultHistory(item.id);
    edit = { revision: history.count + 1, editOf: history.lastId ?? "" };
  }
  const prepared = prepareSubmission({
    item,
    form,
    baseline,
    userSub: currentUser.sub,
    userName: currentUser.name,
    nowIso,
    newId,
    edit,
  });
  if (!prepared.ok) return prepared;
  await store.enqueueResult({
    id: prepared.id,
    workItemId: item.id,
    jobCardId: item.jobCardId,
    payload: JSON.stringify(prepared.payload),
    submittedAt: prepared.submittedAt,
    nowIso,
  });
  if (opts?.edit) await store.saveDraft(item.id, form, nowIso);
  notify();
  void requestSyncAfterChange();
  return prepared;
}

export async function retryBlocked(): Promise<void> {
  const store = await getJobCardStore();
  await store.retryBlocked(new Date().toISOString());
  notify();
  void requestSync();
}

// ------------------------------------------------------------------- the data
export interface JobCardData {
  loaded: boolean;
  items: WorkItemView[];
  unsent: number;
  blocked: number;
  lastPullAt: string | null;
}

export function useJobCardData(
  userSub: string | undefined,
): JobCardData & { reload: () => Promise<void> } {
  const [data, setData] = useState<JobCardData>({
    loaded: false,
    items: [],
    unsent: 0,
    blocked: 0,
    lastPullAt: null,
  });

  const reload = useCallback(async () => {
    if (!userSub) {
      setData((d) => ({ ...d, loaded: true }));
      return;
    }
    try {
      const store = await getJobCardStore();
      const [items, unsent, blocked, lastPullAt] = await Promise.all([
        store.listMyWork(userSub),
        store.unsentResultCount(userSub),
        store.blockedCount(),
        store.getMeta("lastPullAt"),
      ]);
      setData({ loaded: true, items, unsent, blocked, lastPullAt });
    } catch (e) {
      console.warn("[jobcards] could not read the phone's job card data:", e);
      setData((d) => ({ ...d, loaded: true }));
    }
  }, [userSub]);

  useEffect(() => {
    void reload();
    return subscribeJobCards(() => {
      void reload();
    });
  }, [reload]);

  return { ...data, reload };
}

// ---------------------------------------------------------- open job cards
export interface OpenJobCardsSummary {
  loaded: boolean;
  count: number;
  minutes: number | null;
}

export const formatMinutes = (m: number): string => {
  if (m < 1) return "0m";
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
};

export function useJobCardMe(userSub: string | undefined): Me {
  const [me, setMe] = useState<Me>({
    ids: new Set(userSub ? [userSub] : []),
    email: normEmail(currentUser?.email),
  });

  useEffect(() => {
    if (!userSub) return;
    let cancelled = false;
    setMe({
      ids: new Set([userSub]),
      email: normEmail(getJobCardUser()?.email),
    });
    resolveMyIds(userSub)
      .then((ids) => {
        if (!cancelled)
          setMe((m) => ({ ...m, ids: new Set([userSub, ...ids]) }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userSub]);

  return me;
}

export function useJobCardTimes(
  userSub: string | undefined,
): Map<string, JobCardTime> {
  const [times, setTimes] = useState<Map<string, JobCardTime>>(new Map());
  const [version, setVersion] = useState(0);
  const [tick, setTick] = useState(0);
  const me = useJobCardMe(userSub);

  useEffect(() => subscribeJobCards(() => setVersion((v) => v + 1)), []);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!userSub) return;
    let cancelled = false;
    (async () => {
      const store = await getJobCardStore();
      const rows = await store.timeRows();
      if (!cancelled)
        setTimes(computeTimes(rows.cache, rows.sessions, me, Date.now()));
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userSub, me, version, tick]);

  return times;
}

export function useOpenJobCards(
  userSub: string | undefined,
): OpenJobCardsSummary {
  const { loaded, items } = useJobCardData(userSub);
  const times = useJobCardTimes(userSub);

  const openIds = useMemo(() => {
    const ids = new Set<string>();
    for (const w of items)
      if (w.jobCardStatus !== "CLOSED" && w.localState === "PENDING")
        ids.add(w.jobCardId);
    return [...ids].sort();
  }, [items]);

  const minutes = useMemo(
    () => openIds.reduce((n, id) => n + (times.get(id)?.myMinutes ?? 0), 0),
    [openIds, times],
  );

  return { loaded, count: openIds.length, minutes };
}
