// __tests__/jobcards/syncRecovery.test.ts
// A background wake can be killed after a row is marked "sending" but before it is marked done. pushOutbox only looks
// at "pending" rows, so that row used to stay stuck until the app was relaunched. Every fresh sync now puts such rows
// back first. Needs better-sqlite3 (skipped without it, like sync.test.ts).
import {
  JobCardStore,
  type SqlDriver,
  type SqlValue,
} from "../../src/jobcards/store";
import type { JobCardApi } from "../../src/jobcards/sync";
import { pushOutbox, runSync } from "../../src/jobcards/sync";

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

const NOW = new Date("2026-10-22T08:00:00.000Z");
const created: unknown[] = [];
const api = {
  listOpenWork: async () => ({
    jobCards: [],
    scales: [],
    items: [],
    doneItems: [],
    incompleteJobCardIds: [],
  }),
  createScale: async () => {},
  createModule: async (m: unknown) => {
    created.push(m);
  },
  listTimeEntries: async () => [],
  getJobCard: async () => null,
} as unknown as JobCardApi;

suite("a send that was killed half way", () => {
  let store: JobCardStore;
  let raw: any;
  beforeEach(async () => {
    created.length = 0;
    raw = new Sqlite(":memory:");
    store = new JobCardStore(driver(raw));
    await store.init();
    await store.enqueueAddScale({
      id: "add1",
      nowIso: NOW.toISOString(),
      payload: {
        scaleId: "s9",
        jobCardId: "1",
        scaleName: "New scale",
        scopeOfWork: null,
        userSub: "sub-me",
        userName: "Ayanda",
        addedAt: NOW.toISOString(),
        modules: [{ id: "m1", moduleType: "ZERO_CALIBRATION" }],
      },
    });
    // the OS killed the app after the row was marked "sending" and before it was marked done
    await store.markSyncing("add1", NOW.toISOString());
  });

  it("pushOutbox alone never sees the row again (the old behaviour)", async () => {
    const out = await pushOutbox(store, api, () => NOW);
    expect(out.sent).toBe(0);
    expect(created).toHaveLength(0);
  });

  it("the next sync puts it back and sends it", async () => {
    const out = await runSync(
      { store, api, now: () => NOW, isOnline: async () => true },
      "sub-me",
    );
    expect(out.push?.sent).toBe(1);
    expect(created).toHaveLength(1);
  });

  it("with no signal the row is left alone for the next try", async () => {
    const out = await runSync(
      { store, api, now: () => NOW, isOnline: async () => false },
      "sub-me",
    );
    expect(out).toEqual({ offline: true });
    expect(created).toHaveLength(0);
  });
});

suite("why sends fail", () => {
  it("lists the newest error of each row that is not done, and skips finished rows", async () => {
    const raw = new Sqlite(":memory:");
    const store = new JobCardStore(driver(raw));
    await store.init();
    for (const id of ["a", "b"])
      await store.enqueueAddScale({
        id,
        nowIso: NOW.toISOString(),
        payload: {
          scaleId: `s-${id}`,
          jobCardId: "1",
          scaleName: "S",
          scopeOfWork: null,
          userSub: "sub-me",
          userName: "A",
          addedAt: NOW.toISOString(),
          modules: [],
        },
      });
    await store.markFailed(
      "a",
      "Network request failed",
      NOW.toISOString(),
      false,
      NOW.toISOString(),
    );
    await store.markDone(
      (await store.getOutbox("b"))!,
      null,
      NOW.toISOString(),
    );
    const errors = await store.recentOutboxErrors(5);
    expect(errors).toEqual([
      {
        kind: "add-scale",
        status: "pending",
        attempts: 1,
        lastError: "Network request failed",
      },
    ]);
  });
});

suite("releasing retry waits", () => {
  it("makes resting rows due now, and leaves permanently blocked and finished rows alone", async () => {
    const raw = new Sqlite(":memory:");
    const store = new JobCardStore(driver(raw));
    await store.init();
    const later = new Date(NOW.getTime() + 3_600_000).toISOString();
    for (const id of ["resting", "maxed", "permanent", "finished"])
      await store.enqueueAddScale({
        id,
        nowIso: NOW.toISOString(),
        payload: {
          scaleId: `s-${id}`,
          jobCardId: "1",
          scaleName: "S",
          scopeOfWork: null,
          userSub: "u",
          userName: "A",
          addedAt: NOW.toISOString(),
          modules: [],
        },
      });
    // failed on poor signal: resting for an hour
    await store.markFailed(
      "resting",
      "Network request failed",
      later,
      false,
      NOW.toISOString(),
    );
    // too many tries: set aside, will retry by itself in an hour
    await store.markFailed(
      "maxed",
      "Network request failed",
      later,
      true,
      NOW.toISOString(),
    );
    // permanent: no retry time
    await store.markFailed(
      "permanent",
      "removed on the server",
      null,
      true,
      NOW.toISOString(),
    );
    await store.markDone(
      (await store.getOutbox("finished"))!,
      null,
      NOW.toISOString(),
    );

    expect(await store.dueOutbox(NOW.toISOString())).toHaveLength(0); // nothing due: all resting
    expect(await store.releaseBackoff(NOW.toISOString())).toBe(2);

    const due = (await store.dueOutbox(NOW.toISOString()))
      .map((r) => r.id)
      .sort();
    expect(due).toEqual(["maxed", "resting"]);
    expect((await store.getOutbox("permanent"))!.status).toBe("blocked");
    expect((await store.getOutbox("finished"))!.status).toBe("done");
  });
});
