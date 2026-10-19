// src/jobcards/rules.ts
// The rules for filling in a work item: what is required, how long numbers may be, how many photos, and the span
// calculation. Pure (no phone features), so it is the same on every device and fully unit tested.
import type { InspectionForm, SpanForm, WorkItemType, ZeroForm } from "./types";

export const SCALE_PHOTOS_MIN = 5;
export const SCALE_PHOTOS_MAX = 15;

export type Errors = Record<string, string>;
export interface Validation {
  ok: boolean;
  errors: Errors;
}

const finish = (errors: Errors): Validation => ({
  ok: Object.keys(errors).length === 0,
  errors,
});

/** Whole numbers only, at most `max` digits ("1250", not "12.5" or "-3"). */
export function checkDigits(
  label: string,
  value: string,
  max: number,
  required = true,
): string | null {
  const v = value.trim();
  if (!v) return required ? `${label} is required` : null;
  if (!/^\d+$/.test(v)) return `${label}: digits only`;
  if (v.length > max) return `${label}: at most ${max} digits`;
  return null;
}

/** A number with at most 2 decimals (the "." or "," may be used). */
export function checkDecimal2(
  label: string,
  value: string,
  required = true,
): string | null {
  const v = value.trim().replace(",", ".");
  if (!v) return required ? `${label} is required` : null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(v))
    return `${label}: a number with up to 2 decimals`;
  return null;
}

export const toNumber = (value: string): number =>
  Number(value.trim().replace(",", "."));

const needAnswer = (errors: Errors, key: string, label: string, v: unknown) => {
  if (v === null || v === undefined) errors[key] = `${label}: choose Yes or No`;
};

// ---------------------------------------------------------------- inspection
export function validateInspection(f: InspectionForm): Validation {
  const e: Errors = {};
  const put = (key: string, msg: string | null) => {
    if (msg) e[key] = msg;
  };
  put(
    "asFoundTotalizer",
    checkDigits("As found totalizer", f.asFoundTotalizer, 10),
  );
  put(
    "asFoundSpanCoefficient",
    checkDigits("As found span coefficient", f.asFoundSpanCoefficient, 8),
  );
  put(
    "asFoundZeroValue",
    checkDigits("As found zero value", f.asFoundZeroValue, 5),
  );
  put(
    "asFoundSpeedCoefficient",
    checkDigits("As found speed coefficient", f.asFoundSpeedCoefficient, 6),
  );
  put(
    "asFoundMaxTph",
    checkDecimal2("Max running tph", f.asFoundMaxTph, false),
  );
  put(
    "asFoundMinTph",
    checkDecimal2("Min running tph", f.asFoundMinTph, false),
  );
  put(
    "asFoundRunningSpeed",
    checkDecimal2("Running speed", f.asFoundRunningSpeed, false),
  );

  needAnswer(e, "partsAttached", "All parts still attached", f.partsAttached);
  needAnswer(
    e,
    "weighframeClean",
    "Weighframe free of dirt",
    f.weighframeClean,
  );
  needAnswer(
    e,
    "integratorPanelClean",
    "Integrator panel free of dirt and water",
    f.integratorPanelClean,
  );
  needAnswer(
    e,
    "weighframeMovesFreely",
    "Weighframe moves freely",
    f.weighframeMovesFreely,
  );
  needAnswer(
    e,
    "torsionRodsMoveFreely",
    "Torsion rods move freely",
    f.torsionRodsMoveFreely,
  );
  needAnswer(e, "rollersTurning", "Rollers turning smoothly", f.rollersTurning);
  needAnswer(e, "beltTracking", "Belt tracking properly", f.beltTracking);
  needAnswer(
    e,
    "integratorOk",
    "Integrator in good working order",
    f.integratorOk,
  );
  needAnswer(
    e,
    "speedSensorOk",
    "Speed sensor in good working order",
    f.speedSensorOk,
  );

  if (!f.photos.speedSensor)
    e["photos.speedSensor"] = "Photo of the speed sensor is required";
  if (!f.photos.integratorPanel)
    e["photos.integratorPanel"] = "Photo of the integrator panel is required";
  const n = f.photos.scale.length;
  if (n < SCALE_PHOTOS_MIN)
    e["photos.scale"] =
      `Add at least ${SCALE_PHOTOS_MIN} photos of the scale (you have ${n})`;
  if (n > SCALE_PHOTOS_MAX)
    e["photos.scale"] = `At most ${SCALE_PHOTOS_MAX} photos of the scale`;
  return finish(e);
}

