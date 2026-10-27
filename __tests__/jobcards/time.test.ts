// __tests__/jobcards/time.test.ts
import { isAssignedToMe, personKey } from "../../src/jobcards/people";
import {
  computeTimes,
  resolveEnd,
  STALE_MS,
  type TimeRow,
} from "../../src/jobcards/time";

const T0 = Date.parse("2026-10-22T08:00:00.000Z");
const at = (min: number) => new Date(T0 + min * 60_000).toISOString();
const row = (
  id: string,
  userId: string,
  from: number,
  to: number | null,
  over: Partial<TimeRow> = {},
): TimeRow => ({
  id,
  jobCardId: "jc1",
  userId,
  startedAt: at(from),
  endedAt: to === null ? null : at(to),
  ...over,
});
const me = { ids: new Set(["sub-me"]), email: "ayanda@x.co" };

describe("computeTimes", () => {
  it("adds different people together and keeps my own time apart", () => {
    const t = computeTimes(
      [row("a", "sub-me", 0, 60), row("b", "sub-ben", 0, 30)],
      [],
      me,
      T0 + 3_600_000,
    )!.get("jc1")!;
    expect(t).toMatchObject({
      totalMinutes: 90,
      myMinutes: 60,
      running: false,
    });
  });

  it("one person with two logins is one person: overlapping time counts once", () => {
    const manual = row("a", "sub-me", 0, 60, { userEmail: "Ayanda@x.co" });
    const google = row("b", "Google_9", 30, 90, { userEmail: "ayanda@x.co" });
    const t = computeTimes([manual, google], [], me, T0 + 7_200_000).get(
      "jc1",
    )!;
    expect(t.totalMinutes).toBe(90); // 0-90, not 60 + 60
    expect(t.myMinutes).toBe(90);
  });

  it("an older row with only an id joins its person through another row that has both", () => {
    const withEmail = row("a", "Google_9", 0, 30, { userEmail: "ben@x.co" });
    const legacy = row("b", "Google_9", 20, 50); // no email
    const t = computeTimes([withEmail, legacy], [], me, T0 + 7_200_000).get(
      "jc1",
    )!;
    expect(t.totalMinutes).toBe(50);
  });

  it("an older row without an email, saved under one of my ids, is mine", () => {
    const both = {
      ids: new Set(["sub-me", "Google_me"]),
      email: "ayanda@x.co",
    };
    const t = computeTimes(
      [row("a", "Google_me", 0, 45)],
      [],
      both,
      T0 + 3_600_000,
    ).get("jc1")!;
    expect(t).toMatchObject({ totalMinutes: 45, myMinutes: 45 });
  });

  it("this phone's own live session counts up to now and shows as running", () => {
    const live = row("p", "sub-me", 0, null, { userEmail: "ayanda@x.co" });
    const t = computeTimes([], [live], me, T0 + 25 * 60_000).get("jc1")!;
    expect(t).toMatchObject({ totalMinutes: 25, myMinutes: 25, running: true });
  });

  it("the phone's copy of a session wins over the server's copy", () => {
    const server = row("s", "sub-me", 0, null, { lastActiveAt: at(1) });
    const phone = row("s", "sub-me", 0, 40);
    const t = computeTimes([server], [phone], me, T0 + 86_400_000).get("jc1")!;
    expect(t.totalMinutes).toBe(40);
    expect(t.running).toBe(false);
  });

  it("someone else's open session with no heartbeat for days does not run forever", () => {
    const stale = row("x", "sub-ben", 0, null, { lastActiveAt: at(10) });
    const t = computeTimes([stale], [], me, T0 + 3 * 86_400_000).get("jc1")!;
    expect(t.totalMinutes).toBe(10 + STALE_MS / 60_000); // up to its last sign of life, plus the grace period
    expect(t.running).toBe(false);
  });

  it("an old open row with no heartbeat at all counts only the grace period", () => {
    const t = computeTimes(
      [row("x", "sub-ben", 0, null)],
      [],
      me,
      T0 + 3 * 86_400_000,
    ).get("jc1")!;
    expect(t.totalMinutes).toBe(STALE_MS / 60_000);
  });

  it("a session that is still sending heartbeats counts up to now", () => {
    const live = row("x", "sub-ben", 0, null, { lastActiveAt: at(58) });
    expect(
      computeTimes([live], [], me, T0 + 60 * 60_000).get("jc1")!.totalMinutes,
    ).toBe(60);
  });

  it("time started by adding work is never counted", () => {
    const added = row("w", "sub-ben", 0, 600, {
      startReason: "WORK_ITEM_ADDED",
    });
    const real = row("r", "sub-ben", 0, 30, { startReason: "JOB_CARD_OPENED" });
    expect(
      computeTimes([added, real], [], me, T0 + 86_400_000).get("jc1")!
        .totalMinutes,
    ).toBe(30);
  });
});

describe("resolveEnd", () => {
  const startedAt = at(0);
  it("uses the phone's end when the server has not closed it", () => {
    expect(resolveEnd({ startedAt, phoneEnd: at(90) })).toBe(at(90));
  });
  it("the phone's end wins over an idle-timeout close (the phone was offline, not idle)", () => {
    expect(
      resolveEnd({
        startedAt,
        phoneEnd: at(90),
        serverEndedAt: at(6),
        serverEndReason: "IDLE_TIMEOUT",
      }),
    ).toBe(at(90));
  });
  it("time after the work was finished is not counted", () => {
    expect(
      resolveEnd({
        startedAt,
        phoneEnd: at(90),
        serverEndedAt: at(60),
        serverEndReason: "ALL_SUBMITTED",
      }),
    ).toBe(at(60));
    expect(
      resolveEnd({
        startedAt,
        phoneEnd: at(90),
        serverEndedAt: at(70),
        serverEndReason: "JOB_CLOSED",
      }),
    ).toBe(at(70));
  });
  it("leaving before the work finished keeps the earlier phone end", () => {
    expect(
      resolveEnd({
        startedAt,
        phoneEnd: at(30),
        serverEndedAt: at(60),
        serverEndReason: "ALL_SUBMITTED",
      }),
    ).toBe(at(30));
  });
  it("is never before the start", () => {
    expect(resolveEnd({ startedAt: at(10), phoneEnd: at(5) })).toBe(at(10));
  });
});

describe("people", () => {
  it("matches the assigned technician by email, whichever login they use", () => {
    expect(
      isAssignedToMe(
        { assignedTo: "sub-other", assignedToEmail: "Ayanda@x.co" },
        me,
      ),
    ).toBe(true);
    expect(
      isAssignedToMe({ assignedTo: "sub-me", assignedToEmail: "ben@x.co" }, me),
    ).toBe(false);
  });
  it("falls back to the id when no email is known", () => {
    expect(isAssignedToMe({ assignedTo: "sub-me" }, me)).toBe(true);
    expect(isAssignedToMe({ assignedTo: "sub-ben" }, me)).toBe(false);
    expect(isAssignedToMe({}, me)).toBe(false);
  });
  it("personKey prefers email", () => {
    expect(personKey("a", " Ben@X.co ")).toBe("email:ben@x.co");
    expect(personKey("a")).toBe("id:a");
  });
});
