// src/jobcards/types.ts
// Types for the Job Cards module (calibration work assigned to a technician, done offline, sent when there is signal).

export type WorkItemType =
  | "INSPECTION"
  | "ZERO_CALIBRATION"
  | "SPAN_CALIBRATION";

export const WORK_ITEM_LABEL: Record<WorkItemType, string> = {
  INSPECTION: "Inspection",
  ZERO_CALIBRATION: "Zero calibration",
  SPAN_CALIBRATION: "Span calibration",
};

/**
 * Where a work item is, from this phone's point of view:
 *  PENDING   - still to do
 *  QUEUED    - done and saved on the phone, waiting to be sent
 *  SUBMITTED - the server has the result
 */
export type LocalState = "PENDING" | "QUEUED" | "SUBMITTED";

export interface CachedJobCard {
  id: string;
  jcNumber: string;
  customerName?: string | null;
  title?: string | null;
  /** OPEN | CLOSED, as of the last refresh */
  status: string;
}

export interface CachedScale {
  id: string;
  jobCardId: string;
  scaleName: string;
  scopeOfWork?: string | null;
}

export interface CachedWorkItem {
  id: string;
  userSub: string;
  jobCardId: string;
  scaleId: string;
  moduleType: WorkItemType;
  sequence: number;
  localState: LocalState;
  assignedAt?: string | null;
  submittedAt?: string | null;
}

/** A work item with its job card and scale, as listed on the "My work" screen. */
export interface WorkItemView extends CachedWorkItem {
  jcNumber: string;
  customerName?: string | null;
  jobCardStatus: string;
  jcTitle?: string | null;
  scaleName: string;
  scopeOfWork?: string | null;
}

/** The latest zero and span saved for a scale. The span calculation needs them, so they are kept for offline use. */
export interface ScaleBaseline {
  scaleId: string;
  latestZero: string | null;
  latestSpan: string | null;
  updatedAt: string;
}

export type OutboxKind = "submit-result" | "start-time" | "add-scale";
/** pending: ready to send | syncing: being sent now | done: sent | blocked: needs attention (see last error) */
export type OutboxStatus = "pending" | "syncing" | "done" | "blocked";

export interface OutboxRow {
  /** The id the server will use for the record: generated on the phone, so a retry can never duplicate it. */
  id: string;
  kind: OutboxKind;
  workItemId: string | null;
  jobCardId: string;
  payload: string;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
}

// ---- the saved form (draft) and the payload sent to the server --------------

export type YesNo = boolean | null; // null = not answered yet

export interface InspectionForm {
  asFoundTotalizer: string;
  asFoundSpanCoefficient: string;
  asFoundZeroValue: string;
  asFoundSpeedCoefficient: string;
  asFoundMaxTph: string;
  asFoundMinTph: string;
  asFoundRunningSpeed: string;
  partsAttached: YesNo;
  weighframeClean: YesNo;
  integratorPanelClean: YesNo;
  weighframeMovesFreely: YesNo;
  /** "NA" = not applicable */
  torsionRodsMoveFreely: YesNo | "NA";
  rollersTurning: YesNo;
  beltTracking: YesNo;
  integratorOk: YesNo;
  speedSensorOk: YesNo;
  photos: {
    speedSensor: string | null;
    integratorPanel: string | null;
    scale: string[];
  };
}

export interface ZeroForm {
  newZeroValue: string;
  photos: { zero: string | null };
}

export interface SpanForm {
  offset: string;
  actual: string;
  indicated: string;
  /** Only used when no earlier zero/span is known for the scale: typed in by the technician. */
  manualLatestZero: string;
  manualLatestSpan: string;
  spanAdjusted: YesNo;
  newSpan: string;
  photos: {
    offset: string | null;
    actual: string | null;
    indicated: string | null;
  };
}

export type FormFor<T extends WorkItemType> = T extends "INSPECTION"
  ? InspectionForm
  : T extends "ZERO_CALIBRATION"
    ? ZeroForm
    : SpanForm;

export type AnyForm = InspectionForm | ZeroForm | SpanForm;

/** What goes into a "submit-result" outbox row. Photos hold local file paths until they are uploaded. */
export interface SubmitResultPayload {
  workItemId: string;
  scaleId: string;
  moduleType: WorkItemType;
  submittedAt: string;
  submittedBy: string;
  /** readings and answers, without the photos */
  result: Record<string, unknown>;
  /** photo field -> local path, or a list of local paths (scale photos) */
  photos: Record<string, string | string[]>;
  /** local path -> the storage key it was uploaded to (filled in as uploads finish) */
  uploaded: Record<string, string>;
}

/** A scale the technician added on the phone, with the work to do on it. Ids are made here so a retry never duplicates. */
export interface AddScalePayload {
  scaleId: string;
  jobCardId: string;
  scaleName: string;
  scopeOfWork: string | null;
  userSub: string;
  userName: string;
  addedAt: string;
  modules: { id: string; moduleType: WorkItemType }[];
}

export interface StartTimePayload {
  userSub: string;
  userName: string;
  startedAt: string;
}
