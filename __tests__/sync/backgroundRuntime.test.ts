// __tests__/sync/backgroundRuntime.test.ts
// Simulates the Android background wake: the real setTimeout never fires. Inside the background runtime it must.
import { enterBackgroundRuntime } from "@/src/sync/backgroundRuntime";

const g = globalThis as any;
const realSetImmediate = g.setImmediate;
const nativeTick = () => new Promise<void>((r) => realSetImmediate(r));

let deadSet: jest.Mock;
let deadClear: jest.Mock;
let realFetch: any;
beforeEach(() => {
  realFetch = g.fetch;
  deadSet = jest.fn(() => 0); // a timer that never fires, like a headless Android wake
  deadClear = jest.fn();
  g.setTimeout = deadSet;
  g.clearTimeout = deadClear;
});
afterEach(() => {
  g.fetch = realFetch;
});

test("timers fire inside the runtime even though the native timer is dead, and are restored after", async () => {
  const leave = enterBackgroundRuntime({ tick: nativeTick });
  const started = Date.now();
  await new Promise<void>((r) => g.setTimeout(r, 60)); // would hang forever without the runtime
  expect(Date.now() - started).toBeGreaterThanOrEqual(55);
  leave();
  expect(g.setTimeout).toBe(deadSet);
  expect(g.clearTimeout).toBe(deadClear);
});

test("clearTimeout cancels a pending timer; unknown ids go to the real clearTimeout", async () => {
  const leave = enterBackgroundRuntime({ tick: nativeTick });
  const fired = jest.fn();
  const id = g.setTimeout(fired, 30);
  g.clearTimeout(id);
  g.clearTimeout(12345); // not ours
  await new Promise<void>((r) => g.setTimeout(r, 80));
  expect(fired).not.toHaveBeenCalled();
  expect(deadClear).toHaveBeenCalledWith(12345);
  leave();
});

test("timers fire in order of their time, and a throwing callback does not stop the others", async () => {
  const leave = enterBackgroundRuntime({ tick: nativeTick });
  const order: string[] = [];
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  g.setTimeout(() => order.push("late"), 60);
  g.setTimeout(() => {
    order.push("boom");
    throw new Error("x");
  }, 10);
  g.setTimeout(() => order.push("early"), 20);
  await new Promise<void>((r) => g.setTimeout(r, 100));
  expect(order).toEqual(["boom", "early", "late"]);
  warn.mockRestore();
  leave();
});

test("if the native tick fails, it never spins: control goes back to the real timer", async () => {
  const leave = enterBackgroundRuntime({
    tick: () => Promise.reject(new Error("native down")),
  });
  g.setTimeout(() => {}, 500);
  await nativeTick();
  await nativeTick();
  expect(deadSet).toHaveBeenCalledWith(expect.any(Function), 20);
  leave();
});

test("network calls are noted by host only, and results pass through unchanged", async () => {
  const response = { status: 200 };
  g.fetch = jest.fn(async () => response);
  const notes: string[] = [];
  const leave = enterBackgroundRuntime({
    tick: nativeTick,
    note: (s) => notes.push(s),
  });
  const out = await g.fetch(
    "https://abc.appsync-api.af-south-1.amazonaws.com/graphql?secret=1",
    {
      body: "private",
    },
  );
  expect(out).toBe(response);
  expect(notes).toEqual([
    "network request to abc.appsync-api.af-south-1.amazonaws.com",
    "network reply 200 from abc.appsync-api.af-south-1.amazonaws.com",
  ]);
  expect(notes.join(" ")).not.toMatch(/secret|private|graphql/);
  leave();
});

test("a failed network call is noted with its message and still throws", async () => {
  g.fetch = jest.fn(async () => {
    throw new TypeError("Network request failed");
  });
  const notes: string[] = [];
  const leave = enterBackgroundRuntime({
    tick: nativeTick,
    note: (s) => notes.push(s),
  });
  await expect(g.fetch("https://x.example.com/a")).rejects.toThrow(
    "Network request failed",
  );
  expect(notes[notes.length - 1]).toBe(
    "network request to x.example.com failed: Network request failed",
  );
  leave();
});

test("reading a photo from the phone is passed through and not logged as a network call", async () => {
  const blobResponse = { blob: async () => "bytes" };
  g.fetch = jest.fn(async () => blobResponse);
  const notes: string[] = [];
  const leave = enterBackgroundRuntime({
    tick: nativeTick,
    note: (s) => notes.push(s),
  });
  const out = await g.fetch(
    "file:///data/user/0/app/files/jobcards/w1/photo.jpg",
  );
  expect(out).toBe(blobResponse);
  expect(notes).toEqual([]);
  leave();
});
