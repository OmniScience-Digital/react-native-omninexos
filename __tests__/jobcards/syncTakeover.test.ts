// __tests__/jobcards/syncTakeover.test.ts
// The background task asks for a takeover only when the running sync has started no call for a while. A sync that is
// still working must be left alone; a frozen one is replaced and the rows it was holding are put back in the queue.
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
  jobCardApi: {},
  resolveMyIds: jest.fn(),
}));
const mockStore = { recoverStuck: jest.fn(async () => 1) };
jest.mock("@/src/jobcards/sqliteDriver", () => ({
  getJobCardStore: jest.fn(async () => mockStore),
}));
jest.mock("@/src/jobcards/photos", () => ({ deletePhotoFiles: jest.fn() }));
jest.mock("@/src/jobcards/submission", () => ({
  prepareSubmission: jest.fn(),
}));
const mockAbandon = jest.fn();
const mockRunSync = jest.fn();
jest.mock("@/src/jobcards/sync", () => ({
  runSync: (...a: any[]) => mockRunSync(...a),
  abandonRunningSync: () => mockAbandon(),
}));

import { requestSyncDetailed, setJobCardUser } from "@/src/jobcards/controller";

const realNow = Date.now;
let clock = realNow();
beforeEach(() => {
  setJobCardUser({ sub: "u", name: "T", email: undefined });
  Date.now = () => clock;
  mockAbandon.mockClear();
  mockStore.recoverStuck.mockClear();
});
afterAll(() => {
  Date.now = realNow;
});

test("a quiet sync is replaced and its half-sent rows are put back in the queue", async () => {
  // a sync starts and never finishes (frozen)
  mockRunSync.mockImplementationOnce(() => new Promise(() => {}));
  void requestSyncDetailed();
  await Promise.resolve();
  await Promise.resolve();

  clock += 30_000; // quiet for 30 s: still counts as working
  mockRunSync.mockImplementationOnce(async () => ({ offline: false }));
  const early: any = await requestSyncDetailed({ takeOverIfIdleMs: 120_000 });
  expect(mockAbandon).not.toHaveBeenCalled();
  expect(early.status).toBe("done");

  clock += 200_000; // quiet for over two minutes: frozen
  mockRunSync.mockImplementationOnce(async () => ({
    offline: false,
    push: { sent: 1, failed: 0, blocked: 0 },
  }));
  const out: any = await requestSyncDetailed({ takeOverIfIdleMs: 120_000 });
  expect(mockAbandon).toHaveBeenCalledTimes(1);
  expect(mockStore.recoverStuck).toHaveBeenCalledTimes(1);
  expect(out).toMatchObject({ status: "done" });
  expect(out.summary.push.sent).toBe(1);
});

test("without the option, nothing is ever abandoned", async () => {
  mockRunSync.mockImplementationOnce(async () => ({ offline: false }));
  clock += 900_000;
  await requestSyncDetailed();
  expect(mockAbandon).not.toHaveBeenCalled();
});
