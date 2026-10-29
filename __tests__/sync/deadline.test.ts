// __tests__/sync/deadline.test.ts
import { DeadlineError, withDeadline } from "@/src/sync/deadline";

test("passes the result through when the work finishes in time", async () => {
  await expect(withDeadline(Promise.resolve(7), 200, "x")).resolves.toBe(7);
});

test("passes the work's own error through", async () => {
  await expect(
    withDeadline(Promise.reject(new Error("boom")), 200, "x"),
  ).rejects.toThrow("boom");
});

test("gives up with a named DeadlineError when the work never finishes", async () => {
  const never = new Promise<void>(() => {});
  const err = await withDeadline(never, 30, "the sync").catch((e) => e);
  expect(err).toBeInstanceOf(DeadlineError);
  expect(err.message).toBe("the sync did not finish within 0s");
  expect(err.label).toBe("the sync");
});

test("does not leave a timer running after the work finishes", async () => {
  jest.useFakeTimers();
  const p = withDeadline(Promise.resolve(1), 10_000, "x");
  await p;
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});
