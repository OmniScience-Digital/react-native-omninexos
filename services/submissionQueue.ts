// services/submissionQueue.ts
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

export type SubmissionType = "vif" | "stock" | "clockin" | "clockout";
export type SubmissionStatus = "pending" | "syncing" | "completed" | "failed";

export interface QueuedSubmission {
  id: number;
  type: SubmissionType;
  payload: string;
  status: SubmissionStatus;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
}

const DB_NAME = "submissions.db";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;
const OPEN_ATTEMPTS = 3;

// ------------------------------------------------------------------
// Connection management
//
// expo-sqlite (Android) keeps a native cache of open databases BY NAME and
// hands the SAME native handle to every openDatabaseAsync(name) call, with a
// reference count. That bites this queue in two ways:
//   1. A reopen attempt that opens fine but then fails (e.g. at CREATE TABLE)
//      and is simply abandoned keeps its reference forever. Later the shared
//      handle can be released/closed underneath the live connection, and
//      because the leaked reference stops the count from ever reaching zero,
//      the broken handle stays cached: every retry gets the same dead handle
//      and fails with NativeDatabase.execAsync ... NullPointerException until
//      the app is restarted.
//   2. Closing "our" connection can close one another caller is still using.
//
// So: every connection is opened with useNewConnection (never the shared
// cached handle), a failed attempt is always closed, there is exactly one
// in-flight open, and a failing connection is discarded by identity.
// ------------------------------------------------------------------
let db: SQLite.SQLiteDatabase | null = null;
let opening: Promise<SQLite.SQLiteDatabase> | null = null;
let hasOpenedThisSession = false;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Close a connection; never throws. */
async function closeQuietly(handle: SQLite.SQLiteDatabase | null | undefined) {
  if (!handle) return;
  try {
    await handle.closeAsync();
  } catch (closeErr) {
    console.warn("[submissionQueue] Ignored close error:", closeErr);
  }
}

/** Forget `handle` if it is the current connection, and close it. */
async function discardHandle(handle: SQLite.SQLiteDatabase) {
  if (db === handle) db = null;
  await closeQuietly(handle);
}

async function openFresh(): Promise<SQLite.SQLiteDatabase> {
  // On Android the JSI/native bridge needs a moment to settle on a cold launch
  // before SQLite can open (150ms was not enough on Samsung devices).
  if (Platform.OS === "android" && !hasOpenedThisSession) {
    await sleep(400);
  }

  let lastError: any;
  for (let attempt = 1; attempt <= OPEN_ATTEMPTS; attempt++) {
    let candidate: SQLite.SQLiteDatabase | null = null;
    try {
      // useNewConnection: never reuse the native module's cached handle.
      candidate = await SQLite.openDatabaseAsync(DB_NAME, {
        useNewConnection: true,
      });
      await candidate.execAsync(`
        PRAGMA busy_timeout = 3000;
        CREATE TABLE IF NOT EXISTS pending_submissions (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          type        TEXT    NOT NULL,
          payload     TEXT    NOT NULL,
          status      TEXT    NOT NULL DEFAULT 'pending',
          retry_count INTEGER NOT NULL DEFAULT 0,
          created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
          error_msg   TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_status ON pending_submissions(status);
      `);
      // Validate the connection is alive immediately after open
      await candidate.getFirstAsync("SELECT 1");
      hasOpenedThisSession = true;
      return candidate;
    } catch (err) {
      lastError = err;
      console.warn(`[submissionQueue] Open attempt ${attempt} failed:`, err);
      await closeQuietly(candidate); // never leak a half-open handle
      if (attempt < OPEN_ATTEMPTS) await sleep(200 * attempt);
    }
  }
  throw new Error(
    `Failed to open database after ${OPEN_ATTEMPTS} attempts: ${lastError?.message}`,
  );
}

