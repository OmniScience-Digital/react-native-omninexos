// __tests__/jobcards/syncAfterChange.test.ts
// Uses the REAL runSync, because the problem lives in it: asking for a sync while one is running only joins the
// running one. If that one had already finished its sending step, work saved a moment ago would wait for the next
// timer. Saving must therefore sync once more after the running one ends.
let mockFetchCalls = 0;
let mockFirstGate: (() => void) | null = null;
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(() => {
      mockFetchCalls += 1;
      if (mockFetchCalls === 1)
        return new Promise((resolve) => {
          mockFirstGate = () =>
            resolve({ isConnected: false, isInternetReachable: false });
        });
      return Promise.resolve({
        isConnected: false,
        isInternetReachable: false,
      });
    }),
  },
}));
jest.mock("@/src/jobcards/api", () => ({
  jobCardApi: {},
  resolveMyIds: jest.fn(),
}));
jest.mock("@/src/jobcards/sqliteDriver", () => ({
  getJobCardStore: jest.fn(async () => ({})),
}));
jest.mock("@/src/jobcards/photos", () => ({ deletePhotoFiles: jest.fn() }));
jest.mock("@/src/jobcards/submission", () => ({
  prepareSubmission: jest.fn(),
}));

import {
    requestSyncAfterChange,
    setJobCardUser,
} from "@/src/jobcards/controller";

const tick = () => new Promise((r) => setImmediate(r));

test("work saved while a sync is running gets its own sync when the running one ends", async () => {
  setJobCardUser({ sub: "u", name: "T", email: undefined });
  const first = requestSyncAfterChange(); // a sync is now running (waiting on the signal check)
  await tick();
  expect(mockFetchCalls).toBe(1);

  const saved = requestSyncAfterChange(); // work saved while it runs: joins it...
  await tick();
  expect(mockFetchCalls).toBe(1);

  mockFirstGate!();
  await Promise.all([first, saved]);
  // ...and then a second, fresh sync ran, so the new work was looked at
  expect(mockFetchCalls).toBeGreaterThanOrEqual(2);
});
