// components/jobcards/WorkItemScreen.tsx
// One work item: the form for its type, saved as the technician types, and the "Submit" step that puts the finished
// result in the phone's outbox. Works fully offline.
import { ThemedText } from "@/components/screens/screen";
import { useTheme } from "@/src/contexts/theme-context";
import {
    loadWorkItem,
    noteWorkStarted,
    requestSync,
    saveDraft,
    submitWorkItem,
} from "@/src/jobcards/controller";
import { emptyForm, type Errors } from "@/src/jobcards/rules";
import {
    WORK_ITEM_LABEL,
    type AnyForm,
    type InspectionForm,
    type OutboxRow,
    type ScaleBaseline,
    type SpanForm,
    type WorkItemView,
    type ZeroForm,
} from "@/src/jobcards/types";
import { ArrowLeft, CheckCircle2, CloudOff } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import InspectionFormView from "./forms/InspectionForm";
import SpanFormView from "./forms/SpanForm";
import ZeroFormView from "./forms/ZeroForm";
import { Card, Chip, DANGER, PrimaryButton } from "./ui";

const IBack = ArrowLeft as React.ComponentType<{
  size?: number;
  color?: string;
}>;
const ICheck = CheckCircle2 as React.ComponentType<{
  size?: number;
  color?: string;
}>;
const ICloud = CloudOff as React.ComponentType<{
  size?: number;
  color?: string;
}>;

const AUTOSAVE_MS = 500;

interface Loaded {
  item: WorkItemView;
  baseline: ScaleBaseline | null;
  outbox: OutboxRow | null;
}