/** Exactly one open in flight; everyone else awaits the same promise. */
function openShared(): Promise<SQLite.SQLiteDatabase> {
  if (!opening) {
    opening = openFresh()
      .then((fresh) => {
        db = fresh;
        return fresh;
      })
      .finally(() => {
        opening = null;
      });
  }
  return opening;
}

// ------------------------------------------------------------------
// Get a valid database connection
// ------------------------------------------------------------------
async function getDb(): Promise<SQLite.SQLiteDatabase> {
  const current = db;
  if (current) {
    try {
      await current.getFirstAsync("SELECT 1");
      return current;
    } catch (err) {
      console.warn("[submissionQueue] Cached db invalid, reopening", err);
      await discardHandle(current);
    }
  }
  return openShared();
}

// ------------------------------------------------------------------
// Drop the cached connection (waits for any open in flight first)
// ------------------------------------------------------------------
export const resetDbConnection = async (): Promise<void> => {
  if (opening) {
    try {
      await opening;
    } catch {
      // ignore – nothing to reset if the open failed
    }
  }
  const current = db;
  db = null;
  await closeQuietly(current);
};

// ------------------------------------------------------------------
// Re-validate (and if needed repair) the connection, e.g. on app resume, so
// it is ready before the user taps "Save Offline". Never throws.
// ------------------------------------------------------------------
export const warmDbConnection = async (): Promise<void> => {
  try {
    await getDb();
  } catch (err) {
    console.warn("[submissionQueue] Warm-up failed:", err);
  }
};

