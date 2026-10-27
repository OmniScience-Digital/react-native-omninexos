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
  status: string;
  closedAt?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  assignedAt?: string | null;
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

export interface WorkItemView extends CachedWorkItem {
  jcNumber: string;
  customerName?: string | null;
  jobCardStatus: string;
  jobCardClosedAt?: string | null;
  jcTitle?: string | null;
  jobCardAssignedTo?: string | null;
  jobCardAssignedToEmail?: string | null;
  scaleName: string;
  scopeOfWork?: string | null;
}

export interface ScaleBaseline {
  scaleId: string;
  latestZero: string | null;
  latestSpan: string | null;
  updatedAt: string;
}

export type OutboxKind =
  | "submit-result"
  | "start-time"
  | "end-time"
  | "add-scale";
export type OutboxStatus = "pending" | "syncing" | "done" | "blocked";

export interface OutboxRow {
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

export type YesNo = boolean | null;

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

export interface SubmitResultPayload {
  workItemId: string;
  scaleId: string;
  moduleType: WorkItemType;
  submittedAt: string;
  submittedBy: string;
  result: Record<string, unknown>;
  photos: Record<string, string | string[]>;
  uploaded: Record<string, string>;
}

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

export interface EndTimePayload {
  sessionId: string;
  startedAt: string;
  endedAt: string;
}

export interface StartTimePayload {
  sessionId?: string;
  userSub: string;
  userName: string;
  userEmail?: string;
  startedAt: string;
}
