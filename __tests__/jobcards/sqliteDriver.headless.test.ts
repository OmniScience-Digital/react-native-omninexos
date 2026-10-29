// __tests__/jobcards/sqliteDriver.headless.test.ts
// Regression for the stuck background wake: Android fires no JS timers in a headless wake, so the driver's
// 400 ms "cold start" wait never ended and the task hung at its first step. With delays switched off, opening the
// store must complete without a single timer firing.
jest.mock("react-native", () => ({ Platform: { OS: "android" } }));
const mockDb = {
  execAsync: jest.fn(async () => undefined),
  runAsync: jest.fn(async () => undefined),
  getFirstAsync: jest.fn(async () => null),
  getAllAsync: jest.fn(async () => []),
  closeAsync: jest.fn(async () => undefined),
};
jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async () => mockDb),
}));

import { getJobCardStore, setSkipDelays } from "@/src/jobcards/sqliteDriver";

test("opens the store with no timers running when delays are off", async () => {
  jest.useFakeTimers(); // no timer will ever fire, like a headless Android wake
  setSkipDelays(true);
  await expect(getJobCardStore()).resolves.toBeDefined();
  jest.useRealTimers();
});
