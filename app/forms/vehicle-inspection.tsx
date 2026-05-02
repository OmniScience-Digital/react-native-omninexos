// // forms/VehicleInspectionForm.tsx
// import { NonTabScreen } from "@/components/ui/non-tab-screen";
// import { ThemedText } from "@/components/ui/screen";
// import { CustomScrollView } from "@/components/ui/scrollView";
// import ResponseModal from "@/components/viFComponents/ResponseModal";
// import VifForm from "@/components/viFComponents/VifForm";
// import { calculateCustomFields, getJhbTimestamp } from "@/lib/utils";
// import {
//   Vif_clickUpService,
//   uploadPhoto,
// } from "@/services/vif.clickUp.service";
// import { useAuth } from "@/src/contexts/auth-context";
// import { useTheme } from "@/src/contexts/theme-context";
// import {
//   hideResponseModal,
//   resetVifForm,
//   setBooleanAnswer,
//   setOdometer,
//   showResponseModal,
// } from "@/src/state";
// import {
//   useCreateInspectionMutation,
//   useGetInspectionsByFleetQuery,
//   useListFleetsQuery,
//   useUpdateFleetKmMutation,
// } from "@/src/state/api";
// import { useAppDispatch, useAppSelector } from "@/src/state/redux";
// import { useEffect, useState } from "react";
// import {
//   ActivityIndicator,
//   RefreshControl,
//   StyleSheet,
//   TouchableOpacity,
//   View,
// } from "react-native";

// export default function VehicleInspectionForm() {
//   const { theme } = useTheme();
//   const { user } = useAuth();
//   const dispatch = useAppDispatch();

//   // ─── RTK Queries ─────────────────────────────────────────
//   const { data: vehicles = [], isLoading: vehiclesLoading } =
//     useListFleetsQuery();
//   const [createInspection] = useCreateInspectionMutation();
//   const [updateFleetKm] = useUpdateFleetKmMutation();

//   // ─── Redux State ─────────────────────────────────────────
//   const formState = useAppSelector((state) => state.global.vifForm);
//   const responseModal = useAppSelector((state) => state.global.responseModal);

//   // ─── Last inspection ──────────────────────────────────────
//   const { data: recentInspections } = useGetInspectionsByFleetQuery(
//     { fleetId: formState.selectedVehicleId, sortDirection: "DESC", limit: 1 },
//     { skip: !formState.selectedVehicleId },
//   );
//   const recentInspection = recentInspections?.[0];

//   const { refetch: refetchFleets } = useListFleetsQuery();
//   const { refetch: refetchRecentInspection } = useGetInspectionsByFleetQuery(
//     { fleetId: formState.selectedVehicleId, sortDirection: "DESC", limit: 1 },
//     { skip: !formState.selectedVehicleId },
//   );

//   const [refreshing, setRefreshing] = useState(false);
//   const [submitting, setSubmitting] = useState(false);

//   // ─── Auto-fill from last inspection ──────────────────────
//   useEffect(() => {
//     if (recentInspection?.odometerStart) {
//       dispatch(setOdometer(recentInspection.odometerStart.toString()));
//       const fieldNames = [
//         "oilAndCoolant",
//         "fuelLevel",
//         "seatbeltDoorsMirrors",
//         "handbrake",
//         "tyreCondition",
//         "spareTyre",
//         "numberPlate",
//         "licenseDisc",
//         "leaks",
//         "lights",
//         "defrosterAircon",
//         "emergencyKit",
//         "clean",
//         "warnings",
//         "windscreenWipers",
//         "serviceBook",
//         "siteKit",
//       ];
//       fieldNames.forEach((field, idx) => {
//         const value = (recentInspection as any)[field];
//         if (value !== undefined && value !== null) {
//           dispatch(setBooleanAnswer({ index: idx, value }));
//         }
//       });
//     }
//   }, [recentInspection, dispatch]);