// ---------------------------------------------------------------------- zero
export function validateZero(f: ZeroForm): Validation {
  const e: Errors = {};
  const m = checkDigits("New zero value", f.newZeroValue, 5);
  if (m) e.newZeroValue = m;
  if (!f.photos.zero) e["photos.zero"] = "Zero calibration photo is required";
  return finish(e);
}

// ---------------------------------------------------------------------- span
export interface SpanCalc {
  indicatedActual: number;
  adjustmentRatio: number;
  newPotentialSpan: number;
}

/** The span calculation, identical to the web app's and the spec sheet's. */
export function calcSpan(
  offset: number,
  actual: number,
  indicated: number,
  latestSpan: number,
  latestZero: number,
): SpanCalc {
  const indicatedActual = offset + actual;
  const adjustmentRatio = (indicatedActual - indicated) / (indicated - offset);
  const newPotentialSpan =
    (latestSpan - latestZero) * adjustmentRatio + latestZero;
  return { indicatedActual, adjustmentRatio, newPotentialSpan };
}

/** The zero and span to calculate with: the saved ones for the scale, or what the technician typed in. */
export function resolveBaseline(
  baseline:
    | { latestZero: string | null; latestSpan: string | null }
    | null
    | undefined,
  f: Pick<SpanForm, "manualLatestZero" | "manualLatestSpan">,
): { zero: string; span: string; manual: boolean } {
  const zero = baseline?.latestZero ?? f.manualLatestZero.trim();
  const span = baseline?.latestSpan ?? f.manualLatestSpan.trim();
  return { zero, span, manual: !baseline?.latestZero || !baseline?.latestSpan };
}

export function validateSpan(
  f: SpanForm,
  baseline:
    | { latestZero: string | null; latestSpan: string | null }
    | null
    | undefined,
): Validation {
  const e: Errors = {};
  const put = (key: string, msg: string | null) => {
    if (msg) e[key] = msg;
  };
  put("offset", checkDecimal2("Offset", f.offset));
  put("actual", checkDecimal2("Actual", f.actual));
  put("indicated", checkDecimal2("Indicated", f.indicated));
  if (
    !e.offset &&
    !e.indicated &&
    toNumber(f.indicated) === toNumber(f.offset)
  ) {
    e.indicated = "Indicated must be different from Offset";
  }
  if (!baseline?.latestZero)
    put("manualLatestZero", checkDigits("Latest zero", f.manualLatestZero, 5));
  if (!baseline?.latestSpan)
    put("manualLatestSpan", checkDigits("Latest span", f.manualLatestSpan, 8));
  needAnswer(e, "spanAdjusted", "Span adjusted", f.spanAdjusted);
  put("newSpan", checkDigits("New span", f.newSpan, 8));
  if (!f.photos.offset) e["photos.offset"] = "Offset photo is required";
  if (!f.photos.actual) e["photos.actual"] = "Actual photo is required";
  if (!f.photos.indicated)
    e["photos.indicated"] = "Indicated photo is required";
  return finish(e);
}

/** The live calculation shown on the Span form, or null while the numbers cannot be calculated yet. */
export function liveSpanCalc(
  f: SpanForm,
  baseline:
    | { latestZero: string | null; latestSpan: string | null }
    | null
    | undefined,
): SpanCalc | null {
  if (
    checkDecimal2("", f.offset) ||
    checkDecimal2("", f.actual) ||
    checkDecimal2("", f.indicated)
  )
    return null;
  const { zero, span } = resolveBaseline(baseline, f);
  if (checkDigits("", zero, 5) || checkDigits("", span, 8)) return null;
  const offset = toNumber(f.offset);
  const indicated = toNumber(f.indicated);
  if (indicated === offset) return null;
  return calcSpan(
    offset,
    toNumber(f.actual),
    indicated,
    Number(span),
    Number(zero),
  );
}

// ------------------------------------------------- empty forms and payloads
export const emptyInspection = (): InspectionForm => ({
  asFoundTotalizer: "",
  asFoundSpanCoefficient: "",
  asFoundZeroValue: "",
  asFoundSpeedCoefficient: "",
  asFoundMaxTph: "",
  asFoundMinTph: "",
  asFoundRunningSpeed: "",
  partsAttached: null,
  weighframeClean: null,
  integratorPanelClean: null,
  weighframeMovesFreely: null,
  torsionRodsMoveFreely: null,
  rollersTurning: null,
  beltTracking: null,
  integratorOk: null,
  speedSensorOk: null,
  photos: { speedSensor: null, integratorPanel: null, scale: [] },
});
export const emptyZero = (): ZeroForm => ({
  newZeroValue: "",
  photos: { zero: null },
});
export const emptySpan = (): SpanForm => ({
  offset: "",
  actual: "",
  indicated: "",
  manualLatestZero: "",
  manualLatestSpan: "",
  spanAdjusted: null,
  newSpan: "",
  photos: { offset: null, actual: null, indicated: null },
});
export const emptyForm = (type: WorkItemType) =>
  type === "INSPECTION"
    ? emptyInspection()
    : type === "ZERO_CALIBRATION"
      ? emptyZero()
      : emptySpan();

