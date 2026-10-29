// __tests__/jobcards/syncTrace.test.ts
// The background task records the last call the sync started, so a hung run shows where it stopped. Tracing must
// list calls in order, must not change what the calls return, and must be silent when switched off.
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(async () => ({
      isConnected: true,
      isInternetReachable: true,
    })),
  },
}));
jest.mock("@/src/jobcards/api", () => ({
  jobCardApi: { listOpenWork: jest.fn(async () => ["work"]) },
  resolveMyIds: jest.fn(),
}));
const mockStore = { getMeta: jest.fn(async () => "sub-1"), other: 1 };
jest.mock("@/src/jobcards/sqliteDriver", () => ({
  getJobCardStore: jest.fn(async () => mockStore),
}));
jest.mock("@/src/jobcards/photos", () => ({ deletePhotoFiles: jest.fn() }));
jest.mock("@/src/jobcards/submission", () => ({
  prepareSubmission: jest.fn(),
}));
jest.mock("@/src/jobcards/sync", () => ({
  abandonRunningSync: jest.fn(),
  runSync: jest.fn(async (deps: any) => {
    await deps.isOnline();
    const work = await deps.api.listOpenWork();
    const meta = await deps.store.getMeta("userSub");
    await deps.store.getMeta("userSub"); // same step twice in a row: noted once
    return { offline: false, seenWork: work, seenMeta: meta };
  }),
}));

import {
    requestSyncDetailed,
    setJobCardUser,
    setSyncTrace,
} from "@/src/jobcards/controller";

beforeEach(() => setJobCardUser({ sub: "sub-1", name: "T", email: undefined }));
afterEach(() => setSyncTrace(null));

test("notes each call the sync starts, in order, without changing results", async () => {
  const steps: string[] = [];
  setSyncTrace((s) => steps.push(s));
  const out: any = await requestSyncDetailed();
  expect(steps).toEqual(["isOnline", "api:listOpenWork", "store:getMeta"]);
  expect(out.status).toBe("done");
  expect(out.summary.seenWork).toEqual(["work"]);
  expect(out.summary.seenMeta).toBe("sub-1");
});

test("is silent when tracing is off", async () => {
  const steps: string[] = [];
  setSyncTrace((s) => steps.push(s));
  setSyncTrace(null);
  await requestSyncDetailed();
  expect(steps).toEqual([]);
});
