// src/jobcards/remote.ts
// Finished work that was done by someone else (or earlier) is on the server, not on this phone. To let a technician
// correct it, the phone builds the form back from the saved result. Its photos are already on the server, so they are
// kept as "remote:<storage key>": they are shown as "Sent", are not uploaded again, and a correction that keeps them
// points at the same saved photos. Pure.
import type {
    AnyForm,
    InspectionForm,
    SpanForm,
    WorkItemType,
    YesNo,
    ZeroForm,
} from "./types";

export const REMOTE_PREFIX = "remote:";
export const isRemotePhoto = (uri: string): boolean =>
  uri.startsWith(REMOTE_PREFIX);
export const remoteKeyOf = (uri: string): string =>
  uri.slice(REMOTE_PREFIX.length);

const str = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v);
const key = (v: unknown): string | null =>
  typeof v === "string" && v ? REMOTE_PREFIX + v : null;
const keys = (v: unknown): string[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string" && !!x)
        .map((x) => REMOTE_PREFIX + x)
    : [];
// a saved answer is true or false; anything else is "not answered"
const yn = (v: unknown): YesNo => (typeof v === "boolean" ? v : null);

/** Rebuild the form from a saved result (the payload the phone sent: readings, answers and photo storage keys). */
export function formFromResult(
  type: WorkItemType,
  payload: Record<string, unknown>,
): AnyForm {
  const photos = (payload.photos ?? {}) as Record<string, unknown>;
  if (type === "INSPECTION") {
    const f: InspectionForm = {
      asFoundTotalizer: str(payload.asFoundTotalizer),
      asFoundSpanCoefficient: str(payload.asFoundSpanCoefficient),
      asFoundZeroValue: str(payload.asFoundZeroValue),
      asFoundSpeedCoefficient: str(payload.asFoundSpeedCoefficient),
      asFoundMaxTph: str(payload.asFoundMaxTph),
      asFoundMinTph: str(payload.asFoundMinTph),
      asFoundRunningSpeed: str(payload.asFoundRunningSpeed),
      partsAttached: yn(payload.partsAttached),
      weighframeClean: yn(payload.weighframeClean),
      integratorPanelClean: yn(payload.integratorPanelClean),
      weighframeMovesFreely: yn(payload.weighframeMovesFreely),
      // not applicable is saved as null
      torsionRodsMoveFreely:
        payload.torsionRodsMoveFreely === null ||
        payload.torsionRodsMoveFreely === undefined
          ? "NA"
          : yn(payload.torsionRodsMoveFreely),
      rollersTurning: yn(payload.rollersTurning),
      beltTracking: yn(payload.beltTracking),
      integratorOk: yn(payload.integratorOk),
      speedSensorOk: yn(payload.speedSensorOk),
      photos: {
        speedSensor: key(photos.speedSensor),
        integratorPanel: key(photos.integratorPanel),
        scale: keys(photos.scale),
      },
    };
    return f;
  }
  if (type === "ZERO_CALIBRATION") {
    const f: ZeroForm = {
      newZeroValue: str(payload.newZeroValue),
      photos: { zero: key(photos.zero) },
    };
    return f;
  }
  const f: SpanForm = {
    offset: str(payload.offset),
    actual: str(payload.actual),
    indicated: str(payload.indicated),
    // the zero and span this result was worked out from
    manualLatestZero: str(payload.latestZeroUsed),
    manualLatestSpan: str(payload.latestSpanUsed),
    spanAdjusted: yn(payload.spanAdjusted),
    newSpan: str(payload.newSpan),
    photos: {
      offset: key(photos.offset),
      actual: key(photos.actual),
      indicated: key(photos.indicated),
    },
  };
  return f;
}