//   const onRefresh = async () => {
//     setRefreshing(true);
//     await Promise.all([
//       refetchFleets(),
//       formState.selectedVehicleId
//         ? refetchRecentInspection()
//         : Promise.resolve(),
//     ]);
//     setRefreshing(false);
//   };

//   const vehiclesForForm = vehicles
//     .filter((v) => v.vehicleReg !== null && v.vehicleVin !== null)
//     .map((v) => ({
//       id: v.id,
//       vehicleReg: v.vehicleReg as string,
//       vehicleVin: v.vehicleVin as string,
//     }));

//   // Photos still uploading in background are fine — we wait at submit time
//   const canSubmit =
//     !!formState.selectedVehicleId &&
//     !!formState.odometerValue &&
//     formState.photos.length > 0 &&
//     formState.photos.every((p) => p.status === "success") &&
//     !formState.booleanQuestions.some((q) => q.value === null);

//   // ─── Submit ───────────────────────────────────────────────
//   const handleSubmit = async () => {
//     setSubmitting(true);
//     try {
//       const hasUnuploadedPhotos = formState.photos.some(
//         (p) => p.status !== "success",
//       );
//       if (hasUnuploadedPhotos) {
//         dispatch(
//           showResponseModal({
//             successful: false,
//             message: "Please wait for all photos to finish uploading",
//           }),
//         );
//         return;
//       }

//       if (
//         !formState.odometerValue ||
//         formState.booleanQuestions.some((q) => q.value === null)
//       ) {
//         dispatch(
//           showResponseModal({
//             successful: false,
//             message: "Please complete all required fields",
//           }),
//         );
//         return;
//       }

//       const timestamp = getJhbTimestamp();
//       const inspectionNo = (recentInspection?.inspectionNo ?? 0) + 1;
//       const s3PhotoKeys = formState.photos
//         .filter((p) => p.status === "success")
//         .map((p) => p.s3Key);

//       const inspectionResults = formState.booleanQuestions.map((q) => ({
//         question: q.question,
//         answer: String(q.value),
//       }));

//       const historyEntry = `VIF Dashboard: ${user?.preferred_username} @ ${new Date().toISOString().split("T")[0]} ${new Date().toTimeString().split(" ")[0]}: Inspection #${inspectionNo} for vehicle ${formState.selectedVehicleReg}\n`;

//       const inspectionData = {
//         fleetid: formState.selectedVehicleId,
//         inspectionNo,
//         vehicleVin: formState.selectedVehicleVin,
//         inspectionDate: new Date().toISOString().split("T")[0],
//         inspectionTime: new Date().toTimeString().split(" ")[0],
//         odometerStart: parseFloat(formState.odometerValue),
//         vehicleReg: formState.selectedVehicleReg,
//         inspectorOrDriver: user?.preferred_username || "",
//         oilAndCoolant: formState.booleanQuestions[0].value,
//         fuelLevel: formState.booleanQuestions[1].value,
//         seatbeltDoorsMirrors: formState.booleanQuestions[2].value,
//         handbrake: formState.booleanQuestions[3].value,
//         tyreCondition: formState.booleanQuestions[4].value,
//         spareTyre: formState.booleanQuestions[5].value,
//         numberPlate: formState.booleanQuestions[6].value,
//         licenseDisc: formState.booleanQuestions[7].value,
//         leaks: formState.booleanQuestions[8].value,
//         lights: formState.booleanQuestions[9].value,
//         defrosterAircon: formState.booleanQuestions[10].value,
//         emergencyKit: formState.booleanQuestions[11].value,
//         clean: formState.booleanQuestions[12].value,
//         warnings: formState.booleanQuestions[13].value,
//         windscreenWipers: formState.booleanQuestions[14].value,
//         serviceBook: formState.booleanQuestions[15].value,
//         siteKit: formState.booleanQuestions[16].value,
//         photo: s3PhotoKeys,
//         history: historyEntry,
//       };

