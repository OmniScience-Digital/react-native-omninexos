// components/jobcards/ui.tsx
// Themed building blocks for the Job Cards screens. Same measurements as the app's other forms
// (13-14px text, 8-12px radii, small Yes/No buttons); only the touch areas are a little generous for outdoor use.
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
/** Medium weight: the app's normal "emphasis". Nothing in the job card screens is heavier than semibold. */
export const MED = { fontFamily: "sans-medium" } as const;

export function Card({
  children,
  onPress,
  accessibilityLabel,
  tinted,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** A soft filled box with no border, for use inside another card */
  tinted?: boolean;
}) {
  const { theme } = useTheme();
  const style = [
    styles.card,
    tinted
      ? {
          backgroundColor: theme.colors.background,
          borderWidth: 0,
          borderRadius: 12,
        }
      : {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
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
    <View style={[styles.chip, { backgroundColor: color + "1F" }]}>
      <ThemedText style={[MED, { fontSize: 11, color }]}>{label}</ThemedText>
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
        <ThemedText
          weight="600"
          style={{ fontSize: 15, color: theme.colors.primaryText }}
        >
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
      <ThemedText style={[MED, { fontSize: 14 }]}>{title}</ThemedText>
    </Pressable>
  );
}

/** A titled card that holds a group of fields. */
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <ThemedText style={[MED, { fontSize: 14 }]}>{title}</ThemedText>
      <View style={{ gap: 16 }}>{children}</View>
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
      <ThemedText style={[MED, { fontSize: 13 }]}>{label}</ThemedText>
      {children}
      {!!hint && !error && (
        <ThemedText muted style={{ fontSize: 12 }}>
          {hint}
        </ThemedText>
      )}
      {!!error && (
        <ThemedText style={{ fontSize: 12, color: DANGER }}>{error}</ThemedText>
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
  const editable = props.editable ?? true;
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
        editable={editable}
        accessibilityLabel={props.label}
        style={[
          styles.input,
          {
            color: theme.colors.text,
            backgroundColor: editable
              ? theme.colors.card
              : theme.colors.background,
            borderColor: props.error ? DANGER : theme.colors.border,
          },
        ]}
      />
    </Field>
  );
}

/** Yes / No (and optionally N/A): the question on the left, small buttons on the right, like the vehicle inspection form. */
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
  const activeBg = (v: boolean | "NA") =>
    v === true
      ? theme.colors.primary
      : v === false
        ? DANGER
        : theme.colors.border;
  const activeText = (v: boolean | "NA") =>
    v === "NA" ? theme.colors.text : theme.colors.primaryText;
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.ynRow}>
        <ThemedText style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
          {props.label}
        </ThemedText>
        <View style={styles.ynButtons}>
          {options.map((o) => {
            const active = props.value === o.value;
            return (
              <Pressable
                key={o.label}
                testID={props.testID ? `${props.testID}-${o.label}` : undefined}
                disabled={props.editable === false}
                onPress={() => props.onChange(o.value)}
                hitSlop={4}
                accessibilityRole="radio"
                accessibilityLabel={`${props.label}: ${o.label}`}
                accessibilityState={{ selected: active }}
                style={[
                  styles.yn,
                  {
                    backgroundColor: active
                      ? activeBg(o.value)
                      : theme.colors.card,
                    borderColor: active
                      ? activeBg(o.value)
                      : props.error
                        ? DANGER
                        : theme.colors.border,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    MED,
                    {
                      fontSize: 13,
                      color: active
                        ? activeText(o.value)
                        : theme.colors.textMuted,
                    },
                  ]}
                >
                  {o.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
      {!!props.error && (
        <ThemedText style={{ fontSize: 12, color: DANGER }}>
          {props.error}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  section: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 14 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  button: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 8,
  },
  secondary: { borderWidth: 1, minHeight: 40, borderRadius: 10 },
  input: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: "sans-regular",
  },
  ynRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  ynButtons: { flexDirection: "row", gap: 6 },
  yn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 48,
    alignItems: "center",
  },
});
