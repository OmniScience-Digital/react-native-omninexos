// __tests__/jobcards/outboxCleanup.test.ts
// Outbox rows whose job card is gone from the phone, and that already failed many times, are closed instead of
// retrying every hour for ever. Needs better-sqlite3 (skipped without it, like sync.test.ts).
import {
    JobCardStore,
    type SqlDriver,
    type SqlValue,
} from "../../src/jobcards/store";

const Sqlite: any = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("better-sqlite3");
  } catch {
    return null;
  }
})();
const suite = Sqlite ? describe : describe.skip;

function driver(db: any): SqlDriver {
  const d: SqlDriver = {
    async exec(sql) {
      db.exec(sql);
    },
    async run(sql, p: SqlValue[] = []) {
      db.prepare(sql).run(...p);
    },
    async all(sql, p: SqlValue[] = []) {
      return db.prepare(sql).all(...p);
    },
    async first(sql, p: SqlValue[] = []) {
      return db.prepare(sql).get(...p) ?? null;
    },
    async transaction(fn) {
      db.exec("BEGIN");
      try {
        const r = await fn(d);
        db.exec("COMMIT");
        return r;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return d;
}

const NOW = "2026-10-30T08:00:00.000Z";

suite("closing outbox rows whose job card is gone", () => {
  let raw: any;
  let store: JobCardStore;

  const addRow = (id: string, jobCardId: string, attempts: number) => {
    raw
      .prepare(
        `INSERT INTO jc_outbox (id, kind, work_item_id, job_card_id, payload, status, attempts, last_error, next_attempt_at, created_at, updated_at)
         VALUES (?, 'submit-result', 'w', ?, '{}', 'blocked', ?, 'The conditional request failed', ?, ?, ?)`,
      )
      .run(id, jobCardId, attempts, NOW, NOW, NOW);
  };

  beforeEach(async () => {
    raw = new Sqlite(":memory:");
    store = new JobCardStore(driver(raw));
    await store.init();
    // job card "open" is still on the phone; "gone" is not
    raw
      .prepare(
        "INSERT INTO jc_jobcards (id, jc_number, status, updated_at) VALUES ('open', 'JC1', 'OPEN', ?)",
      )
      .run(NOW);
  });

  const statusOf = (id: string) =>
    raw
      .prepare("SELECT status, last_error FROM jc_outbox WHERE id = ?")
      .get(id);

  it("closes a row that failed enough times and whose job card is gone, and says why", async () => {
    addRow("orphan", "gone", 12);
    expect(await store.closeOrphanedRows(NOW, 12)).toBe(1);
    const r = statusOf("orphan");
    expect(r.status).toBe("done");
    expect(r.last_error).toMatch(/no longer on this phone/);
    expect(r.last_error).toMatch(/conditional request failed/);
  });

  it("leaves a row whose job card is gone but that is still within its first tries", async () => {
    addRow("young", "gone", 2);
    expect(await store.closeOrphanedRows(NOW, 12)).toBe(0);
    expect(statusOf("young").status).toBe("blocked");
  });

  it("leaves a failing row whose job card is still on the phone", async () => {
    addRow("live", "open", 30);
    expect(await store.closeOrphanedRows(NOW, 12)).toBe(0);
    expect(statusOf("live").status).toBe("blocked");
  });

  it("does nothing when there is nothing to close", async () => {
    expect(await store.closeOrphanedRows(NOW, 12)).toBe(0);
  });
});