//       // 1. Update fleet km
//       await updateFleetKm({
//         id: formState.selectedVehicleId,
//         currentkm: parseFloat(formState.odometerValue),
//       }).unwrap();

//       // 2. Save inspection
//       await createInspection({ input: inspectionData }).unwrap();

//       // 3. Custom fields
//       const customFields = calculateCustomFields(
//         formState,
//         vehicles,
//         timestamp,
//       );

//       // 4. ClickUp task
//       const createTaskResponse = await Vif_clickUpService.createTask({
//         vehicleId: formState.selectedVehicleId,
//         inspectionNo: String(inspectionNo),
//         vehicleReg: formState.selectedVehicleReg,
//         vehicleVin: formState.selectedVehicleVin,
//         odometer: Number(formState.odometerValue),
//         username: user?.preferred_username,
//         serviceRequired: String(customFields.serviceRequired),
//         reviewRequired: String(customFields.reviewRequired),
//         tyreRotationRequired: String(customFields.tyreRotationRequired),
//         inspectionResults,
//         timestamp,
//         s3PhotoKeys,
//         photoCount: formState.photos.length,
//       });

//       if (!createTaskResponse.success) {
//         throw new Error(
//           createTaskResponse.message || "Failed to create ClickUp task",
//         );
//       }

//       // 5. Attach photos to ClickUp task
//       const taskId = String(createTaskResponse.taskId);
//       for (let i = 0; i < formState.photos.length; i++) {
//         const photo = formState.photos[i];
//         const uploadResult = await uploadPhoto({
//           photo: {
//             uri: photo.uri,
//             name: `photo_${i + 1}.jpg`,
//             type: "image/jpeg",
//           },
//           taskId,
//         });
//         if (!uploadResult?.success) {
//           throw new Error(`Failed to attach photo ${i + 1} to task`);
//         }
//       }

