// src/sync/backgroundLog.ts
// A small persisted record of every OS background wake. It answers the question we could not answer before:
// "did the OS wake the app at all, and what happened when it did?"
//
// A run is written the moment the task starts (finishedAt = null) and completed when it ends. A record that
// started but never finished means the OS killed the task mid-run (time budget) or the JS crashed.
//
// Stored in AsyncStorage (not the job-card SQLite file) so it works even if SQLite is the thing that is broken.
// Every function here swallows its own errors: logging must never be the reason a sync fails.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "bg:runs:v1";
const MAX_RUNS = 20;

export interface BackgroundRun {
  id: string;
  /** Which task body ran, e.g. "jobcards". */
  task: string;
  startedAt: string;
  finishedAt: string | null;
  /** null while running or if the run never finished. */
  outcome: string | null;
  sent?: number;
  failedSends?: number;
  blocked?: number;
  pulledItems?: number;
  error?: string;
}

// Writes are serialised so two overlapping wakes cannot overwrite each other's record.
let chain: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
};

async function readAll(): Promise<BackgroundRun[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(runs: BackgroundRun[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(runs.slice(-MAX_RUNS)));
  } catch {
    /* logging must never throw */
  }
}

/** Record that a background run has started. Returns its id for `finishBackgroundRun`. */
export function beginBackgroundRun(task: string): Promise<string> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return serial(async () => {
    const runs = await readAll();
    runs.push({
      id,
      task,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      outcome: null,
    });
    await writeAll(runs);
    return id;
  }).catch(() => id);
}

/** Complete a run started with `beginBackgroundRun`. */
export function finishBackgroundRun(
  id: string,
  result: Partial<Omit<BackgroundRun, "id" | "task" | "startedAt">> & {
    outcome: string;
  },
): Promise<void> {
  return serial(async () => {
    const runs = await readAll();
    const run = runs.find((r) => r.id === id);
    if (!run) return;
    Object.assign(run, result, { finishedAt: new Date().toISOString() });
    await writeAll(runs);
  }).catch(() => undefined);
}

/** Newest first. For a debug screen, Sentry context or a support "copy diagnostics" button. */
export async function getBackgroundRuns(): Promise<BackgroundRun[]> {
  return (await readAll()).slice().reverse();
}

export async function clearBackgroundRuns(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
