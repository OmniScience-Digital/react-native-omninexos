// src/jobcards/store.ts
// Everything the Job Cards module keeps ON THE PHONE: the assigned work, the half-filled forms, and the outbox of
// finished work waiting to be sent. It talks to SQLite through the small SqlDriver interface, so the same code runs on
// the phone (expo-sqlite) and in tests (a real SQL engine).
import type { TimeRow } from "./time";
import type {
  AddScalePayload,
  CachedJobCard,
  CachedScale,
  EndTimePayload,
  LocalState,
  OutboxKind,
  OutboxRow,
  OutboxStatus,
  ScaleBaseline,
  StartTimePayload,
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
  transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T>;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jc_jobcards (
  id TEXT PRIMARY KEY, jc_number TEXT NOT NULL, customer_name TEXT, title TEXT,
  status TEXT NOT NULL, updated_at TEXT NOT NULL, closed_at TEXT,
  assigned_to TEXT, assigned_to_name TEXT, assigned_to_email TEXT, assigned_at TEXT
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
CREATE TABLE IF NOT EXISTS jc_remote_results (
  work_item_id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, revision INTEGER NOT NULL, submitted_at TEXT NOT NULL
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
CREATE TABLE IF NOT EXISTS jc_sessions (
  id TEXT PRIMARY KEY, job_card_id TEXT NOT NULL, user_sub TEXT NOT NULL, user_name TEXT,
  started_at TEXT NOT NULL, ended_at TEXT, beat_at TEXT NOT NULL, user_email TEXT
);
CREATE TABLE IF NOT EXISTS jc_time_cache (
  id TEXT PRIMARY KEY, job_card_id TEXT NOT NULL, user_id TEXT NOT NULL, user_name TEXT,
  started_at TEXT NOT NULL, ended_at TEXT, user_email TEXT, last_active_at TEXT, start_reason TEXT
);
`;

export interface PullData {
  userSub: string;
  nowIso: string;
  jobCards: CachedJobCard[];
  scales: CachedScale[];
  items: {
    id: string;
    jobCardId: string;
    scaleId: string;
    moduleType: WorkItemType;
    sequence: number;
    assignedAt?: string | null;
  }[];
  baselines: {
    scaleId: string;
    latestZero: string | null;
    latestSpan: string | null;
  }[];
  incompleteJobCardIds?: string[];
  doneItems?: {
    id: string;
    jobCardId: string;
    scaleId: string;
    moduleType: string;
    sequence: number;
    assignedAt?: string | null;
    submittedAt: string;
    submissionId: string;
    revision: number;
    draft: unknown;
  }[];
}

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
  assignedAt: (r.jc_assigned_at as string) ?? (r.assigned_at as string) ?? null,
  submittedAt: (r.submitted_at as string) ?? null,
  jcNumber: (r.jc_number as string) ?? "Unknown job card",
  customerName: (r.customer_name as string) ?? null,
  jobCardStatus: (r.jc_status as string) ?? "OPEN",
  jobCardClosedAt: (r.jc_closed_at as string) ?? null,
  jcTitle: (r.jc_title as string) ?? null,
  jobCardAssignedTo: (r.jc_assigned_to as string) ?? null,
  jobCardAssignedToEmail: (r.jc_assigned_email as string) ?? null,
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
    try {
      await this.db.exec("ALTER TABLE jc_jobcards ADD COLUMN closed_at TEXT");
    } catch {
      /* the column is already there */
    }
    const added = [
      "ALTER TABLE jc_jobcards ADD COLUMN assigned_to TEXT",
      "ALTER TABLE jc_jobcards ADD COLUMN assigned_to_name TEXT",
      "ALTER TABLE jc_jobcards ADD COLUMN assigned_to_email TEXT",
      "ALTER TABLE jc_jobcards ADD COLUMN assigned_at TEXT",
      "ALTER TABLE jc_sessions ADD COLUMN user_email TEXT",
      "ALTER TABLE jc_time_cache ADD COLUMN user_email TEXT",
      "ALTER TABLE jc_time_cache ADD COLUMN last_active_at TEXT",
      "ALTER TABLE jc_time_cache ADD COLUMN start_reason TEXT",
    ];
    for (const sql of added) {
      try {
        await this.db.exec(sql);
      } catch {
        /* the column is already there */
      }
    }
  }

  // ------------------------------------------------------------------ reading
  async listMyWork(userSub: string): Promise<WorkItemView[]> {
    const rows = await this.db.all(
      `SELECT w.*, j.jc_number, j.customer_name, j.title AS jc_title, j.status AS jc_status, j.closed_at AS jc_closed_at,
               j.assigned_to AS jc_assigned_to, j.assigned_to_email AS jc_assigned_email, j.assigned_at AS jc_assigned_at,
               s.scale_name, s.scope_of_work
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
      `SELECT w.*, j.jc_number, j.customer_name, j.title AS jc_title, j.status AS jc_status, j.closed_at AS jc_closed_at,
               j.assigned_to AS jc_assigned_to, j.assigned_to_email AS jc_assigned_email, j.assigned_at AS jc_assigned_at,
               s.scale_name, s.scope_of_work
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
      return null;
    }
  }

  async deleteDraft(workItemId: string): Promise<void> {
    await this.db.run("DELETE FROM jc_drafts WHERE work_item_id = ?", [
      workItemId,
    ]);
  }

  // --------------------------------------------------- applying what the server said
  async applyPull(d: PullData): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const j of d.jobCards) {
        await tx.run(
          `INSERT INTO jc_jobcards (id, jc_number, customer_name, title, status, updated_at, closed_at,
                                    assigned_to, assigned_to_name, assigned_to_email, assigned_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET jc_number = excluded.jc_number, customer_name = excluded.customer_name,
             title = excluded.title, status = excluded.status, updated_at = excluded.updated_at, closed_at = excluded.closed_at,
             assigned_to = excluded.assigned_to, assigned_to_name = excluded.assigned_to_name,
             assigned_to_email = excluded.assigned_to_email, assigned_at = excluded.assigned_at`,
          [
            j.id,
            j.jcNumber,
            j.customerName ?? null,
            j.title ?? null,
            j.status,
            d.nowIso,
            j.closedAt ?? null,
            j.assignedTo ?? null,
            j.assignedToName ?? null,
            j.assignedToEmail ?? null,
            j.assignedAt ?? null,
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

      const openIds = new Set(d.jobCards.map((j) => j.id));
      const incomplete = new Set(d.incompleteJobCardIds ?? []);
      const known = await tx.all<{ id: string }>("SELECT id FROM jc_jobcards");
      for (const k of known) {
        if (openIds.has(k.id) || incomplete.has(k.id)) continue;
        await this.closeJobCard(tx, k.id, d.nowIso);
      }

      const keep = new Set(d.items.map((i) => i.id));
      const mine = (
        await tx.all<{ id: string; scale_id: string; job_card_id: string }>(
          "SELECT id, scale_id, job_card_id FROM jc_workitems WHERE user_sub = ? AND local_state = 'PENDING'",
          [d.userSub],
        )
      ).filter(
        (r) => openIds.has(r.job_card_id) && !incomplete.has(r.job_card_id),
      );
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

      for (const di of d.doneItems ?? []) {
        const local = await tx.first(
          "SELECT local_state, submitted_at FROM jc_workitems WHERE id = ?",
          [di.id],
        );
        const remoteRow = [di.id, di.submissionId, di.revision, di.submittedAt];
        const upsertRemote = () =>
          tx.run(
            `INSERT INTO jc_remote_results (work_item_id, submission_id, revision, submitted_at) VALUES (?, ?, ?, ?)
             ON CONFLICT(work_item_id) DO UPDATE SET submission_id = excluded.submission_id, revision = excluded.revision,
               submitted_at = excluded.submitted_at`,
            remoteRow as SqlValue[],
          );
        const draft = () =>
          tx.run(
            `INSERT INTO jc_drafts (work_item_id, form_json, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(work_item_id) DO UPDATE SET form_json = excluded.form_json, updated_at = excluded.updated_at`,
            [di.id, JSON.stringify(di.draft), d.nowIso],
          );
        if (!local) {
          await tx.run(
            `INSERT INTO jc_workitems (id, user_sub, job_card_id, scale_id, module_type, sequence, local_state, assigned_at, submitted_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?, ?)`,
            [
              di.id,
              d.userSub,
              di.jobCardId,
              di.scaleId,
              di.moduleType,
              di.sequence,
              di.assignedAt ?? null,
              di.submittedAt,
              d.nowIso,
            ],
          );
          await draft();
          await upsertRemote();
        } else if (local.local_state === "SUBMITTED") {
          if (
            !local.submitted_at ||
            di.submittedAt > (local.submitted_at as string)
          ) {
            await tx.run(
              "UPDATE jc_workitems SET submitted_at = ?, updated_at = ? WHERE id = ?",
              [di.submittedAt, d.nowIso, di.id],
            );
            await draft();
          }
          await upsertRemote();
        }
      }

      const cutoff = new Date(
        new Date(d.nowIso).getTime() - KEEP_SUBMITTED_DAYS * DAY_MS,
      ).toISOString();
      await tx.run(
        `DELETE FROM jc_drafts WHERE work_item_id IN
           (SELECT id FROM jc_workitems WHERE local_state = 'SUBMITTED' AND submitted_at IS NOT NULL AND submitted_at < ? AND job_card_id NOT IN (SELECT id FROM jc_jobcards WHERE status = 'OPEN'))`,
        [cutoff],
      );
      await tx.run(
        "DELETE FROM jc_workitems WHERE local_state = 'SUBMITTED' AND submitted_at IS NOT NULL AND submitted_at < ? AND job_card_id NOT IN (SELECT id FROM jc_jobcards WHERE status = 'OPEN')",
        [cutoff],
      );

      await tx.run(
        "DELETE FROM jc_scales WHERE id NOT IN (SELECT scale_id FROM jc_workitems)",
      );
      await tx.run(
        "DELETE FROM jc_baseline WHERE scale_id NOT IN (SELECT scale_id FROM jc_workitems)",
      );
      await tx.run(
        "DELETE FROM jc_jobcards WHERE id NOT IN (SELECT job_card_id FROM jc_workitems)",
      );
      await tx.run(
        "DELETE FROM jc_remote_results WHERE work_item_id NOT IN (SELECT id FROM jc_workitems)",
      );
    });
  }

  private async closeJobCard(
    tx: SqlDriver,
    jobCardId: string,
    nowIso: string,
  ): Promise<void> {
    await tx.run(
      "UPDATE jc_sessions SET ended_at = ?, beat_at = ? WHERE job_card_id = ? AND ended_at IS NULL",
      [nowIso, nowIso, jobCardId],
    );
    const rows = await tx.all<{ id: string; scale_id: string }>(
      "SELECT id, scale_id FROM jc_workitems WHERE job_card_id = ?",
      [jobCardId],
    );
    for (const r of rows) {
      await tx.run("DELETE FROM jc_drafts WHERE work_item_id = ?", [r.id]);
      await tx.run("DELETE FROM jc_remote_results WHERE work_item_id = ?", [
        r.id,
      ]);
      await tx.run("DELETE FROM jc_baseline WHERE scale_id = ?", [r.scale_id]);
    }
    await tx.run("DELETE FROM jc_workitems WHERE job_card_id = ?", [jobCardId]);
    await tx.run("DELETE FROM jc_scales WHERE job_card_id = ?", [jobCardId]);
    await tx.run("DELETE FROM jc_jobcards WHERE id = ?", [jobCardId]);
  }

  // ------------------------------------------------------------------- outbox
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

  async jobCardIdsToRefresh(userSub: string): Promise<string[]> {
    const rows = await this.db.all(
      `SELECT DISTINCT w.job_card_id AS id FROM jc_workitems w
         LEFT JOIN jc_jobcards j ON j.id = w.job_card_id
        WHERE w.user_sub = ? AND COALESCE(j.status, 'OPEN') <> 'CLOSED'
          AND NOT EXISTS (SELECT 1 FROM jc_workitems p WHERE p.job_card_id = w.job_card_id
                           AND p.user_sub = w.user_sub AND p.local_state = 'PENDING')`,
      [userSub],
    );
    return rows.map((r) => r.id as string);
  }

  async upsertJobCard(j: CachedJobCard, nowIso: string): Promise<void> {
    if (j.status === "CLOSED") {
      await this.db.transaction((tx) => this.closeJobCard(tx, j.id, nowIso));
      return;
    }
    await this.db.run(
      `INSERT INTO jc_jobcards (id, jc_number, customer_name, title, status, updated_at, closed_at,
                                assigned_to, assigned_to_name, assigned_to_email, assigned_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET jc_number = excluded.jc_number, customer_name = excluded.customer_name,
         title = excluded.title, status = excluded.status, updated_at = excluded.updated_at, closed_at = excluded.closed_at,
         assigned_to = excluded.assigned_to, assigned_to_name = excluded.assigned_to_name,
         assigned_to_email = excluded.assigned_to_email, assigned_at = excluded.assigned_at`,
      [
        j.id,
        j.jcNumber,
        j.customerName ?? null,
        j.title ?? null,
        j.status,
        nowIso,
        j.closedAt ?? null,
        j.assignedTo ?? null,
        j.assignedToName ?? null,
        j.assignedToEmail ?? null,
        j.assignedAt ?? null,
      ],
    );
  }

  async resultHistory(
    workItemId: string,
  ): Promise<{ lastId: string | null; count: number }> {
    const rows = await this.db.all(
      "SELECT id, created_at FROM jc_outbox WHERE kind = 'submit-result' AND work_item_id = ? ORDER BY created_at DESC",
      [workItemId],
    );
    const remote = await this.db.first(
      "SELECT submission_id, revision, submitted_at FROM jc_remote_results WHERE work_item_id = ?",
      [workItemId],
    );
    const mineAt = rows.length ? (rows[0].created_at as string) : null;
    const remoteNewer =
      !!remote && (!mineAt || (remote.submitted_at as string) > mineAt);
    return {
      lastId: remoteNewer
        ? (remote!.submission_id as string)
        : rows.length
          ? (rows[0].id as string)
          : null,
      count: Math.max(rows.length, Number(remote?.revision ?? 0)),
    };
  }

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

  // ------------------------------------------------------------ time sessions
  async startSession(a: {
    id: string;
    jobCardId: string;
    userSub: string;
    userName: string;
    userEmail?: string;
    nowIso: string;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run(
        "INSERT INTO jc_sessions (id, job_card_id, user_sub, user_name, started_at, ended_at, beat_at, user_email) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)",
        [
          a.id,
          a.jobCardId,
          a.userSub,
          a.userName,
          a.nowIso,
          a.nowIso,
          a.userEmail ?? null,
        ],
      );
      const payload: StartTimePayload = {
        sessionId: a.id,
        userSub: a.userSub,
        userName: a.userName,
        userEmail: a.userEmail,
        startedAt: a.nowIso,
      };
      await tx.run(
        `INSERT INTO jc_outbox (id, kind, work_item_id, job_card_id, payload, status, attempts, created_at, updated_at)
         VALUES (?, 'start-time', NULL, ?, ?, 'pending', 0, ?, ?)`,
        [
          `${a.id}-start`,
          a.jobCardId,
          JSON.stringify(payload),
          a.nowIso,
          a.nowIso,
        ],
      );
    });
  }

  async beatSession(id: string, nowIso: string): Promise<void> {
    await this.db.run(
      "UPDATE jc_sessions SET beat_at = ? WHERE id = ? AND ended_at IS NULL",
      [nowIso, id],
    );
  }

  async endSession(id: string, endIso: string, nowIso: string): Promise<void> {
    const s = await this.db.first(
      "SELECT job_card_id, started_at, ended_at FROM jc_sessions WHERE id = ?",
      [id],
    );
    if (!s || s.ended_at) return;
    const started = s.started_at as string;
    const endedAt = endIso < started ? started : endIso;
    await this.db.transaction(async (tx) => {
      await tx.run("UPDATE jc_sessions SET ended_at = ? WHERE id = ?", [
        endedAt,
        id,
      ]);
      const payload: EndTimePayload = {
        sessionId: id,
        startedAt: started,
        endedAt,
      };
      await tx.run(
        `INSERT INTO jc_outbox (id, kind, work_item_id, job_card_id, payload, status, attempts, created_at, updated_at)
         VALUES (?, 'end-time', NULL, ?, ?, 'pending', 0, ?, ?)`,
        [
          `${id}-end`,
          s.job_card_id as string,
          JSON.stringify(payload),
          nowIso,
          nowIso,
        ],
      );
    });
  }

  async openSessions(
    userSub: string,
  ): Promise<{ id: string; beatAt: string }[]> {
    const rows = await this.db.all(
      "SELECT id, beat_at FROM jc_sessions WHERE user_sub = ? AND ended_at IS NULL",
      [userSub],
    );
    return rows.map((r) => ({
      id: r.id as string,
      beatAt: r.beat_at as string,
    }));
  }

  async jobCardIdsFor(userSub: string): Promise<string[]> {
    const rows = await this.db.all(
      "SELECT DISTINCT job_card_id FROM jc_workitems WHERE user_sub = ?",
      [userSub],
    );
    return rows.map((r) => r.job_card_id as string);
  }

  async replaceTimeCache(
    jobCardId: string,
    rows: {
      id: string;
      userId: string;
      userName?: string | null;
      userEmail?: string | null;
      startedAt: string;
      endedAt: string | null;
      lastActiveAt?: string | null;
      startReason?: string | null;
    }[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run("DELETE FROM jc_time_cache WHERE job_card_id = ?", [
        jobCardId,
      ]);
      for (const r of rows)
        await tx.run(
          "INSERT INTO jc_time_cache (id, job_card_id, user_id, user_name, started_at, ended_at, user_email, last_active_at, start_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            r.id,
            jobCardId,
            r.userId,
            r.userName ?? null,
            r.startedAt,
            r.endedAt,
            r.userEmail ?? null,
            r.lastActiveAt ?? null,
            r.startReason ?? null,
          ],
        );
    });
  }

  async timeRows(): Promise<{ cache: TimeRow[]; sessions: TimeRow[] }> {
    const cache = await this.db.all("SELECT * FROM jc_time_cache");
    const sessions = await this.db.all("SELECT * FROM jc_sessions");
    return {
      cache: cache.map((r) => ({
        id: r.id as string,
        jobCardId: r.job_card_id as string,
        userId: r.user_id as string,
        userName: (r.user_name as string) ?? null,
        userEmail: (r.user_email as string) ?? null,
        startedAt: r.started_at as string,
        endedAt: (r.ended_at as string) ?? null,
        lastActiveAt: (r.last_active_at as string) ?? null,
        startReason: (r.start_reason as string) ?? null,
      })),
      sessions: sessions.map((r) => ({
        id: r.id as string,
        jobCardId: r.job_card_id as string,
        userId: r.user_sub as string,
        userName: (r.user_name as string) ?? null,
        userEmail: (r.user_email as string) ?? null,
        startedAt: r.started_at as string,
        endedAt: (r.ended_at as string) ?? null,
        lastActiveAt: (r.beat_at as string) ?? null,
        startReason: "JOB_CARD_OPENED",
      })),
    };
  }

  async dueOutbox(nowIso: string, limit = 20): Promise<OutboxRow[]> {
    const rows = await this.db.all(
      `SELECT * FROM jc_outbox WHERE status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
        ORDER BY created_at ASC, id ASC LIMIT ?`,
      [nowIso, limit],
    );
    return rows.map(toOutbox);
  }

  /**
   * Blocked rows whose backoff time has passed are put back in the queue. This is what stops "1 need attention"
   * from being a permanent state for a row that was merely retrying: it will be sent again automatically.
   */
  async requeueDueBlocked(nowIso: string): Promise<number> {
    const rows = await this.db.all(
      "SELECT id FROM jc_outbox WHERE status = 'blocked' AND next_attempt_at IS NOT NULL AND next_attempt_at <= ?",
      [nowIso],
    );
    if (rows.length) {
      await this.db.run(
        "UPDATE jc_outbox SET status = 'pending', updated_at = ? WHERE status = 'blocked' AND next_attempt_at IS NOT NULL AND next_attempt_at <= ?",
        [nowIso, nowIso],
      );
    }
    return rows.length;
  }

  /**
   * One-shot cleanup on app start: a row that is blocked with next_attempt_at = NULL is a PermanentError that the
   * server has already rejected as "the work item no longer exists". It can never be sent, so mark it done with a
   * note. The payload is kept in the row for 7 days (pruneDone) in case anyone needs to look.
   */
  async autoDismissStuckPermanent(nowIso: string): Promise<number> {
    const rows = await this.db.all(
      "SELECT id FROM jc_outbox WHERE status = 'blocked' AND next_attempt_at IS NULL",
    );
    if (rows.length) {
      await this.db.run(
        `UPDATE jc_outbox
            SET status = 'done',
                last_error = COALESCE(last_error, 'Dismissed: the server no longer accepts this result'),
                updated_at = ?
          WHERE status = 'blocked' AND next_attempt_at IS NULL`,
        [nowIso],
      );
    }
    return rows.length;
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

  async unsentResultCount(): Promise<number> {
    const r = await this.db.first<{ n: number }>(
      "SELECT COUNT(*) AS n FROM jc_outbox WHERE kind = 'submit-result' AND status IN ('pending','syncing','blocked')",
    );
    return r?.n ?? 0;
  }

  /**
   * Counts rows the technician actually has to act on. A blocked row whose next_attempt_at is set will retry by
   * itself (see requeueDueBlocked), so it is "waiting to send", not "needs attention". Only rows stuck with
   * next_attempt_at = NULL are counted here, and those are auto-dismissed on the next app open
   * (autoDismissStuckPermanent). The badge should therefore only be visible for a few seconds, if ever.
   */
  async blockedCount(): Promise<number> {
    const r = await this.db.first<{ n: number }>(
      "SELECT COUNT(*) AS n FROM jc_outbox WHERE status = 'blocked' AND next_attempt_at IS NULL",
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

  async expiredPhotoPaths(nowIso: string): Promise<string[]> {
    const cutoff = new Date(
      new Date(nowIso).getTime() - KEEP_SUBMITTED_DAYS * DAY_MS,
    ).toISOString();
    const rows = await this.db.all(
      `SELECT form_json FROM jc_drafts WHERE work_item_id IN
         (SELECT id FROM jc_workitems WHERE local_state = 'SUBMITTED' AND submitted_at IS NOT NULL AND submitted_at < ? AND job_card_id NOT IN (SELECT id FROM jc_jobcards WHERE status = 'OPEN'))`,
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
