// src/jobcards/controller.ts
// The one place the screens talk to: it owns the store, the server calls and "tell me when something changed".
import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useMemo, useState } from "react";
import { jobCardApi, resolveMyIds } from "./api";
import { newId } from "./ids";
import { deletePhotoFiles } from "./photos";
import { getJobCardStore } from "./sqliteDriver";
import { prepareSubmission, type PrepareResult } from "./submission";
import { runSync, type SyncSummary } from "./sync";
import type {
  AnyForm,
  ScaleBaseline,
  StartTimePayload,
  WorkItemType,
  WorkItemView,
} from "./types";

// ----------------------------------------------------------- who is signed in
export interface JobCardUser {
  sub: string;
  name: string;
}
let currentUser: JobCardUser | null = null;
export const getJobCardUser = () => currentUser;
export const setJobCardUser = (u: JobCardUser | null) => {
  currentUser = u;
};

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

/** Send what is waiting and refresh the assigned work. Never throws: problems are kept for the next try. */
export async function requestSync(): Promise<SyncSummary | null> {
  if (!currentUser) return null;
  syncDepth += 1;
  notify();
  try {
    const store = await getJobCardStore();
    lastSummary = await runSync(
      {
        store,
        api: jobCardApi,
        now: () => new Date(),
        isOnline,
        cleanupFiles: deletePhotoFiles,
      },
      currentUser.sub,
    );
    notify();
    return lastSummary;
  } catch (e) {
    console.warn("[jobcards] sync failed:", e);
    return null;
  } finally {
    syncDepth -= 1;
    notify(); // also tells the screen the "Syncing" line can go
  }
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
  const store = await getJobCardStore();
  await store.recoverStuck(new Date().toISOString());
  notify();
}

// -------------------------------------------------------------- doing the work
/** Technician opened a work item: queue "started working" once per job card (the server also ignores repeats). */
export async function noteWorkStarted(jobCardId: string): Promise<void> {
  if (!currentUser) return;
  const store = await getJobCardStore();
  const payload: StartTimePayload = {
    userSub: currentUser.sub,
    userName: currentUser.name,
    startedAt: new Date().toISOString(),
  };
  const queued = await store.enqueueStartTimeOnce({
    id: newId(),
    jobCardId,
    payload: JSON.stringify(payload),
    nowIso: payload.startedAt,
    withinMs: 6 * 3_600_000,
  });
  if (queued) void requestSync();
}

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

/** Every type of work a scale can have, in the order it is created and shown. */
const ALL_WORK_TYPES: readonly WorkItemType[] = [
  "INSPECTION",
  "ZERO_CALIBRATION",
  "SPAN_CALIBRATION",
];

/**
 * The technician adds a scale to an open job card. Its scope of work is the types of work chosen
 * (all three when none are given). It shows at once and is sent when online.
 */
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
  void requestSync();
}

/** Validate, then save the finished work on the phone and start sending. Returns the problems if it is not complete. */
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
  if (opts?.edit) await store.saveDraft(item.id, form, nowIso); // the finished work now shows the edited answers
  notify();
  void requestSync(); // goes out at once if there is signal, otherwise waits in the outbox
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

/** The technician's work, live: updates whenever something is saved, sent or refreshed. */
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
      // nobody to load for yet: show "nothing here" rather than loading forever
      setData((d) => ({ ...d, loaded: true }));
      return;
    }
    try {
      const store = await getJobCardStore();
      const [items, unsent, blocked, lastPullAt] = await Promise.all([
        store.listMyWork(userSub),
        store.unsentResultCount(),
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
  /** Job cards that are still open and have work left for this user */
  count: number;
  /** Minutes this user has spent on those job cards (null until known) */
  minutes: number | null;
}

export const formatMinutes = (m: number): string => {
  if (m < 1) return "0m";
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
};

/** For the home screen: how many job cards are open for the user, and the time they have spent on them. */
export function useOpenJobCards(
  userSub: string | undefined,
): OpenJobCardsSummary {
  const { loaded, items } = useJobCardData(userSub);
  const [minutes, setMinutes] = useState<number | null>(null);

  const openIds = useMemo(() => {
    const ids = new Set<string>();
    for (const w of items)
      if (w.jobCardStatus !== "CLOSED" && w.localState === "PENDING")
        ids.add(w.jobCardId);
    return [...ids].sort();
  }, [items]);
  const key = openIds.join(",");

  useEffect(() => {
    if (!userSub || openIds.length === 0) {
      setMinutes(openIds.length === 0 ? 0 : null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (!(await isOnline())) return; // keep the last known figure
        const mine = new Set(await resolveMyIds(userSub));
        let total = 0;
        for (const id of openIds) {
          const entries = await jobCardApi.listTimeEntries(id);
          for (const e of entries) {
            if (!mine.has(e.userId)) continue;
            if (e.endedAt) total += e.minutes ?? 0;
            else if (e.startedAt)
              total += Math.max(
                0,
                (Date.now() - new Date(e.startedAt).getTime()) / 60_000,
              );
          }
        }
        if (!cancelled) setMinutes(total);
      } catch (e) {
        console.warn("[jobcards] could not total time spent:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSub, key]);

  return { loaded, count: openIds.length, minutes };
}
