/**
 * __tests__/attendance/clockRecord.api.test.ts
 *
 * Unit tests for the attendance RTK endpoints.
 * These mock the Amplify client so no real network calls are made.
 * Run with:  npx jest __tests__/attendance/clockRecord.api.test.ts
 */

import { configureStore } from "@reduxjs/toolkit";
import { api } from "../../src/state/api";

// ── Mock the Amplify client ───────────────────────────────────────────────────
const mockGraphql = jest.fn();
jest.mock("../../src/amplify", () => ({
  client: { graphql: (...args: any[]) => mockGraphql(...args) },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeStore = () =>
  configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: (gDM) => gDM().concat(api.middleware),
  });

const MOCK_RECORD = {
  id: "cr_test_001",
  userId: "user_abc",
  employeeName: "Test Employee",
  clockInTime: "2025-06-01T08:00:00.000Z",
  clockOutTime: undefined,
  hoursWorked: undefined,
  clockInLat: -26.2041,
  clockInLng: 28.0473,
  clockInAddress: "Sandton, Johannesburg",
  verificationStatus: "VERIFIED",
  syncedOffline: false,
  date: "2025-06-01",
  createdAt: "2025-06-01T08:00:00.000Z",
  updatedAt: "2025-06-01T08:00:00.000Z",
};

const MOCK_UPDATED = {
  ...MOCK_RECORD,
  clockOutTime: "2025-06-01T17:00:00.000Z",
  hoursWorked: 9.0,
  clockOutLat: -26.2041,
  clockOutLng: 28.0473,
  clockOutAddress: "Sandton, Johannesburg",
};

// ─────────────────────────────────────────────────────────────────────────────

describe("Attendance API — createClockRecord", () => {
  beforeEach(() => mockGraphql.mockClear());

  test("returns ClockRecord on successful clock-in", async () => {
    mockGraphql.mockResolvedValueOnce({
      data: { createClockRecord: MOCK_RECORD },
      errors: undefined,
    });

    const store = makeStore();
    const result = await store.dispatch(
      api.endpoints.createClockRecord.initiate({
        userId: "user_abc",
        employeeName: "Test Employee",
        clockInTime: "2025-06-01T08:00:00.000Z",
        verificationStatus: "VERIFIED",
        syncedOffline: false,
        date: "2025-06-01",
        clockInLat: -26.2041,
        clockInLng: 28.0473,
        clockInAddress: "Sandton, Johannesburg",
      }),
    );

    expect(result.data).toMatchObject({
      id: "cr_test_001",
      userId: "user_abc",
      clockInTime: "2025-06-01T08:00:00.000Z",
      verificationStatus: "VERIFIED",
      syncedOffline: false,
    });
  });

  test("returns error when GraphQL errors array is present", async () => {
    mockGraphql.mockResolvedValueOnce({
      data: null,
      errors: [{ message: "Unauthorized" }],
    });

    const store = makeStore();
    const result = await store.dispatch(
      api.endpoints.createClockRecord.initiate({
        userId: "user_abc",
        employeeName: "Test Employee",
        clockInTime: "2025-06-01T08:00:00.000Z",
        verificationStatus: "VERIFIED",
        syncedOffline: false,
        date: "2025-06-01",
      }),
    );

    expect(result.error).toBeDefined();
    expect((result as any).error).toMatch(/Unauthorized/);
  });

  test("marks syncedOffline true when flagged", async () => {
    const offlineRecord = {
      ...MOCK_RECORD,
      syncedOffline: true,
      verificationStatus: "PENDING_VERIFICATION",
    };
    mockGraphql.mockResolvedValueOnce({
      data: { createClockRecord: offlineRecord },
    });

    const store = makeStore();
    const result = await store.dispatch(
      api.endpoints.createClockRecord.initiate({
        userId: "user_abc",
        employeeName: "Test Employee",
        clockInTime: "2025-06-01T08:00:00.000Z",
        verificationStatus: "PENDING_VERIFICATION",
        syncedOffline: true,
        date: "2025-06-01",
      }),
    );

    expect(result.data?.syncedOffline).toBe(true);
    expect(result.data?.verificationStatus).toBe("PENDING_VERIFICATION");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Attendance API — updateClockRecord (clock-out)", () => {
  beforeEach(() => mockGraphql.mockClear());

  test("returns updated record with hoursWorked on clock-out", async () => {
    mockGraphql.mockResolvedValueOnce({
      data: { updateClockRecord: MOCK_UPDATED },
    });

    const store = makeStore();
    const result = await store.dispatch(
      api.endpoints.updateClockRecord.initiate({
        id: "cr_test_001",
        clockOutTime: "2025-06-01T17:00:00.000Z",
        hoursWorked: 9.0,
        clockOutLat: -26.2041,
        clockOutLng: 28.0473,
        clockOutAddress: "Sandton, Johannesburg",
      }),
    );

    expect(result.data?.clockOutTime).toBe("2025-06-01T17:00:00.000Z");
    expect(result.data?.hoursWorked).toBe(9.0);
  });

  test("returns error when record id not found", async () => {
    mockGraphql.mockResolvedValueOnce({
      data: null,
      errors: [{ message: "Record not found" }],
    });

    const store = makeStore();
    const result = await store.dispatch(
      api.endpoints.updateClockRecord.initiate({
        id: "nonexistent_id",
        clockOutTime: "2025-06-01T17:00:00.000Z",
        hoursWorked: 9.0,
      }),
    );

    expect(result.error).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Attendance API — listMyClockRecords", () => {
  beforeEach(() => mockGraphql.mockClear());

  test("returns paginated list for the user", async () => {
    mockGraphql.mockResolvedValueOnce({
      data: {
        listClockRecords: {
          items: [MOCK_UPDATED, MOCK_RECORD],
          nextToken: null,
        },
      },
    });

    const store = makeStore();
    const result = await store.dispatch(
      api.endpoints.listMyClockRecords.initiate({
        userId: "user_abc",
        limit: 50,
      }),
    );

    expect(result.data?.items).toHaveLength(2);
    expect(result.data?.nextToken).toBeNull();
    expect(result.data?.items[0].userId).toBe("user_abc");
  });

  test("returns empty array when user has no records", async () => {
    mockGraphql.mockResolvedValueOnce({
      data: { listClockRecords: { items: [], nextToken: null } },
    });

    const store = makeStore();
    const result = await store.dispatch(
      api.endpoints.listMyClockRecords.initiate({ userId: "user_new" }),
    );

    expect(result.data?.items).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Attendance API — getClockRecord", () => {
  beforeEach(() => mockGraphql.mockClear());

  test("returns a single record by id", async () => {
    mockGraphql.mockResolvedValueOnce({
      data: { getClockRecord: MOCK_RECORD },
    });

    const store = makeStore();
    const result = await store.dispatch(
      api.endpoints.getClockRecord.initiate("cr_test_001"),
    );

    expect(result.data?.id).toBe("cr_test_001");
    expect(result.data?.employeeName).toBe("Test Employee");
  });

  test("returns error for missing id", async () => {
    mockGraphql.mockResolvedValueOnce({
      data: null,
      errors: [{ message: "Item not found" }],
    });

    const store = makeStore();
    const result = await store.dispatch(
      api.endpoints.getClockRecord.initiate("bad_id"),
    );

    expect(result.error).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Hours calculation — verifying the math", () => {
  const calcHours = (clockIn: string, clockOut: string): number =>
    Math.round(
      ((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3600000) *
        100,
    ) / 100;

  test("8-hour shift calculates correctly", () => {
    expect(
      calcHours("2025-06-01T08:00:00.000Z", "2025-06-01T16:00:00.000Z"),
    ).toBe(8.0);
  });

  test("9.5-hour shift calculates correctly", () => {
    expect(
      calcHours("2025-06-01T07:30:00.000Z", "2025-06-01T17:00:00.000Z"),
    ).toBe(9.5);
  });

  test("overnight shift spanning midnight calculates correctly", () => {
    expect(
      calcHours("2025-06-01T22:00:00.000Z", "2025-06-02T06:00:00.000Z"),
    ).toBe(8.0);
  });

  test("very short clock-in (1 minute) does not return negative or zero", () => {
    const h = calcHours("2025-06-01T08:00:00.000Z", "2025-06-01T08:01:00.000Z");
    expect(h).toBeGreaterThan(0);
    expect(h).toBeCloseTo(0.02, 1);
  });
});
