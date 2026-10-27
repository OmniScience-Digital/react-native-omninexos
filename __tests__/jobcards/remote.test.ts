// __tests__/jobcards/remote.test.ts
import {
  formFromResult,
  isRemotePhoto,
  remoteKeyOf,
} from "../../src/jobcards/remote";
import { buildResult, photosOf } from "../../src/jobcards/rules";
import type {
  InspectionForm,
  SpanForm,
  ZeroForm,
} from "../../src/jobcards/types";

const saved = (
  result: Record<string, unknown>,
  photos: Record<string, unknown>,
) => ({ ...result, photos });
const toRemote = (p: Record<string, string | string[]>) =>
  Object.fromEntries(
    Object.entries(p).map(([k, v]) => [
      k,
      Array.isArray(v) ? v.map((x) => `stored/${x}`) : `stored/${v}`,
    ]),
  );

describe("formFromResult", () => {
  it("zero calibration comes back as it was typed, with the saved photo", () => {
    const form: ZeroForm = {
      newZeroValue: "1250",
      photos: { zero: "file://zero.jpg" },
    };
    const back = formFromResult(
      "ZERO_CALIBRATION",
      saved(
        buildResult("ZERO_CALIBRATION", form, null),
        toRemote(photosOf("ZERO_CALIBRATION", form)),
      ),
    ) as ZeroForm;
    expect(back).toEqual({
      newZeroValue: "1250",
      photos: { zero: "remote:stored/file://zero.jpg" },
    });
  });

  it("inspection keeps every answer, including 'not applicable', and all the photos", () => {
    const form: InspectionForm = {
      asFoundTotalizer: "100",
      asFoundSpanCoefficient: "12345678",
      asFoundZeroValue: "54321",
      asFoundSpeedCoefficient: "2.5",
      asFoundMaxTph: "900",
      asFoundMinTph: "100.5",
      asFoundRunningSpeed: "1.2",
      partsAttached: true,
      weighframeClean: false,
      integratorPanelClean: true,
      weighframeMovesFreely: true,
      torsionRodsMoveFreely: "NA",
      rollersTurning: true,
      beltTracking: false,
      integratorOk: true,
      speedSensorOk: true,
      photos: {
        speedSensor: "a.jpg",
        integratorPanel: "b.jpg",
        scale: ["c.jpg", "d.jpg"],
      },
    };
    const back = formFromResult(
      "INSPECTION",
      saved(
        buildResult("INSPECTION", form, null),
        toRemote(photosOf("INSPECTION", form)),
      ),
    ) as InspectionForm;
    expect(back).toMatchObject({
      ...form,
      photos: {
        speedSensor: "remote:stored/a.jpg",
        integratorPanel: "remote:stored/b.jpg",
        scale: ["remote:stored/c.jpg", "remote:stored/d.jpg"],
      },
    });
  });

  it("span keeps the readings and the zero and span the result was worked out from", () => {
    const form: SpanForm = {
      offset: "10",
      actual: "500",
      indicated: "498",
      manualLatestZero: "",
      manualLatestSpan: "",
      spanAdjusted: true,
      newSpan: "12400",
      photos: { offset: "o.jpg", actual: "a.jpg", indicated: "i.jpg" },
    };
    const baseline = { latestZero: "1250", latestSpan: "12345" };
    const back = formFromResult(
      "SPAN_CALIBRATION",
      saved(
        buildResult("SPAN_CALIBRATION", form, baseline),
        toRemote(photosOf("SPAN_CALIBRATION", form)),
      ),
    ) as SpanForm;
    expect(back).toMatchObject({
      offset: "10",
      actual: "500",
      indicated: "498",
      manualLatestZero: "1250",
      manualLatestSpan: "12345",
      spanAdjusted: true,
      newSpan: "12400",
    });
    expect(back.photos.offset).toBe("remote:stored/o.jpg");
  });

  it("an answered Yes/No comes back as true or false, and anything else as not answered", () => {
    const f = formFromResult("INSPECTION", {
      partsAttached: true,
      weighframeClean: false,
      torsionRodsMoveFreely: false,
      rollersTurning: "Yes",
    }) as InspectionForm;
    expect(f).toMatchObject({
      partsAttached: true,
      weighframeClean: false,
      torsionRodsMoveFreely: false,
      rollersTurning: null,
      beltTracking: null,
    });
  });

  it("missing photos stay empty rather than breaking", () => {
    expect(formFromResult("ZERO_CALIBRATION", { newZeroValue: "5" })).toEqual({
      newZeroValue: "5",
      photos: { zero: null },
    });
  });

  it("recognises a saved photo", () => {
    expect(isRemotePhoto("remote:k/1.jpg")).toBe(true);
    expect(isRemotePhoto("file:///x.jpg")).toBe(false);
    expect(remoteKeyOf("remote:k/1.jpg")).toBe("k/1.jpg");
  });
});
