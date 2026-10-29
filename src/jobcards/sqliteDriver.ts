// src/jobcards/sqliteDriver.ts
// Opens the phone's SQLite file for the Job Cards module. Opened the same careful way as services/submissionQueue.ts
// (Android needs a moment on a cold start; a fresh connection each time; a few attempts; one open shared by everyone).
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { JobCardStore, type SqlDriver, type SqlValue } from "./store";

const DB_NAME = "jobcards.db";
const OPEN_ATTEMPTS = 3;
// Android does not fire JavaScript timers when the OS starts the app with no screen (a background wake), so a
// `setTimeout` wait there never ends and the whole background sync hangs at its first step. The background task
// switches the waits off while it runs; the foreground keeps them.
let skipDelays = false;
export function setSkipDelays(on: boolean): void {
  skipDelays = on;
}
const sleep = (ms: number) =>
  skipDelays ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms));

let opening: Promise<SQLite.SQLiteDatabase> | null = null;
let hasOpenedThisSession = false;

async function closeQuietly(handle: SQLite.SQLiteDatabase | null | undefined) {
  if (!handle) return;
  try {
    await handle.closeAsync();
  } catch (e) {
    console.warn("[jobcards] ignored close error:", e);
  }
}

async function openFresh(): Promise<SQLite.SQLiteDatabase> {
  if (Platform.OS === "android" && !hasOpenedThisSession) await sleep(400);
  let lastError: unknown;
  for (let attempt = 1; attempt <= OPEN_ATTEMPTS; attempt++) {
    let candidate: SQLite.SQLiteDatabase | null = null;
    try {
      candidate = await SQLite.openDatabaseAsync(DB_NAME, {
        useNewConnection: true,
      });
      await candidate.execAsync("PRAGMA busy_timeout = 3000;");
      await candidate.getFirstAsync("SELECT 1");
      hasOpenedThisSession = true;
      return candidate;
    } catch (err) {
      lastError = err;
      console.warn(`[jobcards] open attempt ${attempt} failed:`, err);
      await closeQuietly(candidate);
      if (attempt < OPEN_ATTEMPTS) await sleep(200 * attempt);
    }
  }
  throw new Error(
    `Could not open the job cards database: ${(lastError as Error)?.message}`,
  );
}

function openShared(): Promise<SQLite.SQLiteDatabase> {
  if (!opening) {
    opening = openFresh().catch((e) => {
      opening = null;
      throw e;
    });
  }
  return opening;
}

/** One write at a time: SQLite on a single connection does not like overlapping transactions. */
let writeChain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => undefined);
  return next;
}

/** Queries on one open connection. `tx` (inside a transaction) uses this too, but without waiting in the write chain. */
function on(db: SQLite.SQLiteDatabase): SqlDriver {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: SqlValue[] = []) => {
      await db.runAsync(sql, params);
    },
    all: async <T>(sql: string, params: SqlValue[] = []) =>
      (await db.getAllAsync(sql, params)) as T[],
    first: async <T>(sql: string, params: SqlValue[] = []) =>
      ((await db.getFirstAsync(sql, params)) as T | null) ?? null,
    transaction: () => {
      throw new Error("Transactions cannot be nested");
    },
  };
}

const driver: SqlDriver = {
  async exec(sql) {
    const db = await openShared();
    await serial(() => on(db).exec(sql));
  },
  async run(sql, params: SqlValue[] = []) {
    const db = await openShared();
    await serial(() => on(db).run(sql, params));
  },
  async all<T>(sql: string, params: SqlValue[] = []) {
    return on(await openShared()).all<T>(sql, params);
  },
  async first<T>(sql: string, params: SqlValue[] = []) {
    return on(await openShared()).first<T>(sql, params);
  },
  async transaction<T>(fn: (tx: SqlDriver) => Promise<T>) {
    const db = await openShared();
    let result!: T;
    // The whole transaction holds the write chain, so no other write can slip in between BEGIN and COMMIT.
    await serial(async () => {
      await db.execAsync("BEGIN");
      try {
        result = await fn(on(db));
        await db.execAsync("COMMIT");
      } catch (e) {
        try {
          await db.execAsync("ROLLBACK");
        } catch {
          /* connection already unusable */
        }
        throw e;
      }
    });
    return result;
  },
};

let store: JobCardStore | null = null;
let ready: Promise<JobCardStore> | null = null;

/** The one store for the whole app. Creates the tables the first time. */
export function getJobCardStore(): Promise<JobCardStore> {
  if (!ready) {
    ready = (async () => {
      store = new JobCardStore(driver);
      await store.init();
      return store;
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}
