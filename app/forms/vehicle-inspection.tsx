import { NonTabScreen } from "@/components/ui/non-tab-screen";
import { ThemedText } from "@/components/ui/screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import ImageUploadLoader from "@/components/viFComponents/ImageUploadLoader";
import { PhotoState } from "@/components/viFComponents/PhotoUpload";
import ResponseModal from "@/components/viFComponents/ResponseModal";
import VifForm, {
  booleanQuestions as initialQuestions,
} from "@/components/viFComponents/VifForm";
import { useTheme } from "@/src/contexts/theme-context";
import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

// ─── Mock data for UI preview ────────────────────────────────────────────────
const MOCK_VEHICLES = [
  { id: "1", vehicleReg: "ABC 123 GP", vehicleVin: "VIN001" },
  { id: "2", vehicleReg: "DEF 456 GP", vehicleVin: "VIN002" },
  { id: "3", vehicleReg: "GHI 789 GP", vehicleVin: "VIN003" },
];

export default function VehicleInspectionForm() {
  const { theme } = useTheme();
  const [loadingBtn, setLoadingBtn] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [successful, setSuccessful] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState({
    isUploading: false,
    currentImage: 0,
    totalImages: 0,
  });

  const [formState, setFormState] = useState({
    selectedVehicleId: "",
    selectedVehicleReg: "",
    selectedVehicleVin: "",
    odometerValue: "",
    booleanQuestions: initialQuestions,
    photos: [] as PhotoState[],
  });

  const canSubmit =
    !!formState.selectedVehicleId &&
    !!formState.odometerValue &&
    formState.photos.length > 0 &&
    formState.photos.every((p) => p.status === "success") &&
    !formState.booleanQuestions.some((q) => q.value === null);

  const handleVehicleChange = (id: string, reg: string, vin: string) => {
    setFormState((prev) => ({
      ...prev,
      selectedVehicleId: id,
      selectedVehicleReg: reg,
      selectedVehicleVin: vin,
      photos: [],
    }));
  };

  const handleBooleanChange = (index: number, value: boolean) => {
    const updated = [...formState.booleanQuestions];
    updated[index] = { ...updated[index], value };
    setFormState((prev) => ({ ...prev, booleanQuestions: updated }));
  };

  // UI-only submit handler
  const handleSubmit = () => {
    setLoadingBtn(true);
    // Simulate submission
    setTimeout(() => {
      setLoadingBtn(false);
      setSuccessful(true);
      setMessage(
        "Inspection submitted successfully and vehicle odometer updated",
      );
      setShowResponse(true);
    }, 1500);
  };
  // Inside VehicleInspectionForm component, after const { theme } = useTheme()
  const styles = StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      letterSpacing: -0.3,
    },
    headerSub: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 0.5,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    cardHeader: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.colors.border,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    cardContent: {
      padding: 16,
      gap: 20,
    },
    submitBtn: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 4,
    },
    submitBtnDisabled: {
      backgroundColor: theme.colors.textMuted + "80", // semi-transparent muted
    },
    submitBtnInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    submitBtnText: {
      color: theme.colors.primaryText,
      fontSize: 15,
      fontWeight: "600",
    },
    footer: {
      paddingVertical: 12,
      alignItems: "center",
      borderTopWidth: 0.5,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    footerText: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
  });

  return (
    <NonTabScreen
      title="Vehicle Inspection"
      subtitle="Complete all sections"
      showBack={true}
      scrollable={true}
      footerText="Omninexos Fleet Management © 2026"
    >
      <CustomScrollView>
        {/* Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>
              Vehicle Inspection Form
            </ThemedText>
          </View>
          <View style={styles.cardContent}>
            <VifForm
              vehicles={MOCK_VEHICLES}
              formState={formState}
              inspectionNumber={1}
              recentInspection={null}
              onVehicleChange={handleVehicleChange}
              onOdometerChange={(val) =>
                setFormState((prev) => ({ ...prev, odometerValue: val }))
              }
              onBooleanChange={handleBooleanChange}
              onPhotosChange={(photos) =>
                setFormState((prev) => ({ ...prev, photos }))
              }
            />
            {/* Submit button */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!canSubmit || loadingBtn) && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit || loadingBtn}
              activeOpacity={0.8}
            >
              {loadingBtn ? (
                <View style={styles.submitBtnInner}>
                  <ActivityIndicator size="small" color={theme.colors.text} />
                  <ThemedText style={styles.submitBtnText}>
                    Submitting…
                  </ThemedText>
                </View>
              ) : (
                <ThemedText style={styles.submitBtnText}>
                  Submit Inspection
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </CustomScrollView>

      {/* Modals */}
      <ImageUploadLoader
        visible={uploadProgress.isUploading}
        currentImage={uploadProgress.currentImage}
        totalImages={uploadProgress.totalImages}
        message={`Uploading image ${uploadProgress.currentImage} of ${uploadProgress.totalImages}`}
      />

      <ResponseModal
        visible={showResponse}
        successful={successful}
        message={message}
        onClose={() => setShowResponse(false)}
      />
    </NonTabScreen>
  );
}
