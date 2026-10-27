// src/jobcards/submission.ts
// Turns a filled-in form into the outbox record. Pure: validation, the result, the photo list and the ids/times are
// all decided here, so it can be tested without a phone.
import {
  buildResult,
  photosOf,
  validateInspection,
  validateSpan,
  validateZero,
  type Errors,
} from "./rules";
import type {
  InspectionForm,
  SpanForm,
  SubmitResultPayload,
  WorkItemType,
  ZeroForm,
} from "./types";

export type PrepareResult =
  | { ok: false; errors: Errors }
  | { ok: true; id: string; payload: SubmitResultPayload; submittedAt: string };

export function prepareSubmission(args: {
  item: { id: string; scaleId: string; moduleType: WorkItemType };
  form: InspectionForm | ZeroForm | SpanForm;
  baseline:
    | { latestZero: string | null; latestSpan: string | null }
    | null
    | undefined;
  userSub: string;
  nowIso: string;
  newId: () => string;
  userName?: string;
  /** Set when finished work is being edited: this goes out as a NEW result that points at the one before it. */
  edit?: { revision: number; editOf: string };
}): PrepareResult {
  const { item, form, baseline } = args;
  const v =
    item.moduleType === "INSPECTION"
      ? validateInspection(form as InspectionForm)
      : item.moduleType === "ZERO_CALIBRATION"
        ? validateZero(form as ZeroForm)
        : validateSpan(form as SpanForm, baseline);
  if (!v.ok) return { ok: false, errors: v.errors };

  return {
    ok: true,
    id: args.newId(),
    submittedAt: args.nowIso,
    payload: {
      workItemId: item.id,
      scaleId: item.scaleId,
      moduleType: item.moduleType,
      submittedAt: args.nowIso,
      submittedBy: args.userSub,
      result: {
        ...buildResult(item.moduleType, form, baseline),
        ...(args.userName ? { submittedByName: args.userName } : {}),
        ...(args.edit
          ? { revision: args.edit.revision, editOf: args.edit.editOf }
          : {}),
      },
      photos: photosOf(item.moduleType, form),
      uploaded: {},
    },
  };
}
