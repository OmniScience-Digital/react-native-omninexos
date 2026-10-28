// __tests__/sync/backgroundOutcome.test.ts
// The background task must never claim "synced" when nothing was sent, and must report Failed only when something
// was actually attempted and went wrong.
jest.mock("@/src/jobcards/controller", () => ({}));
import { interpretOutcome } from "@/src/jobcards/backgroundOutcome";

const done = (summary: any) => ({ status: "done" as const, summary });

describe("interpretOutcome", () => {
  test("nobody signed in is recorded as no-user and is not a failure", () => {
    const r = interpretOutcome({ status: "no-user" });
    expect(r.outcome).toBe("no-user");
    expect(r.failed).toBe(false);
  });

  test("a wake with no signal is recorded as offline, not as synced", () => {
    const r = interpretOutcome(done({ offline: true }));
    expect(r.outcome).toBe("offline");
    expect(r.failed).toBe(false);
  });

  test("a clean run is synced and carries the counts", () => {
    const r = interpretOutcome(
      done({
        offline: false,
        push: { sent: 2, failed: 0, blocked: 1 },
        pull: { items: 5, jobCards: 2, failedLookups: 0 },
      }),
    );
    expect(r).toMatchObject({
      outcome: "synced",
      failed: false,
      sent: 2,
      blocked: 1,
      pulledItems: 5,
    });
  });

  test("a failed send is partial and reports Failed to the OS", () => {
    const r = interpretOutcome(
      done({ offline: false, push: { sent: 1, failed: 1, blocked: 0 } }),
    );
    expect(r.outcome).toBe("partial");
    expect(r.failed).toBe(true);
    expect(r.failedSends).toBe(1);
  });

  test("a failed pull is partial and keeps the error text", () => {
    const r = interpretOutcome(
      done({
        offline: false,
        push: { sent: 0, failed: 0, blocked: 0 },
        pullError: "Network request failed",
      }),
    );
    expect(r.outcome).toBe("partial");
    expect(r.failed).toBe(true);
    expect(r.error).toBe("Network request failed");
  });

  test("already-blocked rows alone do not make every wake a failure", () => {
    const r = interpretOutcome(
      done({ offline: false, push: { sent: 0, failed: 0, blocked: 3 } }),
    );
    expect(r.outcome).toBe("synced");
    expect(r.failed).toBe(false);
  });

  test("a thrown sync is error and Failed", () => {
    const r = interpretOutcome({ status: "error", error: "boom" });
    expect(r).toMatchObject({ outcome: "error", failed: true, error: "boom" });
  });
});