// ------------------------------------------------------------------
// Retry wrapper for all database operations
// ------------------------------------------------------------------
async function withRetry<T>(
  operation: (db: SQLite.SQLiteDatabase) => Promise<T>,
  context: string,
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let database: SQLite.SQLiteDatabase | null = null;
    try {
      database = await getDb();
      return await operation(database);
    } catch (err: any) {
      lastError = err;
      const isConnectionError =
        err?.message?.includes("database not open") ||
        err?.message?.includes("prepareAsync") ||
        err?.message?.includes("finalizeAsync") ||
        err?.message?.includes("NullPointerException") ||
        err?.message?.includes("has been rejected") ||
        err?.code === "SQLITE_ERROR" ||
        err?.code === "SQLITE_NOTADB";
      if (isConnectionError && attempt === 1) {
        console.warn(
          `[submissionQueue] ${context} failed, resetting DB and retrying`,
          err,
        );
        // Discard only the connection that failed, so a healthy one opened
        // meanwhile by another caller is left alone.
        if (database) await discardHandle(database);
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// ------------------------------------------------------------------
// Public API (each method uses withRetry)
// ------------------------------------------------------------------

export const enqueue = async (
  type: SubmissionType,
  payload: object,
): Promise<number> => {
  return withRetry(async (database) => {
    const result = await database.runAsync(
      `INSERT INTO pending_submissions (type, payload, status) VALUES (?, ?, 'pending')`,
      [type, JSON.stringify(payload)],
    );
    return result.lastInsertRowId;
  }, "enqueue");
};

export const getPending = async (): Promise<QueuedSubmission[]> => {
  return withRetry(async (database) => {
    const rows = await database.getAllAsync<any>(
      `SELECT * FROM pending_submissions
       WHERE status IN ('pending', 'failed') AND retry_count < ?
       ORDER BY created_at ASC,
         CASE type WHEN 'clockin' THEN 0 WHEN 'clockout' THEN 1 ELSE 2 END ASC`,
      [MAX_RETRIES],
    );
    return rows.map(mapRow);
  }, "getPending");
};

export const getPendingCount = async (): Promise<number> => {
  return withRetry(async (database) => {
    const row = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM pending_submissions
       WHERE status IN ('pending', 'failed') AND retry_count < ?`,
      [MAX_RETRIES],
    );
    return row?.count ?? 0;
  }, "getPendingCount");
};

export const markSyncing = async (id: number): Promise<void> => {
  return withRetry(async (database) => {
    await database.runAsync(
      `UPDATE pending_submissions SET status = 'syncing', updated_at = datetime('now') WHERE id = ?`,
      [id],
    );
  }, "markSyncing");
};

export const markCompleted = async (id: number): Promise<void> => {
  return withRetry(async (database) => {
    await database.runAsync(
      `UPDATE pending_submissions SET status = 'completed', updated_at = datetime('now') WHERE id = ?`,
      [id],
    );
  }, "markCompleted");
};

export const markFailed = async (
  id: number,
  errorMessage: string,
): Promise<void> => {
  return withRetry(async (database) => {
    await database.runAsync(
      `UPDATE pending_submissions
       SET status = 'failed', retry_count = retry_count + 1, error_msg = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [errorMessage, id],
    );
  }, "markFailed");
};

export const getFailedPermanent = async (): Promise<QueuedSubmission[]> => {
  return withRetry(async (database) => {
    const rows = await database.getAllAsync<any>(
      `SELECT * FROM pending_submissions
       WHERE status = 'failed' AND retry_count >= ?
       ORDER BY created_at DESC`,
      [MAX_RETRIES],
    );
    return rows.map(mapRow);
  }, "getFailedPermanent");
};

export const pruneCompleted = async (): Promise<void> => {
  return withRetry(async (database) => {
    await database.runAsync(
      `DELETE FROM pending_submissions WHERE status = 'completed' AND updated_at < datetime('now', '-7 days')`,
    );
  }, "pruneCompleted");
};

export const resetForRetry = async (id: number): Promise<void> => {
  return withRetry(async (database) => {
    await database.runAsync(
      `UPDATE pending_submissions
       SET status = 'pending', retry_count = 0, error_msg = NULL, updated_at = datetime('now')
       WHERE id = ?`,
      [id],
    );
  }, "resetForRetry");
};

export const resetStuckSyncing = async (): Promise<void> => {
  return withRetry(async (database) => {
    const result = await database.runAsync(
      `UPDATE pending_submissions SET status = 'pending', updated_at = datetime('now') WHERE status = 'syncing'`,
    );
    if (result.changes > 0) {
      console.log(
        `[Queue] Reset ${result.changes} stuck syncing row(s) to pending`,
      );
    }
  }, "resetStuckSyncing");
};

// ------------------------------------------------------------------
// Discard queued submissions when the Amplify backend has changed
// ------------------------------------------------------------------
// Every queued payload (vif/stock/clockin/clockout) embeds foreign keys —
// fleet IDs, category IDs, subcategory IDs — that only exist in whichever
// backend was active when the item was queued. If the app is later pointed
// at a different backend (e.g. switching from a test environment to main),
// syncing these old-environment IDs against the new backend can fail
// outright, or worse, silently attach to the wrong records if an ID happens
// to collide. There is no safe way to "translate" a queued payload between
// environments, so anything not yet confirmed synced must be discarded
// rather than risk writing it to the wrong database.
//
// Rows already marked 'completed' are historical records of past
// successful syncs and are removed too, since they're tied to the old
// backend's IDs and have no further sync action pending against them.
export const purgeAllForEnvironmentChange = async (): Promise<number> => {
  return withRetry(async (database) => {
    const result = await database.runAsync(`DELETE FROM pending_submissions`);
    if (result.changes > 0) {
      console.log(
        `[Queue] Environment change detected — discarded ${result.changes} queued submission(s) to avoid syncing against the wrong backend`,
      );
    }
    return result.changes;
  }, "purgeAllForEnvironmentChange");
};

const mapRow = (row: any): QueuedSubmission => ({
  id: row.id,
  type: row.type as SubmissionType,
  payload: row.payload,
  status: row.status as SubmissionStatus,
  retryCount: row.retry_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  errorMessage: row.error_msg ?? undefined,
});
