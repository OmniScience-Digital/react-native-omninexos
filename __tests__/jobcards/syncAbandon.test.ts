// __tests__/jobcards/syncAbandon.test.ts
// runSync lets only one sync run and makes later calls join it. If that sync is frozen (the OS paused the app), every
// later call waited on it forever. A frozen sync can now be abandoned, and the abandoned one finishing late must not
// disturb the run that replaced it.
import { abandonRunningSync, runSync } from "@/src/jobcards/sync";

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};
// Only the "no signal" path is used, so no store or server is touched.
const depsWith = (isOnline: () => Promise<boolean>) =>
  ({ isOnline, now: () => new Date(), store: {}, api: {} }) as any;

test("an abandoned sync is replaced, and its late finish does not clear the new one", async () => {
  const frozen = deferred<boolean>();
  const run1 = runSync(
    depsWith(() => frozen.promise),
    "u",
  );

  abandonRunningSync();

  const second = deferred<boolean>();
  const secondCalled = jest.fn(() => second.promise);
  const run2 = runSync(depsWith(secondCalled), "u");
  expect(run2).not.toBe(run1);
  expect(secondCalled).toHaveBeenCalledTimes(1);

  // the old, frozen run wakes up and finishes
  frozen.resolve(false);
  await expect(run1).resolves.toEqual({ offline: true });

  // the new run is still the running one: a third call joins it instead of starting another
  const run3 = runSync(
    depsWith(() => Promise.resolve(false)),
    "u",
  );
  expect(run3).toBe(run2);

  second.resolve(false);
  await expect(run2).resolves.toEqual({ offline: true });
});

test("without abandoning, a second call still joins the running sync", async () => {
  const d = deferred<boolean>();
  const run1 = runSync(
    depsWith(() => d.promise),
    "u",
  );
  const run2 = runSync(
    depsWith(() => Promise.resolve(false)),
    "u",
  );
  expect(run2).toBe(run1);
  d.resolve(false);
  await run1;
});
