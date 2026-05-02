// services/submissionQueue.ts
// Single source of truth for all offline form submissions.
// Both VIF and Stock Control write here. The sync engine reads here.

import * as SQLite from "expo-sqlite";

export type SubmissionType = "vif" | "stock";
export type SubmissionStatus = "pending" | "syncing" | "completed" | "failed";

export interface QueuedSubmission {
  id: number;
  type: SubmissionType;
  payload: string; // JSON string
  status: SubmissionStatus;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
}

const DB_NAME = "submissions.db";
const MAX_RETRIES = 3;

// ─── Open / init ─────────────────────────────────────────────
let db: SQLite.SQLiteDatabase | null = null;

const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
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
  return db;
};

// ─── Public API ───────────────────────────────────────────────

/**
 * Add a new submission to the queue.
 * Call this instead of hitting the API directly when offline.
 */
export const enqueue = async (
  type: SubmissionType,
  payload: object,
): Promise<number> => {
  const database = await getDb();
  const result = await database.runAsync(
    `INSERT INTO pending_submissions (type, payload, status)
     VALUES (?, ?, 'pending')`,
    [type, JSON.stringify(payload)],
  );
  return result.lastInsertRowId;
};

/**
 * Get all pending rows, oldest first.
 */
export const getPending = async (): Promise<QueuedSubmission[]> => {
  const database = await getDb();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM pending_submissions
     WHERE status IN ('pending', 'failed') AND retry_count < ?
     ORDER BY created_at ASC`,
    [MAX_RETRIES],
  );
  return rows.map(mapRow);
};

/**
 * Get count of pending submissions (for UI badge).
 */
export const getPendingCount = async (): Promise<number> => {
  const database = await getDb();
  const row = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM pending_submissions
     WHERE status IN ('pending', 'failed') AND retry_count < ?`,
    [MAX_RETRIES],
  );
  return row?.count ?? 0;
};

/**
 * Mark a row as syncing (in progress).
 */
export const markSyncing = async (id: number): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    `UPDATE pending_submissions
     SET status = 'syncing', updated_at = datetime('now')
     WHERE id = ?`,
    [id],
  );
};

/**
 * Mark a row as successfully completed.
 */
export const markCompleted = async (id: number): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    `UPDATE pending_submissions
     SET status = 'completed', updated_at = datetime('now')
     WHERE id = ?`,
    [id],
  );
};

/**
 * Mark a row as failed and increment retry count.
 */
export const markFailed = async (
  id: number,
  errorMessage: string,
): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    `UPDATE pending_submissions
     SET status = 'failed',
         retry_count = retry_count + 1,
         error_msg = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    [errorMessage, id],
  );
};

/**
 * Get all failed submissions that have exhausted retries (for UI display).
 */
export const getFailedPermanent = async (): Promise<QueuedSubmission[]> => {
  const database = await getDb();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM pending_submissions
     WHERE status = 'failed' AND retry_count >= ?
     ORDER BY created_at DESC`,
    [MAX_RETRIES],
  );
  return rows.map(mapRow);
};

/**
 * Delete completed rows older than 7 days (housekeeping).
 */
export const pruneCompleted = async (): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    `DELETE FROM pending_submissions
     WHERE status = 'completed'
       AND updated_at < datetime('now', '-7 days')`,
  );
};

/**
 * Reset a permanently failed row to pending so the user can retry manually.
 */
export const resetForRetry = async (id: number): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    `UPDATE pending_submissions
     SET status = 'pending', retry_count = 0, error_msg = NULL,
         updated_at = datetime('now')
     WHERE id = ?`,
    [id],
  );
};

// ─── Internal helpers ─────────────────────────────────────────
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
