// __tests__/sync/backgroundRegistration.test.ts
// Regression: the layout used to ask "unregister" (user still loading) and "register" (user loaded) back to back.
// They overlapped, the second saw "already registered", and the task ended up unregistered. They must now run in
// order, and the outcome must be recorded where the debug screen can show it.
const mockRegistered = { value: false };
const mockStore: Record<string, string> = {};
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockStore[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      mockStore[k] = v;
    }),
    removeItem: jest.fn(async (k: string) => {
      delete mockStore[k];
    }),
  },
}));
jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => {
    await delay(5);
    return mockRegistered.value;
  }),
}));
jest.mock("expo-background-task", () => ({
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  getStatusAsync: jest.fn(async () => 2),
  registerTaskAsync: jest.fn(async () => {
    await delay(5);
    mockRegistered.value = true;
  }),
  unregisterTaskAsync: jest.fn(async () => {
    await delay(30); // slow enough to overlap the register call if they were not serialised
    mockRegistered.value = false;
  }),
}));
jest.mock("@/src/jobcards/controller", () => ({
  requestSyncDetailed: jest.fn(),
  setJobCardUser: jest.fn(),
}));
jest.mock("@/src/jobcards/sqliteDriver", () => ({
  getJobCardStore: jest.fn(),
}));
jest.mock("@/src/jobcards/people", () => ({ normEmail: (s: any) => s }));

import {
    registerJobCardBackgroundSync,
    unregisterJobCardBackgroundSync,
} from "@/src/jobcards/background";
import { getRegistration } from "@/src/sync/backgroundLog";

beforeEach(() => {
  mockRegistered.value = true; // registered from a previous launch
  for (const k of Object.keys(mockStore)) delete mockStore[k];
});

test("unregister then register back to back ends registered", async () => {
  void unregisterJobCardBackgroundSync();
  await registerJobCardBackgroundSync();
  expect(mockRegistered.value).toBe(true);
  expect(await getRegistration()).toMatchObject({
    action: "register",
    registered: true,
    status: 2,
  });
});

test("a register that throws is recorded with its error", async () => {
  mockRegistered.value = false;
  const bg = require("expo-background-task");
  bg.registerTaskAsync.mockRejectedValueOnce(new Error("no worker"));
  await registerJobCardBackgroundSync();
  expect(await getRegistration()).toMatchObject({
    action: "register",
    registered: false,
    error: "no worker",
  });
});
