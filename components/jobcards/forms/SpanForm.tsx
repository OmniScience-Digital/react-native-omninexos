// components/jobcards/forms/SpanForm.tsx
import { ThemedText } from "@/components/screens/screen";
import { useTheme } from "@/src/contexts/theme-context";
import {
  liveSpanCalc,
  resolveBaseline,
  type Errors,
} from "@/src/jobcards/rules";
import type { SpanForm as Form, ScaleBaseline } from "@/src/jobcards/types";
import { View } from "react-native";
import { PhotoField } from "../PhotoFields";
import { Card, Chip, MED, Section, TextField, YesNoField } from "../ui";

const fmt = (n: number, dp = 2) => (Number.isFinite(n) ? n.toFixed(dp) : "-");

export default function SpanForm({
  form,
  onChange,
  errors,
  workItemId,
  baseline,
  editable,
}: {
  form: Form;
  onChange: (f: Form) => void;
  errors: Errors;
  workItemId: string;
  baseline: ScaleBaseline | null;
  editable: boolean;
}) {
  const { theme } = useTheme();
  const set = (patch: Partial<Form>) => onChange({ ...form, ...patch });
  const setPhoto = (k: keyof Form["photos"], v: string | null) =>
    onChange({ ...form, photos: { ...form.photos, [k]: v } });
  const base = resolveBaseline(baseline, form);
  const calc = liveSpanCalc(form, baseline);
  const needManual = !baseline?.latestZero || !baseline?.latestSpan;

  return (
    <Section title="Span calibration">
      {needManual ? (
        <Card tinted>
          <Chip
            tone="warning"
            label="No earlier zero or span saved for this scale"
          />
          <ThemedText muted variant="small">
            Enter the current zero and span from the integrator so the span can
            be calculated.
          </ThemedText>
          {!baseline?.latestZero && (
            <TextField
              testID="manualLatestZero"
              label="Current zero (points)"
              kind="digits"
              maxLength={5}
              value={form.manualLatestZero}
              onChange={(v) => set({ manualLatestZero: v })}
              error={errors.manualLatestZero}
              editable={editable}
              hint="Exactly 5 digits"
            />
          )}
          {!baseline?.latestSpan && (
            <TextField
              testID="manualLatestSpan"
              label="Current span (points)"
              kind="digits"
              maxLength={8}
              value={form.manualLatestSpan}
              onChange={(v) => set({ manualLatestSpan: v })}
              error={errors.manualLatestSpan}
              editable={editable}
              hint="Exactly 8 digits"
            />
          )}
        </Card>
      ) : (
        <ThemedText muted variant="small">
          Using the saved zero {base.zero} and span {base.span} for this scale.
        </ThemedText>
      )}

      <TextField
        testID="offset"
        label="Offset (kg/m)"
        kind="decimal"
        value={form.offset}
        onChange={(v) => set({ offset: v })}
        error={errors.offset}
        editable={editable}
        hint="Up to 2 decimals"
      />
      <PhotoField
        label="Offset photo"
        uri={form.photos.offset}
        workItemId={workItemId}
        editable={editable}
        onChange={(u) => setPhoto("offset", u)}
        error={errors["photos.offset"]}
      />
      <TextField
        testID="actual"
        label="Actual (kg/m)"
        kind="decimal"
        value={form.actual}
        onChange={(v) => set({ actual: v })}
        error={errors.actual}
        editable={editable}
      />
      <PhotoField
        label="Actual photo"
        uri={form.photos.actual}
        workItemId={workItemId}
        editable={editable}
        onChange={(u) => setPhoto("actual", u)}
        error={errors["photos.actual"]}
      />
      <TextField
        testID="indicated"
        label="Indicated (kg/m)"
        kind="decimal"
        value={form.indicated}
        onChange={(v) => set({ indicated: v })}
        error={errors.indicated}
        editable={editable}
      />
      <PhotoField
        label="Indicated photo"
        uri={form.photos.indicated}
        workItemId={workItemId}
        editable={editable}
        onChange={(u) => setPhoto("indicated", u)}
        error={errors["photos.indicated"]}
      />

      {/* Worked out as the numbers are typed, like the integrator would */}
      <View
        style={{
          borderRadius: 12,
          padding: 12,
          gap: 4,
          backgroundColor: theme.colors.background,
        }}
        testID="span-calc"
      >
        <ThemedText style={[MED, { fontSize: 13 }]}>Calculation</ThemedText>
        {calc ? (
          <>
            <ThemedText muted variant="small">
              Indicated actual: {fmt(calc.indicatedActual)} kg/m
            </ThemedText>
            <ThemedText muted variant="small">
              Adjustment required: {fmt(calc.adjustmentRatio * 100)} %
            </ThemedText>
            <ThemedText style={[MED, { fontSize: 14 }]}>
              New potential span: {fmt(calc.newPotentialSpan)} points
            </ThemedText>
          </>
        ) : (
          <ThemedText muted variant="small">
            Fill in offset, actual and indicated to see the calculation.
          </ThemedText>
        )}
      </View>

      <YesNoField
        testID="spanAdjusted"
        label="Span adjusted"
        value={form.spanAdjusted}
        onChange={(v) => set({ spanAdjusted: v === "NA" ? null : v })}
        error={errors.spanAdjusted}
        editable={editable}
      />
      <TextField
        testID="newSpan"
        label="New span (points)"
        kind="digits"
        maxLength={8}
        value={form.newSpan}
        onChange={(v) => set({ newSpan: v })}
        error={errors.newSpan}
        editable={editable}
        hint="Exactly 8 digits"
      />
    </Section>
  );
}