export default function WorkItemScreen({
  workItemId,
  onBack,
}: {
  workItemId: string;
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [missing, setMissing] = useState(false);
  const [form, setForm] = useState<AnyForm | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const formRef = useRef<AnyForm | null>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editableRef = useRef(false);

  // load the work item, and the half-finished form if there is one
  useEffect(() => {
    let cancelled = false;
    // A push notification can open a work item the phone has not downloaded yet: refresh once, then look again.
    const find = async () =>
      (await loadWorkItem(workItemId)) ??
      (await requestSync().then(() => loadWorkItem(workItemId)));
    void find().then((r) => {
      if (cancelled) return;
      if (!r) {
        setMissing(true);
        return;
      }
      setLoaded({ item: r.item, baseline: r.baseline, outbox: r.outbox });
      const initial = r.draft ?? emptyForm(r.item.moduleType);
      formRef.current = initial;
      editableRef.current = r.item.localState === "PENDING";
      setForm(initial);
      if (r.item.localState === "PENDING")
        void noteWorkStarted(r.item.jobCardId); // the timer: started working on this job card
    });
    return () => {
      cancelled = true;
    };
  }, [workItemId]);

  // Save the draft shortly after each change, and straight away when leaving the screen
  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (dirty.current && formRef.current && editableRef.current) {
      dirty.current = false;
      void saveDraft(workItemId, formRef.current);
    }
  };
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (next: AnyForm) => {
    formRef.current = next;
    dirty.current = true;
    setForm(next);
    if (Object.keys(errors).length) setErrors({}); // clear the red lines once they start fixing things
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_MS);
  };

  const submit = () => {
    if (!loaded || !form || submitting) return;
    Alert.alert(
      "Submit this work?",
      "It is saved on this phone and sent when there is signal. You cannot change it afterwards.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            setSubmitting(true);
            try {
              const res = await submitWorkItem(
                loaded.item,
                form,
                loaded.baseline,
              );
              if (!res.ok) {
                setErrors(res.errors);
                return;
              }
              dirty.current = false;
              editableRef.current = false;
              setJustSaved(true);
            } catch (e) {
              Alert.alert(
                "Could not save",
                e instanceof Error ? e.message : "Try again.",
              );
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  const header = (
    <View style={styles.header}>
      <Pressable
        onPress={() => {
          flush();
          onBack();
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={[
          styles.back,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card,
          },
        ]}
      >
        <IBack size={20} color={theme.colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <ThemedText weight="700" numberOfLines={1}>
          {loaded
            ? WORK_ITEM_LABEL[loaded.item.moduleType] +
              (loaded.item.sequence > 1 ? ` #${loaded.item.sequence}` : "")
            : "Work item"}
        </ThemedText>
        {loaded && (
          <ThemedText muted variant="small" numberOfLines={1}>
            {loaded.item.jcNumber} - {loaded.item.scaleName}
          </ThemedText>
        )}
      </View>
    </View>
  );

  const frame = (children: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        {header}
        {children}
      </SafeAreaView>
    </View>
  );

  if (missing)
    return frame(
      <View style={styles.center}>
        <ThemedText muted style={{ textAlign: "center" }}>
          This work item is not on this phone. It may have been reassigned, or
          you may need a connection to download it.
        </ThemedText>
        <PrimaryButton title="Back to my work" onPress={onBack} />
      </View>,
    );
  if (!loaded || !form)
    return frame(
      <View style={styles.center}>
        <ThemedText muted>Loading...</ThemedText>
      </View>,
    );

  if (justSaved) {
    return frame(
      <View style={styles.center} testID="saved-screen">
        <ICheck size={56} color={theme.colors.success} />
        <ThemedText variant="h2" weight="700">
          Saved
        </ThemedText>
        <ThemedText muted style={{ textAlign: "center" }}>
          It is saved on this phone and goes to the office as soon as there is
          signal.
        </ThemedText>
        <PrimaryButton title="Back to my work" onPress={onBack} />
      </View>,
    );
  }

  const { item, outbox } = loaded;
  const editable = item.localState === "PENDING";
  const common = { errors, workItemId: item.id, editable };

  return frame(
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {item.jobCardStatus === "CLOSED" && editable && (
          <Card>
            <Chip tone="warning" label="This job card has been closed" />
            <ThemedText muted variant="small">
              You can still finish and send this work. It is kept for the office
              to review.
            </ThemedText>
          </Card>
        )}
        {!editable && (
          <Card>
            {item.localState === "SUBMITTED" ? (
              <Chip tone="success" label="Sent" />
            ) : (
              <Chip
                tone={outbox?.status === "blocked" ? "danger" : "warning"}
                label={
                  outbox?.status === "blocked"
                    ? "Needs attention"
                    : "Saved on this phone, waiting to send"
                }
              />
            )}
            {outbox?.lastError && item.localState !== "SUBMITTED" && (
              <ThemedText
                variant="small"
                style={{
                  color:
                    outbox.status === "blocked"
                      ? DANGER
                      : theme.colors.textMuted,
                }}
              >
                {outbox.lastError}
              </ThemedText>
            )}
            <ThemedText muted variant="small">
              This work can no longer be changed.
            </ThemedText>
          </Card>
        )}
        {Object.keys(errors).length > 0 && (
          <Card>
            <View testID="error-summary">
              <ThemedText weight="700" style={{ color: DANGER }}>
                {Object.keys(errors).length}{" "}
                {Object.keys(errors).length === 1
                  ? "thing needs"
                  : "things need"}{" "}
                attention before this can be submitted. They are marked in red
                below.
              </ThemedText>
            </View>
          </Card>
        )}

        {item.moduleType === "INSPECTION" && (
          <InspectionFormView
            form={form as InspectionForm}
            onChange={change}
            {...common}
          />
        )}
        {item.moduleType === "ZERO_CALIBRATION" && (
          <ZeroFormView form={form as ZeroForm} onChange={change} {...common} />
        )}
        {item.moduleType === "SPAN_CALIBRATION" && (
          <SpanFormView
            form={form as SpanForm}
            onChange={change}
            baseline={loaded.baseline}
            {...common}
          />
        )}

        {editable && (
          <View style={{ gap: 8, marginTop: 6 }}>
            <View style={styles.offlineNote}>
              <ICloud size={14} color={theme.colors.textMuted} />
              <ThemedText muted variant="small">
                Works without signal. Your answers are saved as you go.
              </ThemedText>
            </View>
            <PrimaryButton
              title="Submit"
              onPress={submit}
              loading={submitting}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>,
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 16, gap: 22, paddingBottom: 60 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
  },
  offlineNote: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
});
