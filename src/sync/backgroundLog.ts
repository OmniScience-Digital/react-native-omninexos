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
// A single record is bounded too: an error message can be a whole HTML page, and the whole list is rewritten on
// every step, so one huge string would make every write slow and could hit the AsyncStorage size limit.
const MAX_TEXT = 300;
const MAX_ROW_ERRORS = 5;
const clip = (s: string | undefined): string | undefined =>
  s && s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…` : s;

export interface BackgroundRun {
  id: string;
  /** Which task body ran, e.g. "jobcards". */
  task: string;
  startedAt: string;
  finishedAt: string | null;
  /** null while running or if the run never finished. */
  outcome: string | null;
  /** The last stage the run reached. For a run that never finished, this is where it stopped. */
  step?: string;
  /** When that step was reached. With `startedAt` it shows whether a run died at once or hung for a long time. */
  stepAt?: string;
  /** Why sends failed or were set aside in this run: one short line per row (kind, attempts, the error message). */
  rowErrors?: string[];
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

/** Record the stage a run has reached, so a run that hangs or is killed shows where it stopped. */
export function markBackgroundStep(id: string, step: string): Promise<void> {
  return serial(async () => {
    const runs = await readAll();
    const run = runs.find((r) => r.id === id);
    if (!run) return;
    run.step = clip(step);
    run.stepAt = new Date().toISOString();
    await writeAll(runs);
  }).catch(() => undefined);
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
    Object.assign(run, result, {
      error: clip(result.error),
      rowErrors: result.rowErrors
        ?.slice(0, MAX_ROW_ERRORS)
        .map((e) => clip(e) as string),
      finishedAt: new Date().toISOString(),
    });
    await writeAll(runs);
  }).catch(() => undefined);
}

// ── Registration diagnostics ────────────────────────────────────────────────────────────────────────────────────
// Whether the OS task actually got registered after sign-in. Without this a failed registration is only a
// console warning, which nobody can read on a release build.
const REG_KEY = "bg:registration:v1";

export interface BackgroundRegistration {
  at: string;
  /** What we asked for: "register" after sign-in, "unregister" after sign-out. */
  action: "register" | "unregister";
  /** Was the task registered with the OS when we finished? */
  registered: boolean;
  /** expo-background-task status: 1 = restricted (OS will not run it), 2 = available. */
  status?: number;
  error?: string;
}

export async function recordRegistration(
  r: Omit<BackgroundRegistration, "at">,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      REG_KEY,
      JSON.stringify({ ...r, at: new Date().toISOString() }),
    );
  } catch {
    /* logging must never throw */
  }
}

export async function getRegistration(): Promise<BackgroundRegistration | null> {
  try {
    const raw = await AsyncStorage.getItem(REG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
