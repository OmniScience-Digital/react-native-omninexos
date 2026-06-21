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

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// ------------------------------------------------------------------
// Force a full database reopen (with up to 3 retries)
// ------------------------------------------------------------------
async function forceReopen(): Promise<SQLite.SQLiteDatabase> {
  // On Android APK builds the JSI/native bridge needs a moment to
  // settle before SQLite can open. Expo Go is immune (it pre-warms
  // the bridge), but a cold APK launch reliably NPEs without this.
  if (Platform.OS === "android" && !db) {
    await new Promise((r) => setTimeout(r, 150));
  }

  // Close existing connection if any
  if (db) {
    try {
      await db.closeAsync();
    } catch (closeErr) {
      console.warn("[submissionQueue] Ignored close error:", closeErr);
    }
    db = null;
  }
  initPromise = null;

  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const newDb = await SQLite.openDatabaseAsync(DB_NAME);
      await newDb.execAsync(`
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
      await newDb.getFirstAsync("SELECT 1");
      db = newDb;
      return newDb;
    } catch (err) {
      lastError = err;
      console.warn(`[submissionQueue] Open attempt ${attempt} failed:`, err);
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
      }
    }
  }
  throw new Error(
    `Failed to open database after 3 attempts: ${lastError?.message}`,
  );
}

// ------------------------------------------------------------------
// Get a valid database connection (with aggressive reopen on failure)
// ------------------------------------------------------------------
async function getDb(): Promise<SQLite.SQLiteDatabase> {
  // If we already have a cached connection, validate it
  if (db) {
    try {
      await db.getFirstAsync("SELECT 1");
      return db;
    } catch (err) {
      console.warn("[submissionQueue] Cached db invalid, forcing reopen", err);
      return await forceReopen();
    }
  }

  // If an init is already in flight, wait for it but be ready to retry
  if (initPromise) {
    try {
      const dbInstance = await initPromise;
      await dbInstance.getFirstAsync("SELECT 1");
      return dbInstance;
    } catch (err) {
      console.warn(
        "[submissionQueue] Pending init failed, forcing reopen",
        err,
      );
      return await forceReopen();
    }
  }

  // No cached connection – start a fresh init
  initPromise = forceReopen().catch((err) => {
    initPromise = null;
    throw err;
  });
  return await initPromise;
}

// ------------------------------------------------------------------
// Reset the cached connection (now does a proper close)
// ------------------------------------------------------------------
export const resetDbConnection = async (): Promise<void> => {
  if (db) {
    try {
      await db.closeAsync();
    } catch (e) {
      // ignore
    }
    db = null;
  }
  initPromise = null;
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
    try {
      const database = await getDb();
      return await operation(database);
    } catch (err: any) {
      lastError = err;
      const isConnectionError =
        err?.message?.includes("database not open") ||
        err?.message?.includes("prepareAsync") ||
        err?.message?.includes("NullPointerException") ||
        err?.code === "SQLITE_ERROR" ||
        err?.code === "SQLITE_NOTADB";
      if (isConnectionError && attempt === 1) {
        console.warn(
          `[submissionQueue] ${context} failed, resetting DB and retrying`,
          err,
        );
        await resetDbConnection(); // Now does a full close
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
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
