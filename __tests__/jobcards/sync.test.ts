// __tests__/jobcards/sync.test.ts
// The phone's store and sync, against a real SQL engine and a pretend server. These tests need better-sqlite3
// (`npm i -D better-sqlite3`); without it they are skipped, and the rest of the suite still runs.
import {
  JobCardStore,
  type SqlDriver,
  type SqlValue,
} from "../../src/jobcards/store";
import type { JobCardApi, OpenWork } from "../../src/jobcards/sync";
import { pullOpenWork, pushOutbox } from "../../src/jobcards/sync";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Sqlite: any = (() => {
  try {
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
const ME = "sub-me";

interface World {
  open: OpenWork;
  calls: {
    createModule: any[];
    createTimeEntry: any[];
    closeTimeEntry: any[];
    uploadPhoto: any[];
    createSubmission: any[];
  };
}
const world = (open: Partial<OpenWork> = {}): World => ({
  open: {
    jobCards: [],
    scales: [],
    items: [],
    doneItems: [],
    incompleteJobCardIds: [],
    ...open,
  },
  calls: {
    createModule: [],
    createTimeEntry: [],
    closeTimeEntry: [],
    uploadPhoto: [],
    createSubmission: [],
  },
});
const fakeApi = (w: World): JobCardApi => ({
  // listOpenWork takes NO argument: finished work on open job cards is never time-filtered.
  listOpenWork: async () => w.open,
  getJobCard: async (id) => w.open.jobCards.find((j) => j.id === id) ?? null,
  getScale: async (id) => w.open.scales.find((s) => s.id === id) ?? null,
  latestSubmission: async () => null,
  markModuleSubmitted: async () => {},
  createSubmission: async (a) => {
    w.calls.createSubmission.push(a);
  },
  listTimeEntries: async () => [],
  closeTimeEntry: async (a) => {
    w.calls.closeTimeEntry.push(a);
  },
  touchTimeEntry: async () => {},
  createTimeEntry: async (a) => {
    w.calls.createTimeEntry.push(a);
  },
  createScale: async () => {},
  createModule: async (a) => {
    w.calls.createModule.push(a);
  },
  uploadPhoto: async (key, uri) => {
    w.calls.uploadPhoto.push({ key, uri });
  },
});

const card = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  jcNumber: `JC-${id}`,
  customerName: "ESCOM",
  title: null,
  status: "OPEN",
  ...over,
});
const item = (id: string, jobCardId: string, scaleId = `s-${jobCardId}`) => ({
  id,
  jobCardId,
  scaleId,
  moduleType: "ZERO_CALIBRATION" as const,
  sequence: 1,
  assignedAt: "2026-10-10T08:00:00.000Z",
});

suite("job cards on the phone", () => {
  let store: JobCardStore;
  let raw: any;
  beforeEach(async () => {
    raw = new Sqlite(":memory:");
    store = new JobCardStore(driver(raw));
    await store.init();
  });

  it("a technician who is not the assignee still gets every open job card's work", async () => {
    const w = world({
      jobCards: [
        card("1", {
          assignedTo: "sub-ben",
          assignedToName: "Ben",
          assignedToEmail: "ben@x.co",
          assignedAt: "2026-10-20T07:00:00.000Z",
        }),
        card("2"),
      ],
      scales: [
        { id: "s-1", jobCardId: "1", scaleName: "CV04" },
        { id: "s-2", jobCardId: "2", scaleName: "RunFed" },
      ],
      items: [item("w1", "1"), item("w2", "2")],
    });
    const summary = await pullOpenWork(store, fakeApi(w), ME, NOW);
    expect(summary).toMatchObject({ items: 2, jobCards: 2, failedLookups: 0 });
    const mine = await store.listMyWork(ME);
    expect(mine.map((m) => m.id).sort()).toEqual(["w1", "w2"]);
    const w1 = mine.find((m) => m.id === "w1")!;
    // the date shown is when the JOB CARD was assigned, and who it was assigned to is known
    expect(w1).toMatchObject({
      assignedAt: "2026-10-20T07:00:00.000Z",
      jobCardAssignedTo: "sub-ben",
      jobCardAssignedToEmail: "ben@x.co",
    });
    // a job card nobody was assigned falls back to the work item's own date
    expect(mine.find((m) => m.id === "w2")).toMatchObject({
      assignedAt: "2026-10-10T08:00:00.000Z",
      jobCardAssignedTo: null,
    });
  });

  it("work done by someone else, or removed, leaves my list; another item's draft stays", async () => {
    const w = world({
      jobCards: [card("1")],
      scales: [{ id: "s-1", jobCardId: "1", scaleName: "CV04" }],
      items: [item("w1", "1"), item("w2", "1")],
    });
    await pullOpenWork(store, fakeApi(w), ME, NOW);
    await store.saveDraft("w2", { half: "done" }, NOW.toISOString());
    w.open.items = [item("w2", "1")]; // w1 was completed by another technician
    await pullOpenWork(store, fakeApi(w), ME, NOW);
    expect((await store.listMyWork(ME)).map((m) => m.id)).toEqual(["w2"]);
    expect(await store.getDraft("w2")).toEqual({ half: "done" });
  });

  it("a job card that closed keeps its unfinished work and drafts on the phone and is marked closed", async () => {
    const w = world({
      jobCards: [card("1")],
      scales: [{ id: "s-1", jobCardId: "1", scaleName: "CV04" }],
      items: [item("w1", "1")],
    });
    await pullOpenWork(store, fakeApi(w), ME, NOW);
    await store.saveDraft("w1", { reading: "1250" }, NOW.toISOString());
    w.open = {
      jobCards: [],
      scales: [],
      items: [],
      doneItems: [],
      incompleteJobCardIds: [],
    }; // closed by the office: no longer listed
    await pullOpenWork(store, fakeApi(w), ME, NOW);
    const [only] = await store.listMyWork(ME);
    expect(only).toMatchObject({ id: "w1", jobCardStatus: "CLOSED" });
    expect(await store.getDraft("w1")).toEqual({ reading: "1250" });
    // its closing time still has to be fetched: jobCardIdsToRefresh returns closed job cards
    // whose close time we have not seen yet
    expect(await store.jobCardIdsToRefresh(ME)).toEqual(["1"]);
  });

  it("a job card whose work could not be read this time loses nothing", async () => {
    const w = world({
      jobCards: [card("1")],
      scales: [{ id: "s-1", jobCardId: "1", scaleName: "CV04" }],
      items: [item("w1", "1")],
    });
    await pullOpenWork(store, fakeApi(w), ME, NOW);
    w.open = {
      jobCards: [card("1")],
      scales: [],
      items: [],
      doneItems: [],
      incompleteJobCardIds: ["1"],
    };
    const s = await pullOpenWork(store, fakeApi(w), ME, NOW);
    expect(s.failedLookups).toBe(1);
    expect((await store.listMyWork(ME)).map((m) => m.id)).toEqual(["w1"]);
  });

  it("starting a session sends my email and my own id, and the end reaches the server with its start time", async () => {
    await store.startSession({
      id: "sess1",
      jobCardId: "1",
      userSub: ME,
      userName: "Ayanda",
      userEmail: "ayanda@x.co",
      nowIso: NOW.toISOString(),
    });
    await store.endSession(
      "sess1",
      "2026-10-22T09:00:00.000Z",
      "2026-10-22T09:00:00.000Z",
    );
    const w = world();
    const sent = await pushOutbox(
      store,
      fakeApi(w),
      () => new Date("2026-10-22T09:00:05.000Z"),
    );
    expect(sent.sent).toBe(2);
    expect(w.calls.createTimeEntry).toEqual([
      {
        id: "sess1",
        jobCardId: "1",
        userId: ME,
        userName: "Ayanda",
        userEmail: "ayanda@x.co",
        startedAt: NOW.toISOString(),
      },
    ]);
    expect(w.calls.closeTimeEntry).toEqual([
      {
        id: "sess1",
        startedAt: NOW.toISOString(),
        endedAt: "2026-10-22T09:00:00.000Z",
      },
    ]);
    const rows = await store.timeRows();
    expect(rows.sessions[0]).toMatchObject({
      userId: ME,
      userEmail: "ayanda@x.co",
      startReason: "JOB_CARD_OPENED",
    });
  });

  it("a scale added on the phone creates work items that are not assigned to anyone", async () => {
    await store.enqueueAddScale({
      id: "add1",
      nowIso: NOW.toISOString(),
      payload: {
        scaleId: "s9",
        jobCardId: "1",
        scaleName: "New scale",
        scopeOfWork: null,
        userSub: ME,
        userName: "Ayanda",
        addedAt: NOW.toISOString(),
        modules: [
          { id: "m1", moduleType: "ZERO_CALIBRATION" },
          { id: "m2", moduleType: "SPAN_CALIBRATION" },
        ],
      },
    });
    const w = world();
    await pushOutbox(store, fakeApi(w), () => NOW);
    expect(w.calls.createModule).toHaveLength(2);
    for (const call of w.calls.createModule) {
      expect(call).not.toHaveProperty("assignedTo");
      expect(call).not.toHaveProperty("assignedToName");
    }
  });

  const doneItem = (
    id: string,
    jobCardId: string,
    over: Record<string, unknown> = {},
  ) => ({
    ...item(id, jobCardId),
    submittedAt: "2026-10-21T10:00:00.000Z",
    submissionId: `sub-${id}`,
    payload: {
      newZeroValue: "1250",
      revision: 1,
      photos: { zero: "jobcards/1/w1/r0-zero.jpg" },
    },
    ...over,
  });

  it("finished work on an OPEN job card is saved with a form that can be reopened", async () => {
    const w = world({
      jobCards: [card("1")],
      scales: [{ id: "s-1", jobCardId: "1", scaleName: "CV04" }],
      items: [],
      doneItems: [doneItem("w1", "1") as any],
    });
    await pullOpenWork(store, fakeApi(w), ME, NOW);
    const [wi] = await store.listMyWork(ME);
    expect(wi).toMatchObject({
      id: "w1",
      localState: "SUBMITTED",
      submittedAt: "2026-10-21T10:00:00.000Z",
    });
    // the form is rebuilt from the saved result; its photo is the server's copy
    expect(await store.getDraft("w1")).toEqual({
      newZeroValue: "1250",
      photos: { zero: "remote:jobcards/1/w1/r0-zero.jpg" },
    });
    // a correction is a new result that follows the one already on the server
    expect(await store.resultHistory("w1")).toEqual({
      lastId: "sub-w1",
      count: 1,
    });
  });

  it("finished work on an OPEN job card survives the 14-day cleanup regardless of age", async () => {
    // An open job card whose only piece of work was submitted 20 days ago (past KEEP_SUBMITTED_DAYS = 14).
    // The cleanup is guarded by "job_card_id NOT IN (SELECT id FROM jc_jobcards WHERE status='OPEN')".
    // This test exists so that guard is never dropped by accident.
    const old = new Date(NOW.getTime() - 20 * 86_400_000).toISOString();
    const w = world({
      jobCards: [card("1")],
      scales: [{ id: "s-1", jobCardId: "1", scaleName: "CV04" }],
      items: [],
      doneItems: [doneItem("w1", "1", { submittedAt: old }) as any],
    });
    await pullOpenWork(store, fakeApi(w), ME, NOW);
    const items = await store.listMyWork(ME);
    expect(items.map((m) => m.id)).toEqual(["w1"]);
    expect(items[0]).toMatchObject({ localState: "SUBMITTED" });
    expect(await store.getDraft("w1")).toMatchObject({ newZeroValue: "1250" });
    expect(
      raw
        .prepare("SELECT COUNT(*) AS n FROM jc_workitems WHERE id = 'w1'")
        .get().n,
    ).toBe(1);
  });

  it("a job card whose finished work could not be read this time keeps the work already submitted", async () => {
    // Regression for api.ts: when the finished-work fetch fails for an open job card, api.ts now adds that job card
    // to incompleteJobCardIds. Without that, applyPull sees no doneItems and deletes the already-submitted work
    // from the phone because it thinks the server has moved it away.
    const w = world({
      jobCards: [card("1")],
      scales: [{ id: "s-1", jobCardId: "1", scaleName: "CV04" }],
      items: [],
      doneItems: [doneItem("w1", "1") as any],
    });
    await pullOpenWork(store, fakeApi(w), ME, NOW);
    expect((await store.listMyWork(ME)).map((m) => m.id)).toEqual(["w1"]);

    // Next pull: the job card is still OPEN, but its finished-work fetch failed for it.
    w.open = {
      jobCards: [card("1")],
      scales: [{ id: "s-1", jobCardId: "1", scaleName: "CV04" }],
      items: [],
      doneItems: [],
      incompleteJobCardIds: ["1"],
    };
    await pullOpenWork(store, fakeApi(w), ME, NOW);

    const left = await store.listMyWork(ME);
    expect(left.map((m) => m.id)).toEqual(["w1"]);
    expect(left[0]).toMatchObject({ localState: "SUBMITTED" });
    expect(await store.getDraft("w1")).toMatchObject({ newZeroValue: "1250" });
  });

  it("a phone with the older tables gets the new columns and keeps its data", async () => {
    const old = new Sqlite(":memory:");
    old.exec(`CREATE TABLE jc_jobcards (id TEXT PRIMARY KEY, jc_number TEXT NOT NULL, customer_name TEXT, title TEXT, status TEXT NOT NULL, updated_at TEXT NOT NULL, closed_at TEXT);
      CREATE TABLE jc_sessions (id TEXT PRIMARY KEY, job_card_id TEXT NOT NULL, user_sub TEXT NOT NULL, user_name TEXT, started_at TEXT NOT NULL, ended_at TEXT, beat_at TEXT NOT NULL);
      CREATE TABLE jc_time_cache (id TEXT PRIMARY KEY, job_card_id TEXT NOT NULL, user_id TEXT NOT NULL, user_name TEXT, started_at TEXT NOT NULL, ended_at TEXT);
      INSERT INTO jc_jobcards VALUES ('1','JC-1','ESCOM',NULL,'OPEN','2026-10-01T00:00:00.000Z',NULL);`);
    const s = new JobCardStore(driver(old));
    await s.init();
    await s.init(); // opening it again is harmless
    const cols = (t: string) =>
      (old.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map(
        (c) => c.name,
      );
    expect(cols("jc_jobcards")).toEqual(
      expect.arrayContaining([
        "assigned_to",
        "assigned_to_email",
        "assigned_at",
      ]),
    );
    expect(cols("jc_sessions")).toContain("user_email");
    expect(cols("jc_time_cache")).toEqual(
      expect.arrayContaining(["user_email", "last_active_at", "start_reason"]),
    );
    expect(
      old.prepare("SELECT jc_number FROM jc_jobcards").get().jc_number,
    ).toBe("JC-1");
  });
});
