// src/jobcards/store.ts
// Everything the Job Cards module keeps ON THE PHONE: the assigned work, the half-filled forms, and the outbox of
// finished work waiting to be sent. It talks to SQLite through the small SqlDriver interface, so the same code runs on
// the phone (expo-sqlite) and in tests (a real SQL engine).
import type {
  AddScalePayload,
  CachedJobCard,
  CachedScale,
  LocalState,
  OutboxKind,
  OutboxRow,
  OutboxStatus,
  ScaleBaseline,
  WorkItemType,
  WorkItemView,
} from "./types";

export type SqlValue = string | number | null;

export interface SqlDriver {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T = Record<string, unknown>>(
    sql: string,
    params?: SqlValue[],
  ): Promise<T[]>;
  first<T = Record<string, unknown>>(
    sql: string,
    params?: SqlValue[],
  ): Promise<T | null>;
  /**
   * All-or-nothing: if `fn` throws, nothing it did is kept. `fn` must use the `tx` it is given (not the outer driver)
   * for its queries, so they run inside the transaction.
   */
  transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T>;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jc_jobcards (
  id TEXT PRIMARY KEY, jc_number TEXT NOT NULL, customer_name TEXT, title TEXT,
  status TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jc_scales (
  id TEXT PRIMARY KEY, job_card_id TEXT NOT NULL, scale_name TEXT NOT NULL, scope_of_work TEXT
);
CREATE TABLE IF NOT EXISTS jc_workitems (
  id TEXT PRIMARY KEY, user_sub TEXT NOT NULL, job_card_id TEXT NOT NULL, scale_id TEXT NOT NULL,
  module_type TEXT NOT NULL, sequence INTEGER NOT NULL DEFAULT 0,
  local_state TEXT NOT NULL DEFAULT 'PENDING', assigned_at TEXT, submitted_at TEXT, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jc_wi_user ON jc_workitems(user_sub, local_state);
CREATE TABLE IF NOT EXISTS jc_baseline (
  scale_id TEXT PRIMARY KEY, latest_zero TEXT, latest_span TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jc_drafts (
  work_item_id TEXT PRIMARY KEY, form_json TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jc_outbox (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, work_item_id TEXT, job_card_id TEXT NOT NULL,
  payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT, next_attempt_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jc_outbox_due ON jc_outbox(status, created_at);
CREATE TABLE IF NOT EXISTS jc_meta (key TEXT PRIMARY KEY, value TEXT);
`;

export interface PullData {
  userSub: string;
  nowIso: string;
  jobCards: CachedJobCard[];
  scales: CachedScale[];
  /** Everything currently assigned to this user and still to do, according to the server. */
  items: {
    id: string;
    jobCardId: string;
    scaleId: string;
    moduleType: WorkItemType;
    sequence: number;
    assignedAt?: string | null;
  }[];
  /** Only scales whose baseline was read successfully: the others keep what is already saved. */
  baselines: {
    scaleId: string;
    latestZero: string | null;
    latestSpan: string | null;
  }[];
}

/** How long finished work stays in the list (and on the phone) before it is cleaned up. */
export const KEEP_SUBMITTED_DAYS = 14;
export const KEEP_DONE_OUTBOX_DAYS = 7;
const DAY_MS = 86_400_000;

const toView = (r: Record<string, unknown>): WorkItemView => ({
  id: r.id as string,
  userSub: r.user_sub as string,
  jobCardId: r.job_card_id as string,
  scaleId: r.scale_id as string,
  moduleType: r.module_type as WorkItemType,
  sequence: (r.sequence as number) ?? 0,
  localState: r.local_state as LocalState,
  assignedAt: (r.assigned_at as string) ?? null,
  submittedAt: (r.submitted_at as string) ?? null,
  jcNumber: (r.jc_number as string) ?? "Unknown job card",
  customerName: (r.customer_name as string) ?? null,
  jobCardStatus: (r.jc_status as string) ?? "OPEN",
  jcTitle: (r.jc_title as string) ?? null,
  scaleName: (r.scale_name as string) ?? "Unknown scale",
  scopeOfWork: (r.scope_of_work as string) ?? null,
});

const toOutbox = (r: Record<string, unknown>): OutboxRow => ({
  id: r.id as string,
  kind: r.kind as OutboxKind,
  workItemId: (r.work_item_id as string) ?? null,
  jobCardId: r.job_card_id as string,
  payload: r.payload as string,
  status: r.status as OutboxStatus,
  attempts: (r.attempts as number) ?? 0,
  lastError: (r.last_error as string) ?? null,
  nextAttemptAt: (r.next_attempt_at as string) ?? null,
  createdAt: r.created_at as string,
});

export class JobCardStore {
  constructor(private readonly db: SqlDriver) {}

  async init(): Promise<void> {
    await this.db.exec(SCHEMA);
    try {
      await this.db.exec("ALTER TABLE jc_scales ADD COLUMN scope_of_work TEXT");
    } catch {
      /* the column is already there */
    }
  }

  // ------------------------------------------------------------------ reading
  async listMyWork(userSub: string): Promise<WorkItemView[]> {
    const rows = await this.db.all(
      `SELECT w.*, j.jc_number, j.customer_name, j.title AS jc_title, j.status AS jc_status, s.scale_name, s.scope_of_work
         FROM jc_workitems w
         LEFT JOIN jc_jobcards j ON j.id = w.job_card_id
         LEFT JOIN jc_scales s ON s.id = w.scale_id
        WHERE w.user_sub = ?
        ORDER BY CASE w.local_state WHEN 'PENDING' THEN 0 WHEN 'QUEUED' THEN 1 ELSE 2 END,
                 j.jc_number, s.scale_name, w.module_type, w.sequence`,
      [userSub],
    );
    return rows.map(toView);
  }

  async getWorkItem(id: string): Promise<WorkItemView | null> {
    const r = await this.db.first(
      `SELECT w.*, j.jc_number, j.customer_name, j.title AS jc_title, j.status AS jc_status, s.scale_name, s.scope_of_work
         FROM jc_workitems w
         LEFT JOIN jc_jobcards j ON j.id = w.job_card_id
         LEFT JOIN jc_scales s ON s.id = w.scale_id
        WHERE w.id = ?`,
      [id],
    );
    return r ? toView(r) : null;
  }

  async getBaseline(scaleId: string): Promise<ScaleBaseline | null> {
    const r = await this.db.first(
      "SELECT * FROM jc_baseline WHERE scale_id = ?",
      [scaleId],
    );
    return r
      ? {
          scaleId,
          latestZero: (r.latest_zero as string) ?? null,
          latestSpan: (r.latest_span as string) ?? null,
          updatedAt: r.updated_at as string,
        }
      : null;
  }

  // ------------------------------------------------------------------- drafts
  /** The half-filled form, saved as the technician types so nothing is lost if the app is closed. */
  async saveDraft(
    workItemId: string,
    form: unknown,
    nowIso: string,
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO jc_drafts (work_item_id, form_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(work_item_id) DO UPDATE SET form_json = excluded.form_json, updated_at = excluded.updated_at`,
      [workItemId, JSON.stringify(form), nowIso],
    );
  }

  async getDraft<T>(workItemId: string): Promise<T | null> {
    const r = await this.db.first(
      "SELECT form_json FROM jc_drafts WHERE work_item_id = ?",
      [workItemId],
    );
    if (!r) return null;
    try {
      return JSON.parse(r.form_json as string) as T;
    } catch {
      return null; // a damaged draft is ignored rather than crashing the form
    }
  }

  async deleteDraft(workItemId: string): Promise<void> {
    await this.db.run("DELETE FROM jc_drafts WHERE work_item_id = ?", [
      workItemId,
    ]);
  }

  // --------------------------------------------------- applying what the server said
  /**
   * Replace the cached assignments with the server's latest. Work already done on this phone is never touched:
   * QUEUED and SUBMITTED items keep their state, and anything still waiting in the outbox is left alone.
   */
  async applyPull(d: PullData): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const j of d.jobCards) {
        await tx.run(
          `INSERT INTO jc_jobcards (id, jc_number, customer_name, title, status, updated_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET jc_number = excluded.jc_number, customer_name = excluded.customer_name,
             title = excluded.title, status = excluded.status, updated_at = excluded.updated_at`,
          [
            j.id,
            j.jcNumber,
            j.customerName ?? null,
            j.title ?? null,
            j.status,
            d.nowIso,
          ],
        );
      }
      for (const s of d.scales) {
        await tx.run(
          `INSERT INTO jc_scales (id, job_card_id, scale_name, scope_of_work) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET job_card_id = excluded.job_card_id, scale_name = excluded.scale_name,
             scope_of_work = excluded.scope_of_work`,
          [s.id, s.jobCardId, s.scaleName, s.scopeOfWork ?? null],
        );
      }
      for (const b of d.baselines) {
        await tx.run(
          `INSERT INTO jc_baseline (scale_id, latest_zero, latest_span, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(scale_id) DO UPDATE SET latest_zero = excluded.latest_zero, latest_span = excluded.latest_span,
             updated_at = excluded.updated_at`,
          [b.scaleId, b.latestZero, b.latestSpan, d.nowIso],
        );
      }
      // local_state is deliberately NOT in the update: it belongs to this phone
      for (const i of d.items) {
        await tx.run(
          `INSERT INTO jc_workitems (id, user_sub, job_card_id, scale_id, module_type, sequence, assigned_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET user_sub = excluded.user_sub, job_card_id = excluded.job_card_id,
             scale_id = excluded.scale_id, module_type = excluded.module_type, sequence = excluded.sequence,
             assigned_at = excluded.assigned_at, updated_at = excluded.updated_at`,
          [
            i.id,
            d.userSub,
            i.jobCardId,
            i.scaleId,
            i.moduleType,
            i.sequence,
            i.assignedAt ?? null,
            d.nowIso,
          ],
        );
      }

      // No longer assigned to me (reassigned, removed, or done elsewhere): drop what I have not done
      const keep = new Set(d.items.map((i) => i.id));
      const mine = await tx.all<{ id: string; scale_id: string }>(
        "SELECT id, scale_id FROM jc_workitems WHERE user_sub = ? AND local_state = 'PENDING'",
        [d.userSub],
      );
      // A scale added on this phone that has not reached the server yet is not "removed": it is just not sent
      const unsent = new Set(
        (
          await tx.all<{ s: string }>(
            "SELECT work_item_id AS s FROM jc_outbox WHERE kind = 'add-scale' AND status <> 'done'",
          )
        ).map((r) => r.s),
      );
      for (const row of mine) {
        if (!keep.has(row.id) && !unsent.has(row.scale_id)) {
          await tx.run("DELETE FROM jc_workitems WHERE id = ?", [row.id]);
          await tx.run("DELETE FROM jc_drafts WHERE work_item_id = ?", [
            row.id,
          ]);
        }
      }

      // Finished work older than the keep period
      const cutoff = new Date(
        new Date(d.nowIso).getTime() - KEEP_SUBMITTED_DAYS * DAY_MS,
      ).toISOString();
      await tx.run(
        `DELETE FROM jc_drafts WHERE work_item_id IN
           (SELECT id FROM jc_workitems WHERE local_state = 'SUBMITTED' AND submitted_at IS NOT NULL AND submitted_at < ?)`,
        [cutoff],
      );
      await tx.run(
        "DELETE FROM jc_workitems WHERE local_state = 'SUBMITTED' AND submitted_at IS NOT NULL AND submitted_at < ?",
        [cutoff],
      );

      // Tidy up job cards, scales and baselines nothing refers to any more
      await tx.run(
        "DELETE FROM jc_scales WHERE id NOT IN (SELECT scale_id FROM jc_workitems)",
      );
      await tx.run(
        "DELETE FROM jc_baseline WHERE scale_id NOT IN (SELECT scale_id FROM jc_workitems)",
      );
      await tx.run(
        "DELETE FROM jc_jobcards WHERE id NOT IN (SELECT job_card_id FROM jc_workitems)",
      );
    });
  }

  // ------------------------------------------------------------------- outbox
  /**
   * Finished work: put it in the outbox and mark the work item QUEUED, together. The draft is kept: it is what the
   * finished work shows when it is opened again (it is removed with the work item when the keep period ends).
   * The outbox row id is the id the server record will have.
   */
  async enqueueResult(args: {
    id: string;
    workItemId: string;
    jobCardId: string;
    payload: string;
    submittedAt: string;
    nowIso: string;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO jc_outbox (id, kind, work_item_id, job_card_id, payload, status, attempts, created_at, updated_at)
         VALUES (?, 'submit-result', ?, ?, ?, 'pending', 0, ?, ?)`,
        [
          args.id,
          args.workItemId,
          args.jobCardId,
          args.payload,
          args.nowIso,
          args.nowIso,
        ],
      );
      await tx.run(
        "UPDATE jc_workitems SET local_state = 'QUEUED', submitted_at = ?, updated_at = ? WHERE id = ?",
        [args.submittedAt, args.nowIso, args.workItemId],
      );
    });
  }

  /** How many results this work item has already sent, and the id of the latest (for editing finished work). */
  async resultHistory(
    workItemId: string,
  ): Promise<{ lastId: string | null; count: number }> {
    const rows = await this.db.all(
      "SELECT id FROM jc_outbox WHERE kind = 'submit-result' AND work_item_id = ? ORDER BY created_at DESC",
      [workItemId],
    );
    return {
      lastId: rows.length ? (rows[0].id as string) : null,
      count: rows.length,
    };
  }

  /** A scale the technician adds: it and its work show at once, and are sent to the server when there is signal. */
  async enqueueAddScale(args: {
    id: string;
    payload: AddScalePayload;
    nowIso: string;
  }): Promise<void> {
    const p = args.payload;
    await this.db.transaction(async (tx) => {
      await tx.run(
        "INSERT INTO jc_scales (id, job_card_id, scale_name, scope_of_work) VALUES (?, ?, ?, ?)",
        [p.scaleId, p.jobCardId, p.scaleName, p.scopeOfWork],
      );
      for (const m of p.modules) {
        await tx.run(
          `INSERT INTO jc_workitems (id, user_sub, job_card_id, scale_id, module_type, sequence, local_state, assigned_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, 'PENDING', ?, ?)`,
          [
            m.id,
            p.userSub,
            p.jobCardId,
            p.scaleId,
            m.moduleType,
            args.nowIso,
            args.nowIso,
          ],
        );
      }
      await tx.run(
        `INSERT INTO jc_outbox (id, kind, work_item_id, job_card_id, payload, status, attempts, created_at, updated_at)
         VALUES (?, 'add-scale', ?, ?, ?, 'pending', 0, ?, ?)`,
        [
          args.id,
          p.scaleId,
          p.jobCardId,
          JSON.stringify(p),
          args.nowIso,
          args.nowIso,
        ],
      );
    });
  }

  /**
   * "I have started working on this job card": queue it once. If one was queued for this job card in the last
   * `withinMs`, nothing is added (the server also ignores a start for someone who is already being timed).
   */
  async enqueueStartTimeOnce(args: {
    id: string;
    jobCardId: string;
    payload: string;
    nowIso: string;
    withinMs: number;
  }): Promise<boolean> {
    const since = new Date(
      new Date(args.nowIso).getTime() - args.withinMs,
    ).toISOString();
    const recent = await this.db.first(
      "SELECT id FROM jc_outbox WHERE kind = 'start-time' AND job_card_id = ? AND created_at >= ? LIMIT 1",
      [args.jobCardId, since],
    );
    if (recent) return false;
    await this.db.run(
      `INSERT INTO jc_outbox (id, kind, work_item_id, job_card_id, payload, status, attempts, created_at, updated_at)
       VALUES (?, 'start-time', NULL, ?, ?, 'pending', 0, ?, ?)`,
      [args.id, args.jobCardId, args.payload, args.nowIso, args.nowIso],
    );
    return true;
  }

  /** What is ready to send, oldest first (results go in the order they were finished). */
  async dueOutbox(nowIso: string, limit = 20): Promise<OutboxRow[]> {
    const rows = await this.db.all(
      `SELECT * FROM jc_outbox WHERE status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
        ORDER BY created_at ASC, id ASC LIMIT ?`,
      [nowIso, limit],
    );
    return rows.map(toOutbox);
  }

  async markSyncing(id: string, nowIso: string): Promise<void> {
    await this.db.run(
      "UPDATE jc_outbox SET status = 'syncing', updated_at = ? WHERE id = ?",
      [nowIso, id],
    );
  }

  async updatePayload(
    id: string,
    payload: string,
    nowIso: string,
  ): Promise<void> {
    await this.db.run(
      "UPDATE jc_outbox SET payload = ?, updated_at = ? WHERE id = ?",
      [payload, nowIso, id],
    );
  }

  /** Sent. For a result, the work item becomes SUBMITTED. */
  async markDone(
    row: Pick<OutboxRow, "id" | "kind" | "workItemId">,
    submittedAt: string | null,
    nowIso: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run(
        "UPDATE jc_outbox SET status = 'done', last_error = NULL, next_attempt_at = NULL, updated_at = ? WHERE id = ?",
        [nowIso, row.id],
      );
      if (row.kind === "submit-result" && row.workItemId) {
        await tx.run(
          "UPDATE jc_workitems SET local_state = 'SUBMITTED', submitted_at = COALESCE(?, submitted_at), updated_at = ? WHERE id = ?",
          [submittedAt, nowIso, row.workItemId],
        );
      }
    });
  }

  /** Not sent: try again at `nextAttemptAt`, or (`blocked`) wait until someone looks at it. */
  async markFailed(
    id: string,
    error: string,
    nextAttemptAt: string | null,
    blocked: boolean,
    nowIso: string,
  ): Promise<void> {
    await this.db.run(
      `UPDATE jc_outbox SET status = ?, attempts = attempts + 1, last_error = ?, next_attempt_at = ?, updated_at = ? WHERE id = ?`,
      [
        blocked ? "blocked" : "pending",
        error.slice(0, 500),
        nextAttemptAt,
        nowIso,
        id,
      ],
    );
  }

  /** The app was closed or crashed while sending: those rows go back in the queue. */
  async recoverStuck(nowIso: string): Promise<number> {
    const stuck = await this.db.all(
      "SELECT id FROM jc_outbox WHERE status = 'syncing'",
    );
    if (stuck.length)
      await this.db.run(
        "UPDATE jc_outbox SET status = 'pending', updated_at = ? WHERE status = 'syncing'",
        [nowIso],
      );
    return stuck.length;
  }

  /** "Try again" for rows that were blocked. */
  async retryBlocked(nowIso: string): Promise<number> {
    const blocked = await this.db.all(
      "SELECT id FROM jc_outbox WHERE status = 'blocked'",
    );
    if (blocked.length) {
      await this.db.run(
        "UPDATE jc_outbox SET status = 'pending', next_attempt_at = NULL, updated_at = ? WHERE status = 'blocked'",
        [nowIso],
      );
    }
    return blocked.length;
  }

  /** How many results are saved on the phone and not yet sent (drives the "waiting for signal" badge). */
  async unsentResultCount(): Promise<number> {
    const r = await this.db.first<{ n: number }>(
      "SELECT COUNT(*) AS n FROM jc_outbox WHERE kind = 'submit-result' AND status IN ('pending','syncing','blocked')",
    );
    return r?.n ?? 0;
  }

  async blockedCount(): Promise<number> {
    const r = await this.db.first<{ n: number }>(
      "SELECT COUNT(*) AS n FROM jc_outbox WHERE status = 'blocked'",
    );
    return r?.n ?? 0;
  }

  async getOutbox(id: string): Promise<OutboxRow | null> {
    const r = await this.db.first("SELECT * FROM jc_outbox WHERE id = ?", [id]);
    return r ? toOutbox(r) : null;
  }

  async outboxFor(workItemId: string): Promise<OutboxRow | null> {
    const r = await this.db.first(
      "SELECT * FROM jc_outbox WHERE work_item_id = ? ORDER BY created_at DESC LIMIT 1",
      [workItemId],
    );
    return r ? toOutbox(r) : null;
  }

  /** Photos of finished work that is about to be cleared (call before the pull that clears it). */
  async expiredPhotoPaths(nowIso: string): Promise<string[]> {
    const cutoff = new Date(
      new Date(nowIso).getTime() - KEEP_SUBMITTED_DAYS * DAY_MS,
    ).toISOString();
    const rows = await this.db.all(
      `SELECT form_json FROM jc_drafts WHERE work_item_id IN
         (SELECT id FROM jc_workitems WHERE local_state = 'SUBMITTED' AND submitted_at IS NOT NULL AND submitted_at < ?)`,
      [cutoff],
    );
    const out: string[] = [];
    for (const r of rows) {
      try {
        const form = JSON.parse(r.form_json as string);
        for (const v of Object.values(form.photos ?? {}))
          for (const p of ([] as unknown[]).concat(v))
            if (typeof p === "string" && p) out.push(p);
      } catch {
        /* an unreadable draft has no photos to find */
      }
    }
    return out;
  }

  async pruneDone(nowIso: string): Promise<void> {
    const cutoff = new Date(
      new Date(nowIso).getTime() - KEEP_DONE_OUTBOX_DAYS * DAY_MS,
    ).toISOString();
    await this.db.run(
      "DELETE FROM jc_outbox WHERE status = 'done' AND updated_at < ?",
      [cutoff],
    );
  }

  // --------------------------------------------------------------------- meta
  async getMeta(key: string): Promise<string | null> {
    const r = await this.db.first("SELECT value FROM jc_meta WHERE key = ?", [
      key,
    ]);
    return (r?.value as string) ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.db.run(
      "INSERT INTO jc_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
  }
}
