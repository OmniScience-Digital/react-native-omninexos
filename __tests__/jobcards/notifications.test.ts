// __tests__/jobcards/notifications.test.ts
import { jobCardTargetFromData } from "../../src/jobcards/notifications";

describe("jobCardTargetFromData", () => {
  it("a job card assignment opens the job card", () => {
    expect(
      jobCardTargetFromData({ type: "jobcard-assigned", jobCardId: "jc1" }),
    ).toEqual({ jobCardId: "jc1" });
  });
  it("an older notification still opens its work item", () => {
    expect(
      jobCardTargetFromData({
        type: "jobcard-assigned",
        workItemId: "w1",
        jobCardId: "jc1",
      }),
    ).toEqual({
      workItemId: "w1",
      jobCardId: "jc1",
    });
  });
  it("ignores other notifications and empty data", () => {
    expect(
      jobCardTargetFromData({ type: "something-else", jobCardId: "jc1" }),
    ).toBeNull();
    expect(jobCardTargetFromData({ type: "jobcard-assigned" })).toBeNull();
    expect(
      jobCardTargetFromData({ type: "jobcard-assigned", jobCardId: "" }),
    ).toBeNull();
    expect(jobCardTargetFromData(null)).toBeNull();
    expect(jobCardTargetFromData("x")).toBeNull();
  });
});
