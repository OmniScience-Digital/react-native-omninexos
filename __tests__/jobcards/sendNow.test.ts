// __tests__/jobcards/sendNow.test.ts
// "Send now", the follow-up sync after saving, and the release of retry waits when signal returns. Each must behave
// sensibly with no signal: nothing is lost, nothing pretends to send, and the technician is told plainly.
const mockNet = { connected: true };
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(async () => ({
      isConnected: mockNet.connected,
      isInternetReachable: mockNet.connected,
    })),
  },
}));
jest.mock("@/src/jobcards/api", () => ({
  jobCardApi: {},
  resolveMyIds: jest.fn(),
}));
const mockStore = {
  releaseBackoff: jest.fn(async () => 2),
  unsentResultCount: jest.fn(async () => 0),
  recoverStuck: jest.fn(async () => 0),
};
jest.mock("@/src/jobcards/sqliteDriver", () => ({
  getJobCardStore: jest.fn(async () => mockStore),
}));
jest.mock("@/src/jobcards/photos", () => ({ deletePhotoFiles: jest.fn() }));
jest.mock("@/src/jobcards/submission", () => ({
  prepareSubmission: jest.fn(),
}));
const mockRunSync = jest.fn();
jest.mock("@/src/jobcards/sync", () => ({
  runSync: (...a: unknown[]) => mockRunSync(...a),
  abandonRunningSync: jest.fn(),
}));

import {
    describeSendNow,
    requestSyncAfterChange,
    requestSyncAfterSignalReturn,
    sendNow,
    setJobCardUser,
} from "@/src/jobcards/controller";

const done = (summary: object) => ({
  status: "done" as const,
  summary: summary as any,
});

beforeEach(() => {
  setJobCardUser({ sub: "u", name: "T", email: undefined });
  mockNet.connected = true;
  mockRunSync.mockReset();
  mockStore.releaseBackoff.mockClear();
  mockStore.unsentResultCount.mockReset().mockResolvedValue(0);
});

describe("describeSendNow", () => {
  test("no signal is reported as offline", () => {
    expect(describeSendNow(done({ offline: true }), 3)).toEqual({
      status: "offline",
    });
  });
  test("everything sent", () => {
    expect(
      describeSendNow(
        done({ offline: false, push: { sent: 2, failed: 0, blocked: 0 } }),
        0,
      ),
    ).toEqual({ status: "sent", sent: 2 });
  });
  test("nothing was waiting", () => {
    expect(
      describeSendNow(
        done({ offline: false, push: { sent: 0, failed: 0, blocked: 0 } }),
        0,
      ),
    ).toEqual({ status: "nothing" });
  });
  test("some still waiting, even if one went", () => {
    expect(
      describeSendNow(
        done({ offline: false, push: { sent: 1, failed: 1, blocked: 0 } }),
        1,
      ),
    ).toEqual({ status: "waiting", waiting: 1 });
  });
  test("a sync that threw is an error", () => {
    expect(describeSendNow({ status: "error", error: "x" }, 0)).toEqual({
      status: "error",
    });
  });
});

describe("sendNow", () => {
  test("with no signal it tries nothing, touches nothing, and says so", async () => {
    mockNet.connected = false;
    expect(await sendNow()).toEqual({ status: "offline" });
    expect(mockRunSync).not.toHaveBeenCalled();
    expect(mockStore.releaseBackoff).not.toHaveBeenCalled();
  });

  test("with signal it skips any retry wait, sends, and reports what went", async () => {
    mockRunSync.mockResolvedValue({
      offline: false,
      push: { sent: 2, failed: 0, blocked: 0 },
    });
    expect(await sendNow()).toEqual({ status: "sent", sent: 2 });
    expect(mockStore.releaseBackoff).toHaveBeenCalledTimes(1);
  });

  test("if the signal drops during the try, it is reported as offline, not as a failure", async () => {
    mockRunSync.mockResolvedValue({ offline: true });
    mockStore.unsentResultCount.mockResolvedValue(2);
    expect(await sendNow()).toEqual({ status: "offline" });
  });

  test("results still waiting after the try are reported with their number", async () => {
    mockRunSync.mockResolvedValue({
      offline: false,
      push: { sent: 0, failed: 2, blocked: 0 },
    });
    mockStore.unsentResultCount.mockResolvedValue(2);
    expect(await sendNow()).toEqual({ status: "waiting", waiting: 2 });
  });

  test("when nobody is signed in it does nothing", async () => {
    setJobCardUser(null as any);
    expect(await sendNow()).toEqual({ status: "error" });
  });
});

describe("after saving and after the signal returns", () => {
  test("saving with nothing running syncs once", async () => {
    mockRunSync.mockResolvedValue({ offline: false });
    await requestSyncAfterChange();
    expect(mockRunSync).toHaveBeenCalledTimes(1);
  });

  test("when the signal returns, sends that were resting after poor-signal failures are released first", async () => {
    mockRunSync.mockResolvedValue({ offline: false });
    await requestSyncAfterSignalReturn();
    expect(mockStore.releaseBackoff).toHaveBeenCalledTimes(1);
    expect(mockRunSync).toHaveBeenCalledTimes(1);
  });

  test("a failure while releasing does not stop the sync", async () => {
    mockStore.releaseBackoff.mockRejectedValueOnce(new Error("db busy"));
    mockRunSync.mockResolvedValue({ offline: false });
    await requestSyncAfterSignalReturn();
    expect(mockRunSync).toHaveBeenCalledTimes(1);
  });
});