//       dispatch(
//         showResponseModal({
//           successful: true,
//           message: "Inspection submitted successfully!",
//         }),
//       );
//       dispatch(resetVifForm());
//     } catch (error: any) {
//       dispatch(
//         showResponseModal({
//           successful: false,
//           message: error.message || "Failed to submit inspection",
//         }),
//       );
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const styles = StyleSheet.create({
//     centered: { flex: 1, justifyContent: "center", alignItems: "center" },
//     card: {
//       backgroundColor: theme.colors.card,
//       borderRadius: theme.radius.md,
//       borderWidth: 0.5,
//       borderColor: theme.colors.border,
//       marginHorizontal: 16,
//       marginVertical: 12,
//     },
//     cardHeader: {
//       paddingHorizontal: 16,
//       paddingVertical: 14,
//       borderBottomWidth: 0.5,
//       borderBottomColor: theme.colors.border,
//     },
//     cardTitle: { fontSize: 16, fontWeight: "600" },
//     cardContent: { padding: 16, gap: 20 },
//     submitBtn: {
//       backgroundColor: theme.colors.accent,
//       borderRadius: theme.radius.md,
//       paddingVertical: 14,
//       alignItems: "center",
//     },
//     submitBtnDisabled: { backgroundColor: theme.colors.textMuted + "80" },
//     submitBtnText: {
//       color: theme.colors.primaryText,
//       fontSize: 15,
//       fontWeight: "600",
//     },
//   });

//   if (vehiclesLoading)
//     return (
//       <NonTabScreen
//         title="Vehicle Inspection"
//         subtitle="Complete all sections"
//         showBack
//         scrollable
//       >
//         <View style={styles.centered}>
//           <ActivityIndicator size="large" />
//         </View>
//       </NonTabScreen>
//     );

//   return (
//     <NonTabScreen
//       title="Vehicle Inspection"
//       subtitle="Complete all sections"
//       showBack
//       scrollable
//     >
//       <CustomScrollView
//         refreshControl={
//           <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
//         }
//       >
//         <View style={styles.card}>
//           <View style={styles.cardHeader}>
//             <ThemedText style={styles.cardTitle}>
//               Vehicle Inspection Form
//             </ThemedText>
//           </View>
//           <View style={styles.cardContent}>
//             {/* Form is always visible — photos upload in background, no blocking */}
//             <VifForm
//               vehicles={vehiclesForForm}
//               inspectionNumber={(recentInspection?.inspectionNo ?? 0) + 1}
//               recentInspection={recentInspection}
//             />

//             <TouchableOpacity
//               style={[
//                 styles.submitBtn,
//                 (!canSubmit || submitting) && styles.submitBtnDisabled,
//               ]}
//               onPress={handleSubmit}
//               disabled={!canSubmit || submitting}
//             >
//               {submitting ? (
//                 <ActivityIndicator color={theme.colors.primaryText} />
//               ) : (
//                 <ThemedText style={styles.submitBtnText}>
//                   Submit Inspection
//                 </ThemedText>
//               )}
//             </TouchableOpacity>
//           </View>
//         </View>
//       </CustomScrollView>

//       {/* ImageUploadLoader removed — photos upload silently in the background */}

//       <ResponseModal
//         visible={responseModal.visible}
//         successful={responseModal.successful}
//         message={responseModal.message}
//         onClose={() => dispatch(hideResponseModal())}
//       />
//     </NonTabScreen>
//   );
// }

// forms/VehicleInspectionForm.tsx
import { NonTabScreen } from "@/components/ui/non-tab-screen";
import { ThemedText } from "@/components/ui/screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import ResponseModal from "@/components/viFComponents/ResponseModal";
import VifForm from "@/components/viFComponents/VifForm";
import { calculateCustomFields, getJhbTimestamp } from "@/lib/utils";
import { enqueue } from "@/services/submissionQueue";
import {
  Vif_clickUpService,
  uploadPhoto,
} from "@/services/vif.clickUp.service";
import { useAuth } from "@/src/contexts/auth-context";
import { useTheme } from "@/src/contexts/theme-context";
import {
  hideResponseModal,
  resetVifForm,
  setBooleanAnswer,
  setOdometer,
  showResponseModal,
} from "@/src/state";
import {
  useCreateInspectionMutation,
  useGetInspectionsByFleetQuery,
  useListFleetsQuery,
  useUpdateFleetKmMutation,
} from "@/src/state/api";
import { useAppDispatch, useAppSelector } from "@/src/state/redux";
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

export default function VehicleInspectionForm() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const dispatch = useAppDispatch();

  const { data: vehicles = [], isLoading: vehiclesLoading } =
    useListFleetsQuery();
  const [createInspection] = useCreateInspectionMutation();
  const [updateFleetKm] = useUpdateFleetKmMutation();

  const formState = useAppSelector((state) => state.global.vifForm);
  const responseModal = useAppSelector((state) => state.global.responseModal);

  const { data: recentInspections } = useGetInspectionsByFleetQuery(
    { fleetId: formState.selectedVehicleId, sortDirection: "DESC", limit: 1 },
    { skip: !formState.selectedVehicleId },
  );
  const recentInspection = recentInspections?.[0];

  const { refetch: refetchFleets } = useListFleetsQuery();
  const { refetch: refetchRecentInspection } = useGetInspectionsByFleetQuery(
    { fleetId: formState.selectedVehicleId, sortDirection: "DESC", limit: 1 },
    { skip: !formState.selectedVehicleId },
  );

  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (recentInspection?.odometerStart) {
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

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchFleets(),
      formState.selectedVehicleId
        ? refetchRecentInspection()
        : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

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

  const buildPayload = () => {
    const inspectionNo = (recentInspection?.inspectionNo ?? 0) + 1;
    const timestamp = getJhbTimestamp();
    const s3PhotoKeys = formState.photos
      .filter((p) => p.status === "success")
      .map((p) => p.s3Key);
    const inspectionResults = formState.booleanQuestions.map((q) => ({
      question: q.question,
      answer: String(q.value),
    }));
    const historyEntry = `VIF Dashboard: ${user?.preferred_username} @ ${new Date().toISOString().split("T")[0]} ${new Date().toTimeString().split(" ")[0]}: Inspection #${inspectionNo} for vehicle ${formState.selectedVehicleReg}\n`;
    const inspectionData = {
      fleetid: formState.selectedVehicleId,
      inspectionNo,
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
    const customFields = calculateCustomFields(formState, vehicles, timestamp);
    const clickUpPayload = {
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
    };
    const photos = formState.photos.map((p, i) => ({
      uri: p.uri,
      name: `photo_${i + 1}.jpg`,
      type: "image/jpeg",
    }));
    return {
      inspectionData,
      clickUpPayload,
      photos,
      fleetKmUpdate: {
        id: formState.selectedVehicleId,
        currentkm: parseFloat(formState.odometerValue),
      },
    };
  };

  const submitOnline = async (payload: ReturnType<typeof buildPayload>) => {
    const { inspectionData, clickUpPayload, photos, fleetKmUpdate } = payload;
    await updateFleetKm(fleetKmUpdate).unwrap();
    await createInspection({ input: inspectionData }).unwrap();
    const taskResponse = await Vif_clickUpService.createTask(clickUpPayload);
    if (!taskResponse.success) {
      throw new Error(taskResponse.message || "Failed to create ClickUp task");
    }
    const taskId = String(taskResponse.taskId);
    for (let i = 0; i < photos.length; i++) {
      const result = await uploadPhoto({ photo: photos[i], taskId });
      if (!result?.success) throw new Error(`Failed to attach photo ${i + 1}`);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (formState.photos.some((p) => p.status !== "success")) {
        dispatch(
          showResponseModal({
            successful: false,
            message: "Please wait for all photos to finish uploading",
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

      const payload = buildPayload();
      const net = await NetInfo.fetch();

      if (net.isConnected && net.isInternetReachable) {
        await submitOnline(payload);
        dispatch(
          showResponseModal({
            successful: true,
            message: "Inspection submitted successfully!",
          }),
        );
      } else {
        await enqueue("vif", payload);
        dispatch(
          showResponseModal({
            successful: true,
            message:
              "No network — saved offline. Will submit when back online.",
          }),
        );
      }

      dispatch(resetVifForm());
    } catch (error: any) {
      dispatch(
        showResponseModal({
          successful: false,
          message: error.message || "Failed to submit inspection",
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const styles = StyleSheet.create({
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 0.5,
      borderColor: theme.colors.border,
      marginHorizontal: 16,
      marginVertical: 12,
    },
    cardHeader: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.colors.border,
    },
    cardTitle: { fontSize: 16, fontWeight: "600" },
    cardContent: { padding: 16, gap: 20 },
    submitBtn: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingVertical: 14,
      alignItems: "center",
    },
    submitBtnDisabled: { backgroundColor: theme.colors.textMuted + "80" },
    submitBtnText: {
      color: theme.colors.primaryText,
      fontSize: 15,
      fontWeight: "600",
    },
  });

  if (vehiclesLoading)
    return (
      <NonTabScreen
        title="Vehicle Inspection"
        subtitle="Complete all sections"
        showBack
        scrollable
      >
        <View style={styles.centered}>
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
      <CustomScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
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
                styles.submitBtn,
                (!canSubmit || submitting) && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={theme.colors.primaryText} />
              ) : (
                <ThemedText style={styles.submitBtnText}>
                  Submit Inspection
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </CustomScrollView>
      <ResponseModal
        visible={responseModal.visible}
        successful={responseModal.successful}
        message={responseModal.message}
        onClose={() => dispatch(hideResponseModal())}
      />
    </NonTabScreen>
  );
}
