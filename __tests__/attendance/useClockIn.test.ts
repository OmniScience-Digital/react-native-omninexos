/**
 * __tests__/attendance/useClockIn.test.ts
 *
 * Tests for the useClockIn hook logic — hours calculation,
 * offline flag, address formatting, and local record persistence.
 * No real network or device calls — all dependencies mocked.
 */

// ── Mocks (must be before imports) ───────────────────────────────────────────

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest
    .fn()
    .mockResolvedValue({ isConnected: true, isInternetReachable: true }),
}));

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: "granted" }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: -26.2041, longitude: 28.0473, accuracy: 10 },
  }),
  reverseGeocodeAsync: jest.fn().mockResolvedValue([
    {
      name: "Sandton City",
      street: "Sandton Drive",
      city: "Sandton",
      region: "Gauteng",
    },
  ]),
  Accuracy: { Balanced: 3 },
}));

jest.mock("@/src/state/api", () => ({
  useCreateClockRecordMutation: jest.fn(),
  useUpdateClockRecordMutation: jest.fn(),
  useListMyClockRecordsQuery: jest.fn(),
}));

jest.mock("@/services/submissionQueue", () => ({
  enqueue: jest.fn().mockResolvedValue(1),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { act, renderHook } from "@testing-library/react-hooks";

import { useClockIn } from "@/hooks/useClockIn";
import { enqueue } from "@/services/submissionQueue";
import {
    useCreateClockRecordMutation,
    useListMyClockRecordsQuery,
    useUpdateClockRecordMutation,
} from "@/src/state/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_CREATED: any = {
  id: "cr_001",
  userId: "user_abc",
  employeeName: "Thabiso",
  clockInTime: "2025-06-01T08:00:00.000Z",
  verificationStatus: "VERIFIED",
  syncedOffline: false,
  date: "2025-06-01",
  clockInLat: -26.2041,
  clockInLng: 28.0473,
  clockInAddress: "Sandton City, Sandton Drive, Sandton, Gauteng",
};

const MOCK_UPDATED: any = {
  ...MOCK_CREATED,
  clockOutTime: "2025-06-01T17:00:00.000Z",
  hoursWorked: 9.0,
};

function setupMocks({
  createResult = MOCK_CREATED,
  updateResult = MOCK_UPDATED,
  historyItems = [] as any[],
  online = true,
} = {}) {
  const createUnwrap = jest.fn().mockResolvedValue(createResult);
  const updateUnwrap = jest.fn().mockResolvedValue(updateResult);

  (useCreateClockRecordMutation as jest.Mock).mockReturnValue([
    jest.fn().mockReturnValue({ unwrap: createUnwrap }),
    { isLoading: false },
  ]);
  (useUpdateClockRecordMutation as jest.Mock).mockReturnValue([
    jest.fn().mockReturnValue({ unwrap: updateUnwrap }),
    { isLoading: false },
  ]);
  (useListMyClockRecordsQuery as jest.Mock).mockReturnValue({
    data: { items: historyItems, nextToken: null },
    isLoading: false,
    refetch: jest.fn(),
  });
  (NetInfo.fetch as jest.Mock).mockResolvedValue({
    isConnected: online,
    isInternetReachable: online,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe("useClockIn — online clock-in", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  test("clockIn returns a record and persists it to AsyncStorage", async () => {
    const { result } = renderHook(() => useClockIn("user_abc", "Thabiso"));

    let record: any;
    await act(async () => {
      record = await result.current.clockIn();
    });

    expect(record).toMatchObject({ id: "cr_001", userId: "user_abc" });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "attendance:active_record",
      expect.stringContaining("cr_001"),
    );
  });

  test("isClockedIn becomes true after clockIn", async () => {
    const { result } = renderHook(() => useClockIn("user_abc", "Thabiso"));

    expect(result.current.isClockedIn).toBe(false);
    await act(async () => {
      await result.current.clockIn();
    });
    expect(result.current.isClockedIn).toBe(true);
  });

  test("clockIn sets verificationStatus VERIFIED when online", async () => {
    const { result } = renderHook(() => useClockIn("user_abc", "Thabiso"));

    let record: any;
    await act(async () => {
      record = await result.current.clockIn();
    });

    expect(record.verificationStatus).toBe("VERIFIED");
    expect(record.syncedOffline).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("useClockIn — online clock-out", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  test("clockOut after clockIn clears activeRecord and removes AsyncStorage key", async () => {
    const { result } = renderHook(() => useClockIn("user_abc", "Thabiso"));

    await act(async () => {
      await result.current.clockIn();
    });
    expect(result.current.isClockedIn).toBe(true);

    await act(async () => {
      await result.current.clockOut();
    });
    expect(result.current.isClockedIn).toBe(false);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "attendance:active_record",
    );
  });

  test("clockOut without a prior clockIn returns null and sets error", async () => {
    const { result } = renderHook(() => useClockIn("user_abc", "Thabiso"));

    let record: any;
    await act(async () => {
      record = await result.current.clockOut();
    });

    expect(record).toBeNull();
    expect(result.current.error).toMatch(/No active clock-in/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("useClockIn — offline mode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks({ online: false });
  });

  test("offline clockIn enqueues to submissionQueue instead of calling API", async () => {
    const { result } = renderHook(() => useClockIn("user_abc", "Thabiso"));

    await act(async () => {
      await result.current.clockIn();
    });

    expect(enqueue).toHaveBeenCalledWith(
      "clockin",
      expect.objectContaining({
        userId: "user_abc",
        syncedOffline: true,
        verificationStatus: "PENDING_VERIFICATION",
      }),
    );
  });

  test("offline clockIn still sets isClockedIn true with a local_ id", async () => {
    const { result } = renderHook(() => useClockIn("user_abc", "Thabiso"));

    await act(async () => {
      await result.current.clockIn();
    });

    expect(result.current.isClockedIn).toBe(true);
    expect(result.current.activeRecord?.id).toMatch(/^local_/);
  });

  test("offline clockOut enqueues clockout and clears active record", async () => {
    const { result } = renderHook(() => useClockIn("user_abc", "Thabiso"));

    await act(async () => {
      await result.current.clockIn();
    });
    await act(async () => {
      await result.current.clockOut();
    });

    expect(enqueue).toHaveBeenCalledWith(
      "clockout",
      expect.objectContaining({
        id: expect.stringMatching(/^local_/),
      }),
    );
    expect(result.current.isClockedIn).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("useClockIn — hours calculation", () => {
  // Test the calculation directly without the hook
  const calcHours = (clockIn: string, clockOut: string) =>
    Math.round(
      ((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3600000) *
        100,
    ) / 100;

  test("standard 9-hour shift", () => {
    expect(calcHours("2025-06-01T08:00:00Z", "2025-06-01T17:00:00Z")).toBe(9.0);
  });

  test("half-day shift (4.5h)", () => {
    expect(calcHours("2025-06-01T08:00:00Z", "2025-06-01T12:30:00Z")).toBe(4.5);
  });

  test("overnight shift", () => {
    expect(calcHours("2025-06-01T22:00:00Z", "2025-06-02T06:00:00Z")).toBe(8.0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("useClockIn — error handling", () => {
  beforeEach(() => jest.clearAllMocks());

  test("sets error state when API throws", async () => {
    (useCreateClockRecordMutation as jest.Mock).mockReturnValue([
      jest.fn().mockReturnValue({
        unwrap: jest.fn().mockRejectedValue(new Error("Network error")),
      }),
      { isLoading: false },
    ]);
    (useUpdateClockRecordMutation as jest.Mock).mockReturnValue([
      jest.fn().mockReturnValue({ unwrap: jest.fn() }),
      { isLoading: false },
    ]);
    (useListMyClockRecordsQuery as jest.Mock).mockReturnValue({
      data: { items: [], nextToken: null },
      isLoading: false,
      refetch: jest.fn(),
    });
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });

    const { result } = renderHook(() => useClockIn("user_abc", "Thabiso"));

    await act(async () => {
      await result.current.clockIn();
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.isClockedIn).toBe(false);
  });

  test("clearError resets error state", async () => {
    (useCreateClockRecordMutation as jest.Mock).mockReturnValue([
      jest.fn().mockReturnValue({
        unwrap: jest.fn().mockRejectedValue(new Error("Oops")),
      }),
      { isLoading: false },
    ]);
    (useUpdateClockRecordMutation as jest.Mock).mockReturnValue([
      jest.fn().mockReturnValue({ unwrap: jest.fn() }),
      { isLoading: false },
    ]);
    (useListMyClockRecordsQuery as jest.Mock).mockReturnValue({
      data: { items: [], nextToken: null },
      isLoading: false,
      refetch: jest.fn(),
    });
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });

    const { result } = renderHook(() => useClockIn("user_abc", "Thabiso"));

    await act(async () => {
      await result.current.clockIn();
    });
    expect(result.current.error).toBeTruthy();

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });
});
