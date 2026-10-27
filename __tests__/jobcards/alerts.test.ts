// __tests__/jobcards/alerts.test.ts
import {
    alertBody,
    alertKey,
    alertTitle,
    cardsFromWork,
    currentAlertKeys,
    freshJobCardAlerts,
    isJobCardAlert,
    jobCardAlertsToClear,
    type AlertCard,
} from "../../src/jobcards/alerts";

const me = { ids: new Set(["sub-me"]), email: "ayanda@x.co" };
const w = (id: string, jobCardId: string, over: Record<string, unknown> = {}) =>
  ({
    id,
    jobCardId,
    jcNumber: `JC-${jobCardId}`,
    customerName: "ESCOM",
    assignedAt: "2026-10-20T07:00:00.000Z",
    jobCardAssignedTo: "sub-other",
    jobCardAssignedToEmail: "ayanda@x.co",
    jobCardStatus: "OPEN",
    localState: "PENDING",
    ...over,
  }) as any;

describe("alert text", () => {
  it("reads New Jc : <number>, with the customer underneath", () => {
    expect(alertTitle("JC-QU-0032")).toBe("New Jc : JC-QU-0032");
    expect(alertBody("ESCOM")).toBe("ESCOM");
    expect(alertBody(null)).toBe("Assigned to you");
  });
});

describe("job card alerts", () => {
  it("one alert per job card, however many work items it has", () => {
    const cards = cardsFromWork([w("a", "1"), w("b", "1"), w("c", "1")], me);
    expect(cards).toHaveLength(1);
    expect(freshJobCardAlerts(cards, new Set())).toHaveLength(1);
  });
  it("only job cards assigned to me, by email whichever login I use", () => {
    const cards = cardsFromWork(
      [w("a", "1"), w("b", "2", { jobCardAssignedToEmail: "ben@x.co" })],
      me,
    );
    expect(
      freshJobCardAlerts(cards, new Set()).map((c) => c.jobCardId),
    ).toEqual(["1"]);
  });
  it("not for a job card with no work left, or one that is closed", () => {
    const done = cardsFromWork([w("a", "1", { localState: "SUBMITTED" })], me);
    const closed = cardsFromWork(
      [w("a", "2", { jobCardStatus: "CLOSED" })],
      me,
    );
    expect(freshJobCardAlerts([...done, ...closed], new Set())).toEqual([]);
  });
  it("announced once, and again only if it is assigned again", () => {
    const cards = cardsFromWork([w("a", "1")], me);
    const seen = new Set([alertKey(cards[0])]);
    expect(freshJobCardAlerts(cards, seen)).toEqual([]);
    const reassigned = cardsFromWork(
      [w("a", "1", { assignedAt: "2026-10-25T07:00:00.000Z" })],
      me,
    );
    expect(freshJobCardAlerts(reassigned, seen)).toHaveLength(1);
  });
  it("adding more work to an already announced job card does not alert again", () => {
    const seen = new Set(currentAlertKeys(cardsFromWork([w("a", "1")], me)));
    expect(
      freshJobCardAlerts(cardsFromWork([w("a", "1"), w("b", "1")], me), seen),
    ).toEqual([]);
  });
});

describe("clearing job card alerts", () => {
  const alert = (
    jobCardId: string,
    receivedAt = "2026-10-20T07:00:00.000Z",
  ) => ({
    id: `n-${jobCardId}`,
    receivedAt: new Date(receivedAt),
    data: { type: "jobcard-assigned", jobCardId },
  });
  const cards = (over: Partial<AlertCard> = {}): AlertCard[] => [
    {
      jobCardId: "1",
      jcNumber: "JC-1",
      assignedToMe: true,
      pending: 2,
      closed: false,
      ...over,
    },
  ];
  const pulled = "2026-10-21T08:00:00.000Z";

  it("keeps the alert while the job card still has work to do", () => {
    expect(jobCardAlertsToClear([alert("1")], cards(), pulled)).toEqual([]);
  });
  it("clears it when no work is left, when closed, or when the job card has left the phone", () => {
    expect(
      jobCardAlertsToClear([alert("1")], cards({ pending: 0 }), pulled),
    ).toEqual(["n-1"]);
    expect(
      jobCardAlertsToClear([alert("1")], cards({ closed: true }), pulled),
    ).toEqual(["n-1"]);
    expect(jobCardAlertsToClear([alert("1")], [], pulled)).toEqual(["n-1"]);
  });
  it("never clears a new alert before the phone has refreshed since it arrived", () => {
    expect(
      jobCardAlertsToClear(
        [alert("1", "2026-10-21T09:00:00.000Z")],
        [],
        pulled,
      ),
    ).toEqual([]);
    expect(jobCardAlertsToClear([alert("1")], [], null)).toEqual([]);
  });
  it("leaves older per-work-item alerts to the old rules", () => {
    const legacy = {
      id: "n-x",
      receivedAt: new Date("2026-10-20T07:00:00.000Z"),
      data: { type: "jobcard-assigned", jobCardId: "1", workItemId: "w1" },
    };
    expect(isJobCardAlert(legacy.data)).toBe(false);
    expect(jobCardAlertsToClear([legacy], [], pulled)).toEqual([]);
  });
});
