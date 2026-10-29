// components/jobcards/AddScaleSheet.tsx
import { ThemedText } from "@/components/screens/screen";
import { useTheme } from "@/src/contexts/theme-context";
import { addScale } from "@/src/jobcards/controller";
import { WORK_ITEM_LABEL, type WorkItemType } from "@/src/jobcards/types";
import { Check, ChevronDown } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { MED, PrimaryButton, SecondaryButton, TextField } from "./ui";

type IconType = React.ComponentType<{ size?: number; color?: string }>;
const asIcon = (c: unknown) => c as IconType;
const IChevronDown = asIcon(ChevronDown);
const ICheck = asIcon(Check);

// Canonical order: the work is always created and shown in this order.
const ALL_TYPES: WorkItemType[] = [
  "INSPECTION",
  "ZERO_CALIBRATION",
  "SPAN_CALIBRATION",
];

export default function AddScaleSheet({
  visible,
  jobCardId,
  jcNumber,
  onClose,
}: {
  visible: boolean;
  jobCardId: string;
  jcNumber: string;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const colors = theme.colors;
  const [name, setName] = useState("");
  const [types, setTypes] = useState<WorkItemType[]>(ALL_TYPES);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [typesError, setTypesError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const close = () => {
    setName("");
    setTypes(ALL_TYPES);
    setOpen(false);
    setError(undefined);
    setTypesError(undefined);
    onClose();
  };

  const toggle = (t: WorkItemType) => {
    setTypesError(undefined);
    setTypes((cur) =>
      ALL_TYPES.filter((x) => (x === t ? !cur.includes(x) : cur.includes(x))),
    );
  };

  const summary =
    types.length === 0
      ? "Select the work to do"
      : types.length === ALL_TYPES.length
        ? "All work"
        : types.map((t) => WORK_ITEM_LABEL[t]).join(", ");

  const save = async () => {
    if (!name.trim()) {
      setError("Enter the scale name");
      return;
    }
    if (types.length === 0) {
      setTypesError("Select at least one type of work");
      return;
    }
    setSaving(true);
    try {
      await addScale({
        jobCardId,
        scaleName: name,
        // the scope of work is the chosen work, written out so the office and the scale card still show it
        scopeOfWork: types.map((t) => WORK_ITEM_LABEL[t]).join(", "),
        moduleTypes: types,
      });
      close();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not add the scale. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior="padding" // Android is edge-to-edge: the system no longer resizes the window for the keyboard
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.45)",
        }}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={close}
          accessibilityLabel="Close"
        />
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "85%",
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 16 }}
          >
            <View>
              <ThemedText style={[MED, { fontSize: 17 }]}>
                Add a scale
              </ThemedText>
              <ThemedText muted style={{ fontSize: 13, marginTop: 2 }}>
                To {jcNumber}. Choose the work to do on this scale.
              </ThemedText>
            </View>

            <TextField
              label="Scale name"
              value={name}
              onChange={(v) => {
                setName(v);
                setError(undefined);
              }}
              placeholder="e.g. Belt scale 3"
              error={error}
              testID="add-scale-name"
            />

            {/* Scope of work: drop-down of the work types */}
            <View style={{ gap: 6 }}>
              <ThemedText muted style={[MED, { fontSize: 13 }]}>
                Scope of work
              </ThemedText>
              <Pressable
                onPress={() => setOpen((o) => !o)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel="Scope of work"
                testID="add-scale-scope"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  minHeight: 48,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: typesError
                    ? "#DC2626"
                    : open
                      ? colors.primary
                      : colors.border,
                  backgroundColor: colors.background,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <ThemedText
                  style={{
                    flex: 1,
                    fontSize: 15,
                    color: types.length ? colors.text : colors.textMuted,
                  }}
                  numberOfLines={1}
                >
                  {summary}
                </ThemedText>
                <View
                  style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
                >
                  <IChevronDown size={18} color={colors.textMuted} />
                </View>
              </Pressable>

              {open && (
                <View
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    overflow: "hidden",
                  }}
                >
                  {ALL_TYPES.map((t, i) => {
                    const on = types.includes(t);
                    return (
                      <Pressable
                        key={t}
                        onPress={() => toggle(t)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        testID={`scope-${t}`}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          paddingHorizontal: 14,
                          paddingVertical: 13,
                          borderTopWidth: i === 0 ? 0 : 0.5,
                          borderTopColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 6,
                            borderWidth: 1.5,
                            alignItems: "center",
                            justifyContent: "center",
                            borderColor: on ? colors.primary : colors.border,
                            backgroundColor: on
                              ? colors.primary
                              : "transparent",
                          }}
                        >
                          {on && (
                            <ICheck size={13} color={colors.primaryText} />
                          )}
                        </View>
                        <ThemedText style={{ flex: 1, fontSize: 15 }}>
                          {WORK_ITEM_LABEL[t]}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {!!typesError && (
                <ThemedText style={{ fontSize: 12, color: "#DC2626" }}>
                  {typesError}
                </ThemedText>
              )}
            </View>

            <View style={{ gap: 10 }}>
              <PrimaryButton
                title="Add scale"
                onPress={() => void save()}
                loading={saving}
              />
              <SecondaryButton
                title="Cancel"
                onPress={close}
                disabled={saving}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
