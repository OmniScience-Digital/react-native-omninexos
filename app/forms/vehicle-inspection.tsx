import { NonTabScreen } from "@/components/ui/non-tab-screen";
import { ThemedText } from "@/components/ui/screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import ImageUploadLoader from "@/components/viFComponents/ImageUploadLoader";
import ResponseModal from "@/components/viFComponents/ResponseModal";
import VifForm from "@/components/viFComponents/VifForm";
import { calculateCustomFields, getJhbTimestamp } from "@/lib/utils";
import {
  Vif_clickUpService,
  uploadPhoto,
} from "@/services/vif.clickUp.service";
import { useAuth } from "@/src/contexts/auth-context";
import { useTheme } from "@/src/contexts/theme-context";
import {
  hideResponseModal,
  incrementUploadProgress,
  resetUploadProgress,
  resetVifForm,
  setBooleanAnswer,
  setOdometer,
  setUploadProgress,
  showResponseModal,
} from "@/src/state";
import {
  useCreateInspectionMutation,
  useGetInspectionsByFleetQuery,
  useListFleetsQuery,
  useUpdateFleetKmMutation,
} from "@/src/state/api";
import { useAppDispatch, useAppSelector } from "@/src/state/redux";
import { useEffect } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";

export default function VehicleInspectionForm() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const dispatch = useAppDispatch();

  // ─── RTK Queries ─────────────────────────────────────────
  const { data: vehicles = [], isLoading: vehiclesLoading } =
    useListFleetsQuery();
  const [createInspection, { isLoading: submitting }] =
    useCreateInspectionMutation();
  const [updateFleetKm] = useUpdateFleetKmMutation();

  // ─── Redux State ─────────────────────────────────────────
  const formState = useAppSelector((state) => state.global.vifForm);
  const uploadProgress = useAppSelector((state) => state.global.uploadProgress);
  const responseModal = useAppSelector((state) => state.global.responseModal);

  // Fetch last inspection for the selected vehicle
  const { data: recentInspections } = useGetInspectionsByFleetQuery(
    { fleetId: formState.selectedVehicleId, sortDirection: "DESC", limit: 1 },
    { skip: !formState.selectedVehicleId },
  );
  const recentInspection = recentInspections?.[0];

  // Auto-fill odometer & boolean answers from last inspection
  useEffect(() => {
    if (recentInspection && recentInspection.odometerStart) {
      dispatch(setOdometer(recentInspection.odometerStart.toString()));
      const fieldNames = [
        "oilAndCoolant",
        "fuelLevel",
        "seatbeltDoorsMirrors",
        "handbrake",
        "tyreCondition",
        "spareTyre",
        "numberPlate",
        "licenseDisc",
        "leaks",
        "lights",
        "defrosterAircon",
        "emergencyKit",
        "clean",
        "warnings",
        "windscreenWipers",
        "serviceBook",
        "siteKit",
      ];
      fieldNames.forEach((field, idx) => {
        const value = (recentInspection as any)[field];
        if (value !== undefined && value !== null) {
          dispatch(setBooleanAnswer({ index: idx, value }));
        }
      });
    }
  }, [recentInspection, dispatch]);

  // Transform fleet data to match Vehicle type expected by VifForm
  const vehiclesForForm = vehicles
    .filter((v) => v.vehicleReg !== null && v.vehicleVin !== null)
    .map((v) => ({
      id: v.id,
      vehicleReg: v.vehicleReg as string,
      vehicleVin: v.vehicleVin as string,
    }));

  const canSubmit =
    !!formState.selectedVehicleId &&
    !!formState.odometerValue &&
    formState.photos.length > 0 &&
    formState.photos.every((p) => p.status === "success") &&
    !formState.booleanQuestions.some((q) => q.value === null);

  const handleSubmit = async () => {
    try {
      // Quick validation
      const hasUnuploadedPhotos = formState.photos.some(
        (photo) => photo.status !== "success",
      );
      if (hasUnuploadedPhotos) {
        dispatch(
          showResponseModal({
            successful: false,
            message: "Please wait for all photos to finish uploading to S3",
          }),
        );
        return;
      }

      if (
        !formState.odometerValue ||
        formState.booleanQuestions.some((q) => q.value === null)
      ) {
        dispatch(
          showResponseModal({
            successful: false,
            message: "Please complete all required fields",
          }),
        );
        return;
      }

      const timestamp = getJhbTimestamp(); // import from utils

      // Extract S3 keys from successfully uploaded photos
      const s3PhotoKeys = formState.photos
        .filter((photo) => photo.status === "success")
        .map((photo) => photo.s3Key);

      // Prepare inspection results
      const inspectionResults = formState.booleanQuestions.map((q) => ({
        question: q.question,
        answer: String(q.value),
      }));

      const inspectionNo = (recentInspection?.inspectionNo ?? 0) + 1;

      // Save to Amplify Data
      const historyEntry = `VIF Dashboard: ${user?.preferred_username} @ ${new Date().toISOString().split("T")[0]} ${new Date().toTimeString().split(" ")[0]}: Inspection #${inspectionNo} for vehicle ${formState.selectedVehicleReg}\n`;

      const inspectionData = {
        fleetid: formState.selectedVehicleId,
        inspectionNo: inspectionNo,
        vehicleVin: formState.selectedVehicleVin,
        inspectionDate: new Date().toISOString().split("T")[0],
        inspectionTime: new Date().toTimeString().split(" ")[0],
        odometerStart: parseFloat(formState.odometerValue),
        vehicleReg: formState.selectedVehicleReg,
        inspectorOrDriver: user?.preferred_username || "",
        oilAndCoolant: formState.booleanQuestions[0].value,
        fuelLevel: formState.booleanQuestions[1].value,
        seatbeltDoorsMirrors: formState.booleanQuestions[2].value,
        handbrake: formState.booleanQuestions[3].value,
        tyreCondition: formState.booleanQuestions[4].value,
        spareTyre: formState.booleanQuestions[5].value,
        numberPlate: formState.booleanQuestions[6].value,
        licenseDisc: formState.booleanQuestions[7].value,
        leaks: formState.booleanQuestions[8].value,
        lights: formState.booleanQuestions[9].value,
        defrosterAircon: formState.booleanQuestions[10].value,
        emergencyKit: formState.booleanQuestions[11].value,
        clean: formState.booleanQuestions[12].value,
        warnings: formState.booleanQuestions[13].value,
        windscreenWipers: formState.booleanQuestions[14].value,
        serviceBook: formState.booleanQuestions[15].value,
        siteKit: formState.booleanQuestions[16].value,
        photo: s3PhotoKeys,
        history: historyEntry,
      };

      // 1. Update fleet km
      await updateFleetKm({
        id: formState.selectedVehicleId,
        currentkm: parseFloat(formState.odometerValue),
      }).unwrap();

      // 2. Create inspection in Amplify
      await createInspection({ input: inspectionData }).unwrap();

      // 3. Calculate custom fields
      const customFields = calculateCustomFields(
        formState,
        vehicles,
        timestamp,
      );

      // 4. Create ClickUp task
      const createTaskResponse = await Vif_clickUpService.createTask({
        vehicleId: formState.selectedVehicleId,
        inspectionNo: String(inspectionNo),
        vehicleReg: formState.selectedVehicleReg,
        vehicleVin: formState.selectedVehicleVin,
        odometer: Number(formState.odometerValue),
        username: user?.preferred_username,
        serviceRequired: String(customFields.serviceRequired),
        reviewRequired: String(customFields.reviewRequired),
        tyreRotationRequired: String(customFields.tyreRotationRequired),
        inspectionResults,
        timestamp,
        s3PhotoKeys,
        photoCount: formState.photos.length,
      });

      if (!createTaskResponse.success) {
        throw new Error(
          createTaskResponse.message || "Failed to create ClickUp task",
        );
      }

      const taskId = String(createTaskResponse.taskId);
      // Replace the photo upload loop in handleSubmit (step 5) with this:

      const successPhotos = formState.photos.filter(
        (p) => p.status === "success",
      );

      if (successPhotos.length > 0) {
        dispatch(
          setUploadProgress({
            isUploading: true,
            currentImage: 0,
            totalImages: successPhotos.length,
          }),
        );

        for (let i = 0; i < successPhotos.length; i++) {
          dispatch(incrementUploadProgress());
          const photo = successPhotos[i];

          // ✅ Pass the URI directly — no fetch(), no blob(), no File()
          // Those are web APIs. RN handles the file read natively via the uri.
          const uploadResult = await uploadPhoto({
            photo: {
              uri: photo.uri,
              name: `photo_${i + 1}.jpg`,
              type: "image/jpeg",
            },
            taskId,
          });

          if (!uploadResult?.success) {
            throw new Error(
              `Failed to upload photo ${i + 1}: ${uploadResult?.error}`,
            );
          }
        }

        dispatch(resetUploadProgress());
      }

      // 6. Success
      dispatch(
        showResponseModal({
          successful: true,
          message: "Inspection submitted successfully!",
        }),
      );
      dispatch(resetVifForm());
    } catch (error: any) {
      dispatch(resetUploadProgress());
      dispatch(
        showResponseModal({
          successful: false,
          message: error.message || "Failed to submit inspection",
        }),
      );
    }
  };

  const styles = {
    card: (theme: any) => ({
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 0.5,
      borderColor: theme.colors.border,
    }),
    cardHeader: (theme: any) => ({
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.colors.border,
    }),
    cardTitle: { fontSize: 16, fontWeight: "600" } as const,
    cardContent: { padding: 16, gap: 20 } as const,
    submitBtn: (theme: any) => ({
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingVertical: 14,
      alignItems: "center" as const,
    }),
    submitBtnDisabled: (theme: any) => ({
      backgroundColor: theme.colors.textMuted + "80",
    }),
    submitBtnText: (theme: any) => ({
      color: theme.colors.primaryText,
      fontSize: 15,
      fontWeight: "600" as const,
    }),
  };

  if (vehiclesLoading)
    return (
      <NonTabScreen
        title="Vehicle Inspection"
        subtitle="Complete all sections"
        showBack
        scrollable
      >
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" />
        </View>
      </NonTabScreen>
    );

  return (
    <NonTabScreen
      title="Vehicle Inspection"
      subtitle="Complete all sections"
      showBack
      scrollable
    >
      <CustomScrollView>
        <View style={styles.card(theme)}>
          <View style={styles.cardHeader(theme)}>
            <ThemedText style={styles.cardTitle}>
              Vehicle Inspection Form
            </ThemedText>
          </View>
          <View style={styles.cardContent}>
            <VifForm
              vehicles={vehiclesForForm}
              inspectionNumber={(recentInspection?.inspectionNo ?? 0) + 1}
              recentInspection={recentInspection}
            />
            <TouchableOpacity
              style={[
                styles.submitBtn(theme),
                (!canSubmit || submitting) && styles.submitBtnDisabled(theme),
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={theme.colors.primaryText} />
              ) : (
                <ThemedText style={styles.submitBtnText(theme)}>
                  Submit Inspection
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </CustomScrollView>

      <ImageUploadLoader
        visible={uploadProgress.isUploading}
        currentImage={uploadProgress.currentImage}
        totalImages={uploadProgress.totalImages}
      />
      <ResponseModal
        visible={responseModal.visible}
        successful={responseModal.successful}
        message={responseModal.message}
        onClose={() => dispatch(hideResponseModal())}
      />
    </NonTabScreen>
  );
}
