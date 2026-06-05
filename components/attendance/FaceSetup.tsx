// components/attendance/FaceSetup.tsx
import { ThemedText } from "@/components/screens/screen";
import { useTheme } from "@/src/contexts/theme-context";
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
  ShieldCheck,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

const IconCamera = Camera as any;
const IconCheck = CheckCircle2 as any;
const IconChevron = ChevronRight as any;
const IconRotateCcw = RotateCcw as any;
const IconShield = ShieldCheck as any;

interface FaceSetupProps {
  photoUri: string | null;
  uploading: boolean;
  error: string | null;
  onCapture: () => void; // calls captureAndUpload from hook
  onRetake: () => void; // calls resetSetup from hook
}

export function FaceSetup({
  photoUri,
  uploading,
  error,
  onCapture,
  onRetake,
}: FaceSetupProps) {
  const { theme } = useTheme();

  // ── Uploading ─────────────────────────────────────────────────────────────
  if (uploading) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.center}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: theme.colors.accent + "18" },
            ]}
          >
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
          <ThemedText weight="700" style={styles.title}>
            Saving Your Photo
          </ThemedText>
          <ThemedText muted style={styles.subtitle}>
            Uploading to secure storage…
          </ThemedText>
        </View>
      </View>
    );
  }

  // ── Success — photo uploaded ───────────────────────────────────────────────
  if (photoUri && !error) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.center}>
          <View style={styles.previewRing}>
            <Image source={{ uri: photoUri }} style={styles.previewImg} />
          </View>
          <View
            style={[
              styles.successBadge,
              { backgroundColor: theme.colors.success + "18" },
            ]}
          >
            <IconCheck size={16} color={theme.colors.success} />
            <ThemedText
              style={{
                color: theme.colors.success,
                marginLeft: 6,
                fontSize: 13,
              }}
              weight="600"
            >
              Photo saved successfully
            </ThemedText>
          </View>
          <ThemedText weight="700" style={styles.title}>
            You're All Set
          </ThemedText>
          <ThemedText muted style={styles.subtitle}>
            Your reference photo has been saved. You can now clock in.
          </ThemedText>
          <Pressable
            onPress={onRetake}
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <IconRotateCcw size={15} color={theme.colors.textMuted} />
            <ThemedText muted style={{ marginLeft: 6, fontSize: 13 }}>
              Retake photo
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Intro / error ─────────────────────────────────────────────────────────
  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.center}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: theme.colors.accent + "18" },
          ]}
        >
          <IconShield size={48} color={theme.colors.accent} />
        </View>

        <ThemedText weight="700" style={styles.title}>
          Set Up Face Verification
        </ThemedText>
        <ThemedText muted style={styles.subtitle}>
          Take a reference selfie so we can verify your identity each time you
          clock in. One-time setup.
        </ThemedText>

        {/* Tips */}
        <View
          style={[
            styles.tipsCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {[
            "Good lighting — face clearly visible",
            "Look directly at the camera",
            "No sunglasses or hats",
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <View
                style={[
                  styles.tipDot,
                  { backgroundColor: theme.colors.accent },
                ]}
              />
              <ThemedText style={{ fontSize: 13, flex: 1 }}>{tip}</ThemedText>
            </View>
          ))}
        </View>

        {/* Error */}
        {!!error && (
          <View
            style={[
              styles.errorBox,
              {
                backgroundColor: theme.colors.warning + "14",
                borderColor: theme.colors.warning + "40",
              },
            ]}
          >
            <ThemedText style={{ color: theme.colors.warning, fontSize: 13 }}>
              {error}
            </ThemedText>
          </View>
        )}

        {/* CTA */}
        <Pressable
          onPress={onCapture}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: theme.colors.accent,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <IconCamera size={20} color="#fff" />
          <ThemedText
            weight="700"
            style={{ color: "#fff", marginLeft: 8, fontSize: 15 }}
          >
            {error ? "Try Again" : "Open Camera"}
          </ThemedText>
          <IconChevron size={18} color="#fff" style={{ marginLeft: 4 }} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: { fontSize: 22, textAlign: "center", marginBottom: 10 },
  subtitle: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },
  tipsCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginBottom: 24,
  },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tipDot: { width: 6, height: 6, borderRadius: 3 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: "100%",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
  },
  previewRing: {
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 3,
    borderColor: "#22c55e",
  },
  previewImg: { width: "100%", height: "100%" },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 16,
  },
  errorBox: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
});
