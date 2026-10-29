// __tests__/jobcards/photosSent.test.ts
// Runs the real controller + sync + database path (including the tracing, recovery and release-of-waits changes)
// with a result that has photos. A result must never reach the server without ALL its photos, photos that already
// went must not be sent again on a retry, and the result must carry every photo's key. Needs better-sqlite3.
const Sqlite: any = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("better-sqlite3");
  } catch {
    return null;
  }
})();
const suite = Sqlite ? describe : describe.skip;

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(async () => ({
      isConnected: true,
      isInternetReachable: true,
    })),
  },
}));
const mockCalls: string[] = [];
const mockCreated: any[] = [];
let mockFailUpload: string | null = null;
jest.mock("@/src/jobcards/api", () => ({
  resolveMyIds: jest.fn(),
  jobCardApi: {
    listOpenWork: async () => ({
      jobCards: [],
      scales: [],
      items: [],
      doneItems: [],
      incompleteJobCardIds: [],
    }),
    listTimeEntries: async () => [],
    getJobCard: async () => null,
    uploadPhoto: async (key: string, uri: string) => {
      if (mockFailUpload && uri === mockFailUpload)
        throw new Error("Network request failed");
      mockCalls.push(`upload ${uri}`);
    },
    markModuleSubmitted: async () => {
      mockCalls.push("markModuleSubmitted");
    },
    createSubmission: async (input: any) => {
      mockCalls.push("createSubmission");
      mockCreated.push(input);
    },
  },
}));
let mockStoreInstance: any;
jest.mock("@/src/jobcards/sqliteDriver", () => ({
  getJobCardStore: jest.fn(async () => mockStoreInstance),
}));
jest.mock("@/src/jobcards/photos", () => ({
  deletePhotoFiles: jest.fn(async () => {}),
}));
jest.mock("@/src/jobcards/submission", () => ({
  prepareSubmission: jest.fn(),
}));

import {
    requestSyncDetailed,
    sendNow,
    setJobCardUser,
} from "@/src/jobcards/controller";
import {
    JobCardStore,
    type SqlDriver,
    type SqlValue,
} from "@/src/jobcards/store";

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

const NOW = new Date().toISOString();
const PHOTOS = {
  zero: "file:///zero.jpg",
  extra: ["file:///b.jpg", "file:///c.jpg"],
};

suite("a result with photos, through the real send path", () => {
  beforeEach(async () => {
    mockCalls.length = 0;
    mockCreated.length = 0;
    mockFailUpload = null;
    setJobCardUser({ sub: "sub-me", name: "T", email: undefined });
    mockStoreInstance = new JobCardStore(driver(new Sqlite(":memory:")));
    await mockStoreInstance.init();
    await mockStoreInstance.enqueueResult({
      id: "r1",
      workItemId: "w1",
      jobCardId: "jc1",
      submittedAt: NOW,
      nowIso: NOW,
      payload: JSON.stringify({
        workItemId: "w1",
        scaleId: "s1",
        moduleType: "ZERO_CALIBRATION",
        submittedAt: NOW,
        submittedBy: "sub-me",
        result: { reading: 12 },
        photos: PHOTOS,
        uploaded: {},
      }),
    });
  });

  it("uploads every photo first, then marks the work item, then creates the result with every photo's key", async () => {
    const out: any = await requestSyncDetailed();
    expect(out.summary.push.sent).toBe(1);
    expect(mockCalls).toEqual([
      "upload file:///zero.jpg",
      "upload file:///b.jpg",
      "upload file:///c.jpg",
      "markModuleSubmitted",
      "createSubmission",
    ]);
    const photos = mockCreated[0].payload.photos;
    expect(photos.zero).toMatch(/^jobcards\/jc1\/w1\/r1-zero\.jpg$/);
    expect(photos.extra).toEqual([
      "jobcards/jc1/w1/r1-extra-1.jpg",
      "jobcards/jc1/w1/r1-extra-2.jpg",
    ]);
    expect(mockCreated[0].payload.reading).toBe(12);
  });

  it("if one photo fails, nothing is marked or created, and the result is not lost", async () => {
    mockFailUpload = "file:///b.jpg";
    const out: any = await requestSyncDetailed();
    expect(out.summary.push).toMatchObject({ sent: 0, failed: 1 });
    expect(mockCalls).toEqual(["upload file:///zero.jpg"]); // stopped at the failing photo
    expect(mockCreated).toHaveLength(0);
    const row = await mockStoreInstance.getOutbox("r1");
    expect(row.status).toBe("pending");
    expect(row.lastError).toMatch(/Network request failed/);
  });

  it("a retry sends only the photos that did not go before, then completes the whole result", async () => {
    mockFailUpload = "file:///b.jpg";
    await requestSyncDetailed();
    mockCalls.length = 0;
    mockFailUpload = null;

    const result = await sendNow(); // skips the retry wait, like the Send now button
    expect(result).toEqual({ status: "sent", sent: 1 });
    expect(mockCalls).toEqual([
      "upload file:///b.jpg",
      "upload file:///c.jpg",
      "markModuleSubmitted",
      "createSubmission",
    ]); // zero.jpg was not sent again
    const photos = mockCreated[0].payload.photos;
    expect(photos.zero).toBeTruthy();
    expect(photos.extra).toHaveLength(2);
  });

  it("a run killed while sending leaves the result in the queue with its photo progress, and the next sync finishes it", async () => {
    await mockStoreInstance.markSyncing("r1", NOW); // killed after being marked 'sending'
    const out: any = await requestSyncDetailed();
    expect(out.summary.push.sent).toBe(1);
    expect(mockCreated).toHaveLength(1);
    expect(mockCreated[0].payload.photos.extra).toHaveLength(2);
  });
});
