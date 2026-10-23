// components/jobcards/forms/ZeroForm.tsx
import type { Errors } from "@/src/jobcards/rules";
import type { ZeroForm as Form } from "@/src/jobcards/types";
import { PhotoField } from "../PhotoFields";
import { Section, TextField } from "../ui";

export default function ZeroForm({
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
  return (
    <Section title="Zero calibration">
      <TextField
        testID="newZeroValue"
        label="New zero value (points)"
        kind="digits"
        maxLength={5}
        value={form.newZeroValue}
        onChange={(v) => onChange({ ...form, newZeroValue: v })}
        error={errors.newZeroValue}
        editable={editable}
        hint="Exactly 5 digits"
      />
      <PhotoField
        label="Zero calibration photo"
        uri={form.photos.zero}
        workItemId={workItemId}
        editable={editable}
        onChange={(zero) => onChange({ ...form, photos: { zero } })}
        error={errors["photos.zero"]}
      />
    </Section>
  );
}
