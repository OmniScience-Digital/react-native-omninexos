// __tests__/sync/backgroundTask.test.ts
// Runs the real background task function through each way a wake can go, with the OS, Amplify and the sync mocked.
// What matters: every run ends with a recorded outcome (never "started, never finished"), a hang becomes a named
// timeout with the step it stopped at, and a successful send is recorded as one.
const mockStore: Record<string, string> = {};
const mockRealSetImmediate = (globalThis as any).setImmediate;
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    // resolves through a real macrotask, like a native call; a microtask-only mock would starve the timer loop
    getItem: jest.fn(
      (k: string) =>
        new Promise((r) => mockRealSetImmediate(() => r(mockStore[k] ?? null))),
    ),
    setItem: jest.fn(async (k: string, v: string) => {
      mockStore[k] = v;
    }),
    removeItem: jest.fn(async (k: string) => {
      delete mockStore[k];
    }),
  },
}));

let mockTask: () => Promise<number>;
let mockRowErrors: unknown[] = [];
jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn((_name: string, fn: () => Promise<number>) => {
    mockTask = fn;
  }),
  isTaskRegisteredAsync: jest.fn(),
}));
jest.mock("expo-background-task", () => ({
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  addExpirationListener: jest.fn(() => ({ remove: jest.fn() })),
  getStatusAsync: jest.fn(),
  registerTaskAsync: jest.fn(),
  unregisterTaskAsync: jest.fn(),
}));
const mockRequestSync = jest.fn();
jest.mock("@/src/jobcards/controller", () => ({
  requestSyncDetailed: (...a: unknown[]) => mockRequestSync(...a),
  setJobCardUser: jest.fn(),
  setSyncTrace: jest.fn(),
  getSyncActivity: () => ({ running: false, idleMs: 0, lastStep: "" }),
}));
jest.mock("@/src/jobcards/sqliteDriver", () => ({
  getJobCardStore: jest.fn(async () => ({
    getMeta: async (k: string) => (k === "userSub" ? "sub-1" : null),
    recentOutboxErrors: async () => mockRowErrors,
  })),
  setSkipDelays: jest.fn(),
}));
jest.mock("@/src/jobcards/people", () => ({ normEmail: (s: unknown) => s }));

import { backgroundDeadlines } from "@/src/jobcards/background";
import { getBackgroundRuns } from "@/src/sync/backgroundLog";

const FAILED = 2;
const SUCCESS = 1;

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockRequestSync.mockReset();
  backgroundDeadlines.syncMs = 300;
});

const lastRun = async () => (await getBackgroundRuns())[0];

test("a successful send is recorded as a send, and reported as Success", async () => {
  mockRequestSync.mockResolvedValue({
    status: "done",
    summary: { offline: false, push: { sent: 2, failed: 0, blocked: 0 } },
  });
  expect(await mockTask()).toBe(SUCCESS);
  const run = await lastRun();
  expect(run).toMatchObject({ outcome: "synced", sent: 2 });
  expect(run.finishedAt).not.toBeNull();
});

test("a sync that never returns becomes a named timeout that says where it stopped", async () => {
  mockRequestSync.mockReturnValue(new Promise(() => {}));
  expect(await mockTask()).toBe(FAILED);
  const run = await lastRun();
  expect(run.outcome).toBe("timeout");
  expect(run.finishedAt).not.toBeNull();
  expect(run.error).toMatch(/the sync did not finish/);
  expect(run.error).toMatch(/Last step: /);
});

test("a sync that throws is an error and reported as Failed", async () => {
  mockRequestSync.mockRejectedValue(new Error("boom"));
  expect(await mockTask()).toBe(FAILED);
  expect(await lastRun()).toMatchObject({ outcome: "error", error: "boom" });
});

test("a wake with no signal is recorded as offline and is not a failure", async () => {
  mockRequestSync.mockResolvedValue({
    status: "done",
    summary: { offline: true },
  });
  expect(await mockTask()).toBe(SUCCESS);
  expect((await lastRun()).outcome).toBe("offline");
});

test("every step is time-stamped so a stalled run shows how long it ran", async () => {
  mockRequestSync.mockReturnValue(new Promise(() => {}));
  await mockTask();
  const run = await lastRun();
  expect(run.stepAt).toEqual(expect.any(String));
});

test("the time limit still works when the phone's own timers are dead, as in a real background wake", async () => {
  const g = globalThis as any;
  const realSet = g.setTimeout;
  const realClear = g.clearTimeout;
  g.setTimeout = () => 0; // never fires
  g.clearTimeout = () => {};
  try {
    mockRequestSync.mockReturnValue(new Promise(() => {}));
    expect(await mockTask()).toBe(FAILED); // would hang forever (jest times out) without the working timers
    expect((await lastRun()).outcome).toBe("timeout");
  } finally {
    g.setTimeout = realSet;
    g.clearTimeout = realClear;
  }
});

test("failed sends are recorded with the reason each row gave", async () => {
  mockRowErrors = [
    {
      kind: "submit-result",
      status: "pending",
      attempts: 3,
      lastError: "Network request failed",
    },
  ];
  mockRequestSync.mockResolvedValue({
    status: "done",
    summary: { offline: false, push: { sent: 0, failed: 1, blocked: 0 } },
  });
  expect(await mockTask()).toBe(FAILED);
  const run = await lastRun();
  expect(run.outcome).toBe("partial");
  expect(run.rowErrors).toEqual([
    "submit-result, pending, attempt 3: Network request failed",
  ]);
  mockRowErrors = [];
});

test("rows set aside as blocked also say why, even though the run itself is not a failure", async () => {
  mockRowErrors = [
    {
      kind: "submit-result",
      status: "blocked",
      attempts: 1,
      lastError: "This work item was removed on the server",
    },
  ];
  mockRequestSync.mockResolvedValue({
    status: "done",
    summary: { offline: false, push: { sent: 0, failed: 0, blocked: 1 } },
  });
  expect(await mockTask()).toBe(SUCCESS);
  expect((await lastRun()).rowErrors?.[0]).toMatch(
    /blocked, attempt 1: This work item was removed/,
  );
  mockRowErrors = [];
});

test("a clean run records no row errors", async () => {
  mockRowErrors = [
    { kind: "x", status: "pending", attempts: 1, lastError: "old" },
  ];
  mockRequestSync.mockResolvedValue({
    status: "done",
    summary: { offline: false, push: { sent: 1, failed: 0, blocked: 0 } },
  });
  await mockTask();
  expect((await lastRun()).rowErrors).toBeUndefined();
  mockRowErrors = [];
});
