// __tests__/sync/backgroundLog.test.ts
const mockStore: Record<string, string> = {};
let mockFailWrites = false;
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockStore[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      if (mockFailWrites) throw new Error("disk full");
      mockStore[k] = v;
    }),
    removeItem: jest.fn(async (k: string) => {
      delete mockStore[k];
    }),
  },
}));

import {
    beginBackgroundRun,
    clearBackgroundRuns,
    finishBackgroundRun,
    getBackgroundRuns,
} from "@/src/sync/backgroundLog";

beforeEach(async () => {
  mockFailWrites = false;
  await clearBackgroundRuns();
});

describe("background run log", () => {
  test("a started run with no finish is visible (killed mid-run)", async () => {
    await beginBackgroundRun("jobcards");
    const [run] = await getBackgroundRuns();
    expect(run.task).toBe("jobcards");
    expect(run.finishedAt).toBeNull();
    expect(run.outcome).toBeNull();
  });

  test("finishing a run records the outcome and counts", async () => {
    const id = await beginBackgroundRun("jobcards");
    await finishBackgroundRun(id, { outcome: "synced", sent: 3 });
    const [run] = await getBackgroundRuns();
    expect(run).toMatchObject({ outcome: "synced", sent: 3 });
    expect(run.finishedAt).not.toBeNull();
  });

  test("keeps only the newest 20 runs, newest first", async () => {
    for (let i = 0; i < 25; i++) {
      const id = await beginBackgroundRun("jobcards");
      await finishBackgroundRun(id, { outcome: "synced", sent: i });
    }
    const runs = await getBackgroundRuns();
    expect(runs).toHaveLength(20);
    expect(runs[0].sent).toBe(24);
    expect(runs[19].sent).toBe(5);
  });

  test("two overlapping wakes do not overwrite each other", async () => {
    const [a, b] = await Promise.all([
      beginBackgroundRun("jobcards"),
      beginBackgroundRun("jobcards"),
    ]);
    await Promise.all([
      finishBackgroundRun(a, { outcome: "synced", sent: 1 }),
      finishBackgroundRun(b, { outcome: "offline" }),
    ]);
    const runs = await getBackgroundRuns();
    expect(runs.map((r) => r.outcome).sort()).toEqual(["offline", "synced"]);
  });

  test("a storage failure never throws into the sync", async () => {
    mockFailWrites = true;
    await expect(beginBackgroundRun("jobcards")).resolves.toEqual(
      expect.any(String),
    );
    await expect(
      finishBackgroundRun("nope", { outcome: "error" }),
    ).resolves.toBeUndefined();
  });
});
