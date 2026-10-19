// components/jobcards/forms/InspectionForm.tsx
import {
    SCALE_PHOTOS_MAX,
    SCALE_PHOTOS_MIN,
    type Errors,
} from "@/src/jobcards/rules";
import type { InspectionForm as Form } from "@/src/jobcards/types";
import { View } from "react-native";
import { PhotoField, PhotoListField } from "../PhotoFields";
import { Section, TextField, YesNoField } from "../ui";

type YesNoKey =
  | "partsAttached"
  | "weighframeClean"
  | "integratorPanelClean"
  | "weighframeMovesFreely"
  | "rollersTurning"
  | "beltTracking"
  | "integratorOk"
  | "speedSensorOk";
const CHECKS: { key: YesNoKey; label: string }[] = [
  { key: "partsAttached", label: "Are all parts still attached to the scale?" },
  { key: "weighframeClean", label: "Is the weighframe free of dirt?" },
  {
    key: "integratorPanelClean",
    label: "Is the integrator panel free of dirt and water?",
  },
  { key: "weighframeMovesFreely", label: "Does the weighframe move freely?" },
];
const CHECKS_AFTER: { key: YesNoKey; label: string }[] = [
  {
    key: "rollersTurning",
    label: "Are all rollers turning smoothly on an empty belt?",
  },
  {
    key: "beltTracking",
    label: "Is the belt tracking properly over the scale area?",
  },
  { key: "integratorOk", label: "Is the integrator in good working order?" },
  { key: "speedSensorOk", label: "Is the speed sensor in good working order?" },
];

export default function InspectionForm({
  form,
  onChange,
  errors,
  workItemId,
  editable,
}: {
  form: Form;
  onChange: (f: Form) => void;
  errors: Errors;
  workItemId: string;
  editable: boolean;
}) {
  const set = (patch: Partial<Form>) => onChange({ ...form, ...patch });
  const yn = (c: { key: YesNoKey; label: string }) => (
    <YesNoField
      key={c.key}
      testID={c.key}
      label={c.label}
      value={form[c.key]}
      editable={editable}
      onChange={(v) => set({ [c.key]: v === "NA" ? null : v } as Partial<Form>)}
      error={errors[c.key]}
    />
  );
  return (
    <View style={{ gap: 22 }}>
      <Section title="As found readings">
        <TextField
          testID="asFoundTotalizer"
          label="As found totalizer (tons)"
          kind="digits"
          maxLength={10}
          value={form.asFoundTotalizer}
          editable={editable}
          onChange={(v) => set({ asFoundTotalizer: v })}
          error={errors.asFoundTotalizer}
          hint="Up to 10 digits"
        />
        <TextField
          testID="asFoundSpanCoefficient"
          label="As found span coefficient (points)"
          kind="digits"
          maxLength={8}
          value={form.asFoundSpanCoefficient}
          editable={editable}
          onChange={(v) => set({ asFoundSpanCoefficient: v })}
          error={errors.asFoundSpanCoefficient}
          hint="Up to 8 digits"
        />
        <TextField
          testID="asFoundZeroValue"
          label="As found zero value (points)"
          kind="digits"
          maxLength={5}
          value={form.asFoundZeroValue}
          editable={editable}
          onChange={(v) => set({ asFoundZeroValue: v })}
          error={errors.asFoundZeroValue}
          hint="Up to 5 digits"
        />
        <TextField
          testID="asFoundSpeedCoefficient"
          label="As found speed coefficient (points)"
          kind="digits"
          maxLength={6}
          value={form.asFoundSpeedCoefficient}
          editable={editable}
          onChange={(v) => set({ asFoundSpeedCoefficient: v })}
          error={errors.asFoundSpeedCoefficient}
          hint="Up to 6 digits"
        />
        <TextField
          label="As found max running (tph), optional"
          kind="decimal"
          value={form.asFoundMaxTph}
          editable={editable}
          onChange={(v) => set({ asFoundMaxTph: v })}
          error={errors.asFoundMaxTph}
        />
        <TextField
          label="As found min running (tph), optional"
          kind="decimal"
          value={form.asFoundMinTph}
          editable={editable}
          onChange={(v) => set({ asFoundMinTph: v })}
          error={errors.asFoundMinTph}
        />
        <TextField
          label="As found running speed (m/s), optional"
          kind="decimal"
          value={form.asFoundRunningSpeed}
          editable={editable}
          onChange={(v) => set({ asFoundRunningSpeed: v })}
          error={errors.asFoundRunningSpeed}
        />
      </Section>

      <Section title="Checks">
        {CHECKS.map(yn)}
        <YesNoField
          testID="torsionRodsMoveFreely"
          label="Do the torsion rods move freely?"
          allowNA
          value={form.torsionRodsMoveFreely}
          editable={editable}
          onChange={(v) => set({ torsionRodsMoveFreely: v })}
          error={errors.torsionRodsMoveFreely}
        />
        {CHECKS_AFTER.map(yn)}
      </Section>

      <Section title="Photos">
        <PhotoField
          label="Photo of the speed sensor"
          uri={form.photos.speedSensor}
          workItemId={workItemId}
          editable={editable}
          onChange={(u) => set({ photos: { ...form.photos, speedSensor: u } })}
          error={errors["photos.speedSensor"]}
        />
        <PhotoField
          label="Photo of the integrator panel"
          uri={form.photos.integratorPanel}
          workItemId={workItemId}
          editable={editable}
          onChange={(u) =>
            set({ photos: { ...form.photos, integratorPanel: u } })
          }
          error={errors["photos.integratorPanel"]}
        />
        <PhotoListField
          label="Photos of the scale"
          uris={form.photos.scale}
          workItemId={workItemId}
          editable={editable}
          min={SCALE_PHOTOS_MIN}
          max={SCALE_PHOTOS_MAX}
          onChange={(scale) => set({ photos: { ...form.photos, scale } })}
          error={errors["photos.scale"]}
        />
      </Section>
    </View>
  );
}