const num2 = (v: string): number | undefined =>
  v.trim() ? Math.round(toNumber(v) * 100) / 100 : undefined;

/** Readings and answers exactly as the web app and backend expect them (schemaVersion 1), without the photos. */
export function buildResult(
  type: WorkItemType,
  form: InspectionForm | ZeroForm | SpanForm,
  baseline:
    | { latestZero: string | null; latestSpan: string | null }
    | null
    | undefined,
): Record<string, unknown> {
  if (type === "INSPECTION") {
    const f = form as InspectionForm;
    return {
      asFoundTotalizer: f.asFoundTotalizer.trim(),
      asFoundSpanCoefficient: f.asFoundSpanCoefficient.trim(),
      asFoundZeroValue: f.asFoundZeroValue.trim(),
      asFoundSpeedCoefficient: f.asFoundSpeedCoefficient.trim(),
      asFoundMaxTph: num2(f.asFoundMaxTph),
      asFoundMinTph: num2(f.asFoundMinTph),
      asFoundRunningSpeed: num2(f.asFoundRunningSpeed),
      partsAttached: f.partsAttached,
      weighframeClean: f.weighframeClean,
      integratorPanelClean: f.integratorPanelClean,
      weighframeMovesFreely: f.weighframeMovesFreely,
      torsionRodsMoveFreely:
        f.torsionRodsMoveFreely === "NA" ? null : f.torsionRodsMoveFreely,
      rollersTurning: f.rollersTurning,
      beltTracking: f.beltTracking,
      integratorOk: f.integratorOk,
      speedSensorOk: f.speedSensorOk,
    };
  }
  if (type === "ZERO_CALIBRATION")
    return { newZeroValue: (form as ZeroForm).newZeroValue.trim() };

  const f = form as SpanForm;
  const { zero, span } = resolveBaseline(baseline, f);
  const calc = calcSpan(
    toNumber(f.offset),
    toNumber(f.actual),
    toNumber(f.indicated),
    Number(span),
    Number(zero),
  );
  return {
    offset: toNumber(f.offset),
    actual: toNumber(f.actual),
    indicated: toNumber(f.indicated),
    indicatedActual: round(calc.indicatedActual, 2),
    adjustmentRatio: round(calc.adjustmentRatio, 6),
    newPotentialSpan: round(calc.newPotentialSpan, 2),
    latestSpanUsed: Number(span),
    latestZeroUsed: Number(zero),
    spanAdjusted: f.spanAdjusted,
    newSpan: f.newSpan.trim(),
  };
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

/** The photos of a form, by the field names the web app and backend use. */
export function photosOf(
  type: WorkItemType,
  form: InspectionForm | ZeroForm | SpanForm,
): Record<string, string | string[]> {
  if (type === "INSPECTION") {
    const p = (form as InspectionForm).photos;
    return {
      speedSensor: p.speedSensor!,
      integratorPanel: p.integratorPanel!,
      scale: p.scale,
    };
  }
  if (type === "ZERO_CALIBRATION")
    return { zero: (form as ZeroForm).photos.zero! };
  const p = (form as SpanForm).photos;
  return { offset: p.offset!, actual: p.actual!, indicated: p.indicated! };
}

/** The baseline to remember for a scale, worked out from its latest saved results (newest first rules). */
export function computeBaseline(input: {
  zero?: { newZeroValue?: unknown } | null;
  span?: {
    spanAdjusted?: unknown;
    newSpan?: unknown;
    latestSpanUsed?: unknown;
  } | null;
  inspection?: {
    asFoundZeroValue?: unknown;
    asFoundSpanCoefficient?: unknown;
  } | null;
}): { latestZero: string | null; latestSpan: string | null } {
  const s = (v: unknown) =>
    v === null || v === undefined || v === "" ? null : String(v);
  const spanFromSpan = input.span
    ? input.span.spanAdjusted === true
      ? s(input.span.newSpan)
      : s(input.span.latestSpanUsed)
    : null;
  return {
    latestZero:
      s(input.zero?.newZeroValue) ?? s(input.inspection?.asFoundZeroValue),
    latestSpan: spanFromSpan ?? s(input.inspection?.asFoundSpanCoefficient),
  };
}
