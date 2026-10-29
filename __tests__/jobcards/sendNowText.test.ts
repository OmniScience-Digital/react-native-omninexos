// __tests__/jobcards/sendNowText.test.ts
jest.mock("@/src/jobcards/controller", () => ({}));
import { SEND_NOTE, sendNowMessage } from "@/src/jobcards/sendNowText";

test("with no signal the technician is told the work is safe and will send by itself", () => {
  const m = sendNowMessage({ status: "offline" });
  expect(m).toMatch(/No signal/);
  expect(m).toMatch(/saved on this phone/);
  expect(m).toMatch(/by itself/);
});

test("results are counted in plain words", () => {
  expect(sendNowMessage({ status: "sent", sent: 1 })).toBe("Sent.");
  expect(sendNowMessage({ status: "sent", sent: 3 })).toBe("Sent 3 results.");
  expect(sendNowMessage({ status: "waiting", waiting: 2 })).toBe(
    "2 still waiting. It will try again by itself.",
  );
  expect(sendNowMessage({ status: "nothing" })).toBe(
    "Everything is already sent.",
  );
  expect(sendNowMessage({ status: "error" })).toMatch(/safe on this phone/);
});

test("the standing note tells them to open the app once and not swipe it away", () => {
  expect(SEND_NOTE).toMatch(/Open the app once/);
  expect(SEND_NOTE).toMatch(/don't swipe it away/);
});
