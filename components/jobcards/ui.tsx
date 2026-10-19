// components/jobcards/ui.tsx
// Small themed building blocks for the Job Cards screens. Large touch targets: the work is done outdoors, often in gloves.
import { ThemedText } from "@/components/screens/screen";
import { useTheme } from "@/src/contexts/theme-context";
import type { ReactNode } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    TextInput,
    View,
    type KeyboardTypeOptions,
} from "react-native";

export const DANGER = "#DC2626";

export function Card({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { theme } = useTheme();
  const style = [
    styles.card,
    { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
  ];
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [...style, { opacity: pressed ? 0.8 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

export type Tone = "neutral" | "success" | "warning" | "info" | "danger";

export function Chip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: Tone;
}) {
  const { theme } = useTheme();
  const color =
    tone === "success"
      ? theme.colors.success
      : tone === "warning"
        ? theme.colors.warning
        : tone === "info"
          ? theme.colors.info
          : tone === "danger"
            ? DANGER
            : theme.colors.textMuted;
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: color + "22", borderColor: color + "55" },
      ]}
    >
      <ThemedText variant="small" weight="600" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { theme } = useTheme();
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.colors.primary,
          opacity: off ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.primaryText} />
      ) : (
        <ThemedText weight="700" style={{ color: theme.colors.primaryText }}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  title,
  onPress,
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        styles.secondary,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon}
      <ThemedText weight="600">{title}</ThemedText>
    </Pressable>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 10 }}>
      <ThemedText variant="h2" weight="700">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

/** A labelled field with an error line under it. */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <ThemedText weight="600">{label}</ThemedText>
      {children}
      {!!hint && !error && (
        <ThemedText muted variant="small">
          {hint}
        </ThemedText>
      )}
      {!!error && (
        <ThemedText variant="small" style={{ color: DANGER }}>
          {error}
        </ThemedText>
      )}
    </View>
  );
}

type Kind = "text" | "digits" | "decimal";
const KEYBOARD: Record<Kind, KeyboardTypeOptions> = {
  text: "default",
  digits: "number-pad",
  decimal: "numbers-and-punctuation",
};

/** Keep only what the field allows as the technician types. */
export function filterInput(value: string, kind: Kind): string {
  if (kind === "digits") return value.replace(/\D/g, "");
  if (kind === "decimal") return value.replace(/[^\d.,-]/g, "");
  return value;
}

export function TextField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  kind?: Kind;
  maxLength?: number;
  error?: string;
  hint?: string;
  placeholder?: string;
  editable?: boolean;
  testID?: string;
}) {
  const { theme } = useTheme();
  const kind = props.kind ?? "text";
  return (
    <Field label={props.label} error={props.error} hint={props.hint}>
      <TextInput
        testID={props.testID}
        value={props.value}
        onChangeText={(v) => props.onChange(filterInput(v, kind))}
        keyboardType={KEYBOARD[kind]}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        placeholderTextColor={theme.colors.textMuted}
        editable={props.editable ?? true}
        accessibilityLabel={props.label}
        style={[
          styles.input,
          {
            color: theme.colors.text,
            backgroundColor: theme.colors.card,
            borderColor: props.error ? DANGER : theme.colors.border,
          },
        ]}
      />
    </Field>
  );
}

/** Yes / No (and optionally N/A). `value` is null until answered. */
export function YesNoField<T extends boolean | null | "NA">(props: {
  label: string;
  value: T;
  onChange: (v: boolean | "NA") => void;
  error?: string;
  allowNA?: boolean;
  editable?: boolean;
  testID?: string;
}) {
  const { theme } = useTheme();
  const options: { label: string; value: boolean | "NA" }[] = [
    { label: "Yes", value: true },
    { label: "No", value: false },
    ...(props.allowNA ? [{ label: "N/A", value: "NA" as const }] : []),
  ];
  return (
    <Field label={props.label} error={props.error}>
      <View style={styles.segment}>
        {options.map((o) => {
          const active = props.value === o.value;
          return (
            <Pressable
              key={o.label}
              testID={props.testID ? `${props.testID}-${o.label}` : undefined}
              disabled={props.editable === false}
              onPress={() => props.onChange(o.value)}
              accessibilityRole="radio"
              accessibilityLabel={`${props.label}: ${o.label}`}
              accessibilityState={{ selected: active }}
              style={[
                styles.segmentItem,
                {
                  backgroundColor: active
                    ? theme.colors.primary
                    : theme.colors.card,
                  borderColor: active
                    ? theme.colors.primary
                    : theme.colors.border,
                },
              ]}
            >
              <ThemedText
                weight="600"
                style={{
                  color: active ? theme.colors.primaryText : theme.colors.text,
                }}
              >
                {o.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  button: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    flexDirection: "row",
    gap: 8,
  },
  secondary: { borderWidth: 1 },
  input: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  segment: { flexDirection: "row", gap: 8 },
  segmentItem: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
