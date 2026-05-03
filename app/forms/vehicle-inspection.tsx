// // forms/VehicleInspectionForm.tsx
// import { NonTabScreen } from "@/components/ui/non-tab-screen";
// import { ThemedText } from "@/components/ui/screen";
// import { CustomScrollView } from "@/components/ui/scrollView";
// import ResponseModal from "@/components/viFComponents/ResponseModal";
// import VifForm from "@/components/viFComponents/VifForm";
// import { calculateCustomFields, getJhbTimestamp } from "@/lib/utils";
// import { enqueue } from "@/services/submissionQueue";
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
//   updatePhotoStatus,
// } from "@/src/state";
// import {
//   useCreateInspectionMutation,
//   useGetInspectionsByFleetQuery,
//   useListFleetsQuery,
//   useUpdateFleetKmMutation,
// } from "@/src/state/api";
// import { useAppDispatch, useAppSelector } from "@/src/state/redux";
// import NetInfo from "@react-native-community/netinfo";
// import { uploadData } from "aws-amplify/storage";
// import { useEffect, useState } from "react";
// import {
//   ActivityIndicator,
//   RefreshControl,
//   StyleSheet,
//   TouchableOpacity,
//   View,
// } from "react-native";

// // ─── S3 helpers ───────────────────────────────────────────────
// const cleanVehicleReg = (reg: string): string =>
//   reg.replace(/[^a-zA-Z0-9]/g, "-");

// const randomString = (length = 8): string =>
//   Math.random()
//     .toString(36)
//     .substring(2, 2 + length);

// const generateS3Key = (
//   vehicleReg: string,
//   inspectionNo: number,
//   index: number,
// ): string =>
//   `inspections/${cleanVehicleReg(vehicleReg)}/${inspectionNo}/${Date.now()}-${index}-${randomString()}.jpg`;

// export default function VehicleInspectionForm() {
//   const { theme } = useTheme();
//   const { user } = useAuth();
//   const dispatch = useAppDispatch();

//   const { data: vehicles = [], isLoading: vehiclesLoading } =
//     useListFleetsQuery();
//   const [createInspection] = useCreateInspectionMutation();
//   const [updateFleetKm] = useUpdateFleetKmMutation();

//   const formState = useAppSelector((state) => state.global.vifForm);
//   const responseModal = useAppSelector((state) => state.global.responseModal);

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
//   const [isOnline, setIsOnline] = useState(true);

//   // ─── Track network reactively ─────────────────────────────
//   useEffect(() => {
//     const unsub = NetInfo.addEventListener((state) => {
//       setIsOnline(!!(state.isConnected && state.isInternetReachable));
//     });
//     return () => unsub();
//   }, []);

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

//   // ─── canSubmit ────────────────────────────────────────────
//   // Online:  need photos, none uploading
//   // Offline: photos optional — inspectors may have no signal at all
//   const photosReady = isOnline
//     ? formState.photos.length > 0 &&
//       !formState.photos.some((p) => p.status === "uploading")
//     : true;

//   const canSubmit =
//     !!formState.selectedVehicleId &&
//     !!formState.odometerValue &&
//     photosReady &&
//     !formState.booleanQuestions.some((q) => q.value === null);

//   // ─── Upload any "local" photos to S3 before submitting ────
//   // Called only when online and submitting
//   const uploadLocalPhotos = async (inspectionNo: number): Promise<string[]> => {
//     const s3Keys: string[] = [];
//     for (let i = 0; i < formState.photos.length; i++) {
//       const photo = formState.photos[i];
//       if (photo.status === "success" && photo.s3Key) {
//         // Already uploaded
//         s3Keys.push(photo.s3Key);
//         continue;
//       }
//       if ((photo.status as string) === "local" || photo.status === "error") {
//         // Upload now
//         dispatch(
//           updatePhotoStatus({
//             id: photo.id,
//             status: "uploading",
//             error: undefined,
//           }),
//         );
//         try {
//           const response = await fetch(photo.uri);
//           const blob = await response.blob();
//           const s3Key = generateS3Key(
//             formState.selectedVehicleReg,
//             inspectionNo,
//             i,
//           );
//           await uploadData({
//             path: s3Key,
//             data: blob,
//             options: { contentType: "image/jpeg" },
//           }).result;
//           dispatch(
//             updatePhotoStatus({
//               id: photo.id,
//               status: "success",
//               s3Key,
//               error: undefined,
//             }),
//           );
//           s3Keys.push(s3Key);
//         } catch (err) {
//           dispatch(
//             updatePhotoStatus({
//               id: photo.id,
//               status: "error",
//               error: err instanceof Error ? err.message : "Upload failed",
//             }),
//           );
//           // Don't throw — skip this photo and continue with the rest
//         }
//       }
//     }
//     return s3Keys;
//   };

//   // ─── Build payload ────────────────────────────────────────
//   const buildPayload = (s3PhotoKeys: string[]) => {
//     const inspectionNo = (recentInspection?.inspectionNo ?? 0) + 1;
//     const timestamp = getJhbTimestamp();
//     const inspectionResults = formState.booleanQuestions.map((q) => ({
//       question: q.question,
//       answer: String(q.value),
//     }));
//     const historyEntry = `VIF Dashboard: ${user?.preferred_username} @ ${new Date().toISOString().split("T")[0]} ${new Date().toTimeString().split(" ")[0]}: Inspection #${inspectionNo} for vehicle ${formState.selectedVehicleReg}\n`;

//     const inspectionData = {
//       fleetid: formState.selectedVehicleId,
//       inspectionNo,
//       vehicleVin: formState.selectedVehicleVin,
//       inspectionDate: new Date().toISOString().split("T")[0],
//       inspectionTime: new Date().toTimeString().split(" ")[0],
//       odometerStart: parseFloat(formState.odometerValue),
//       vehicleReg: formState.selectedVehicleReg,
//       inspectorOrDriver: user?.preferred_username || "",
//       oilAndCoolant: formState.booleanQuestions[0].value,
//       fuelLevel: formState.booleanQuestions[1].value,
//       seatbeltDoorsMirrors: formState.booleanQuestions[2].value,
//       handbrake: formState.booleanQuestions[3].value,
//       tyreCondition: formState.booleanQuestions[4].value,
//       spareTyre: formState.booleanQuestions[5].value,
//       numberPlate: formState.booleanQuestions[6].value,
//       licenseDisc: formState.booleanQuestions[7].value,
//       leaks: formState.booleanQuestions[8].value,
//       lights: formState.booleanQuestions[9].value,
//       defrosterAircon: formState.booleanQuestions[10].value,
//       emergencyKit: formState.booleanQuestions[11].value,
//       clean: formState.booleanQuestions[12].value,
//       warnings: formState.booleanQuestions[13].value,
//       windscreenWipers: formState.booleanQuestions[14].value,
//       serviceBook: formState.booleanQuestions[15].value,
//       siteKit: formState.booleanQuestions[16].value,
//       photo: s3PhotoKeys,
//       history: historyEntry,
//     };

//     const customFields = calculateCustomFields(formState, vehicles, timestamp);

//     const clickUpPayload = {
//       vehicleId: formState.selectedVehicleId,
//       inspectionNo: String(inspectionNo),
//       vehicleReg: formState.selectedVehicleReg,
//       vehicleVin: formState.selectedVehicleVin,
//       odometer: Number(formState.odometerValue),
//       username: user?.preferred_username,
//       serviceRequired: String(customFields.serviceRequired),
//       reviewRequired: String(customFields.reviewRequired),
//       tyreRotationRequired: String(customFields.tyreRotationRequired),
//       inspectionResults,
//       timestamp,
//       s3PhotoKeys,
//       photoCount: s3PhotoKeys.length,
//     };

//     // Photos for ClickUp attachment
//     const clickUpPhotos = formState.photos
//       .filter((p) => p.status === "success")
//       .map((p, i) => ({
//         uri: p.uri,
//         name: `photo_${i + 1}.jpg`,
//         type: "image/jpeg",
//       }));

//     return {
//       inspectionNo,
//       inspectionData,
//       clickUpPayload,
//       clickUpPhotos,
//       fleetKmUpdate: {
//         id: formState.selectedVehicleId,
//         currentkm: parseFloat(formState.odometerValue),
//       },
//     };
//   };

//   // ─── Online submission ────────────────────────────────────
//   const submitOnline = async () => {
//     const inspectionNo = (recentInspection?.inspectionNo ?? 0) + 1;

//     // Step 1: Upload any local/error photos to S3
//     const s3PhotoKeys = await uploadLocalPhotos(inspectionNo);

//     // Step 2: Build payload with real S3 keys
//     const payload = buildPayload(s3PhotoKeys);

//     // Step 3: Update fleet km
//     await updateFleetKm(payload.fleetKmUpdate).unwrap();

//     // Step 4: Save inspection record
//     await createInspection({ input: payload.inspectionData }).unwrap();

//     // Step 5: Create ClickUp task
//     const taskResponse = await Vif_clickUpService.createTask(
//       payload.clickUpPayload,
//     );
//     if (!taskResponse.success) {
//       throw new Error(taskResponse.message || "Failed to create ClickUp task");
//     }

//     // Step 6: Attach photos to ClickUp task
//     const taskId = String(taskResponse.taskId);
//     for (let i = 0; i < payload.clickUpPhotos.length; i++) {
//       const result = await uploadPhoto({
//         photo: payload.clickUpPhotos[i],
//         taskId,
//       });
//       if (!result?.success) throw new Error(`Failed to attach photo ${i + 1}`);
//     }
//   };

//   // ─── Offline: queue everything in SQLite ─────────────────
//   const queueOffline = async () => {
//     const inspectionNo = (recentInspection?.inspectionNo ?? 0) + 1;

//     // Store local URIs — sync engine will upload to S3 when online
//     const photoUris = formState.photos.map((p, i) => ({
//       uri: p.uri,
//       name: `photo_${i + 1}.jpg`,
//       type: "image/jpeg",
//       s3Key: p.s3Key || "", // may already have key if uploaded before going offline
//       status: p.status,
//     }));

//     const payload = buildPayload(
//       formState.photos.filter((p) => p.s3Key).map((p) => p.s3Key),
//     );

//     await enqueue("vif", {
//       ...payload,
//       photoUris, // raw URIs for sync engine to upload
//       vehicleReg: formState.selectedVehicleReg,
//       inspectionNo,
//     });
//   };

//   // ─── handleSubmit ─────────────────────────────────────────
//   const handleSubmit = async () => {
//     setSubmitting(true);
//     try {
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

//       const net = await NetInfo.fetch();
//       const online = !!(net.isConnected && net.isInternetReachable);

//       if (online) {
//         if (formState.photos.some((p) => p.status === "uploading")) {
//           dispatch(
//             showResponseModal({
//               successful: false,
//               message: "Please wait for photos to finish uploading",
//             }),
//           );
//           return;
//         }
//         await submitOnline();
//         dispatch(
//           showResponseModal({
//             successful: true,
//             message: "Inspection submitted successfully!",
//           }),
//         );
//       } else {
//         await queueOffline();
//         dispatch(
//           showResponseModal({
//             successful: true,
//             message:
//               "No network — saved offline. Will submit automatically when back online.",
//           }),
//         );
//       }

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
//     cardContent: { padding: 16, gap: 20, paddingBottom: 32 },
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
//     offlineBadge: {
//       flexDirection: "row",
//       alignItems: "center",
//       justifyContent: "center",
//       gap: 6,
//       paddingVertical: 6,
//       paddingHorizontal: 12,
//       backgroundColor: theme.colors.warning + "20",
//       borderRadius: theme.radius.md,
//       borderWidth: 0.5,
//       borderColor: theme.colors.warning + "40",
//     },
//     offlineBadgeText: {
//       fontSize: 12,
//       color: theme.colors.warning,
//       fontWeight: "500",
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
//             {/* Offline indicator */}
//             {!isOnline && (
//               <View style={styles.offlineBadge}>
//                 <ThemedText style={styles.offlineBadgeText}>
//                   ⚡ Offline — form will be saved and submitted when back online
//                 </ThemedText>
//               </View>
//             )}

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
//                   {isOnline ? "Submit Inspection" : "Save Offline"}
//                 </ThemedText>
//               )}
//             </TouchableOpacity>
//           </View>
//         </View>
//       </CustomScrollView>

//       <ResponseModal
//         visible={responseModal.visible}
//         successful={responseModal.successful}
//         message={responseModal.message}
//         onClose={() => dispatch(hideResponseModal())}
//       />
//     </NonTabScreen>
//   );
// }

// components/viFComponents/VehicleInspectionForm.tsx
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
  updatePhotoStatus,
} from "@/src/state";
import {
  useCreateInspectionMutation,
  useGetInspectionsByFleetQuery,
  useListFleetsQuery,
  useUpdateFleetKmMutation,
} from "@/src/state/api";
import { useAppDispatch, useAppSelector } from "@/src/state/redux";
import NetInfo from "@react-native-community/netinfo";
import { uploadData } from "aws-amplify/storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

// ─── S3 helpers ───────────────────────────────────────────────
const cleanVehicleReg = (reg: string): string =>
  reg.replace(/[^a-zA-Z0-9]/g, "-");

const randomString = (length = 8): string =>
  Math.random()
    .toString(36)
    .substring(2, 2 + length);

const generateS3Key = (
  vehicleReg: string,
  inspectionNo: number,
  index: number,
): string =>
  `inspections/${cleanVehicleReg(vehicleReg)}/${inspectionNo}/${Date.now()}-${index}-${randomString()}.jpg`;

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
  const [isOnline, setIsOnline] = useState(true);

  // ─── Track network reactively ─────────────────────────────
  useEffect(() => {
    // Fetch immediately on mount so banner reflects real state right away
    NetInfo.fetch().then((state) => {
      const online = !!(
        state.isConnected && state.isInternetReachable !== false
      );
      console.log(
        `[VIF] Initial — connected: ${state.isConnected}, reachable: ${state.isInternetReachable}, isOnline: ${online}`,
      );
      setIsOnline(online);
    });
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!(
        state.isConnected && state.isInternetReachable !== false
      );
      console.log(
        `[VIF] Change — connected: ${state.isConnected}, reachable: ${state.isInternetReachable}, isOnline: ${online}`,
      );
      setIsOnline(online);
    });
    return () => unsub();
  }, []);

  // ─── Auto-fill from last inspection ──────────────────────
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

  // ─── canSubmit ────────────────────────────────────────────
  // Online:  need photos, none uploading
  // Offline: photos optional — inspectors may have no signal at all
  const photosReady = isOnline
    ? formState.photos.length > 0 &&
      !formState.photos.some((p) => p.status === "uploading")
    : true;

  const canSubmit =
    !!formState.selectedVehicleId &&
    !!formState.odometerValue &&
    photosReady &&
    !formState.booleanQuestions.some((q) => q.value === null);

  // ─── Upload any "local" photos to S3 before submitting ────
  // Called only when online and submitting
  const uploadLocalPhotos = async (inspectionNo: number): Promise<string[]> => {
    const s3Keys: string[] = [];
    for (let i = 0; i < formState.photos.length; i++) {
      const photo = formState.photos[i];
      if (photo.status === "success" && photo.s3Key) {
        // Already uploaded
        s3Keys.push(photo.s3Key);
        continue;
      }
      if ((photo.status as string) === "local" || photo.status === "error") {
        // Upload now
        dispatch(
          updatePhotoStatus({
            id: photo.id,
            status: "uploading",
            error: undefined,
          }),
        );
        try {
          const response = await fetch(photo.uri);
          const blob = await response.blob();
          const s3Key = generateS3Key(
            formState.selectedVehicleReg,
            inspectionNo,
            i,
          );
          await uploadData({
            path: s3Key,
            data: blob,
            options: { contentType: "image/jpeg" },
          }).result;
          dispatch(
            updatePhotoStatus({
              id: photo.id,
              status: "success",
              s3Key,
              error: undefined,
            }),
          );
          s3Keys.push(s3Key);
        } catch (err) {
          dispatch(
            updatePhotoStatus({
              id: photo.id,
              status: "error",
              error: err instanceof Error ? err.message : "Upload failed",
            }),
          );
          // Don't throw — skip this photo and continue with the rest
        }
      }
    }
    return s3Keys;
  };

  // ─── Build payload ────────────────────────────────────────
  const buildPayload = (s3PhotoKeys: string[]) => {
    const inspectionNo = (recentInspection?.inspectionNo ?? 0) + 1;
    const timestamp = getJhbTimestamp();
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
      photoCount: s3PhotoKeys.length,
    };

    // Photos for ClickUp attachment
    const clickUpPhotos = formState.photos
      .filter((p) => p.status === "success")
      .map((p, i) => ({
        uri: p.uri,
        name: `photo_${i + 1}.jpg`,
        type: "image/jpeg",
      }));

    return {
      inspectionNo,
      inspectionData,
      clickUpPayload,
      clickUpPhotos,
      fleetKmUpdate: {
        id: formState.selectedVehicleId,
        currentkm: parseFloat(formState.odometerValue),
      },
    };
  };

  // ─── Online submission ────────────────────────────────────
  const submitOnline = async () => {
    const inspectionNo = (recentInspection?.inspectionNo ?? 0) + 1;

    // Step 1: Upload any local/error photos to S3
    const s3PhotoKeys = await uploadLocalPhotos(inspectionNo);

    // Step 2: Build payload with real S3 keys
    const payload = buildPayload(s3PhotoKeys);

    // Step 3: Update fleet km
    await updateFleetKm(payload.fleetKmUpdate).unwrap();

    // Step 4: Save inspection record
    await createInspection({ input: payload.inspectionData }).unwrap();

    // Step 5: Create ClickUp task
    const taskResponse = await Vif_clickUpService.createTask(
      payload.clickUpPayload,
    );
    if (!taskResponse.success) {
      throw new Error(taskResponse.message || "Failed to create ClickUp task");
    }

    // Step 6: Attach photos to ClickUp task
    const taskId = String(taskResponse.taskId);
    for (let i = 0; i < payload.clickUpPhotos.length; i++) {
      const result = await uploadPhoto({
        photo: payload.clickUpPhotos[i],
        taskId,
      });
      if (!result?.success) throw new Error(`Failed to attach photo ${i + 1}`);
    }
  };

  // ─── Offline: queue everything in SQLite ─────────────────
  const queueOffline = async () => {
    const inspectionNo = (recentInspection?.inspectionNo ?? 0) + 1;

    // Store local URIs — sync engine will upload to S3 when online
    const photoUris = formState.photos.map((p, i) => ({
      uri: p.uri,
      name: `photo_${i + 1}.jpg`,
      type: "image/jpeg",
      s3Key: p.s3Key || "", // may already have key if uploaded before going offline
      status: p.status,
    }));

    const payload = buildPayload(
      formState.photos.filter((p) => p.s3Key).map((p) => p.s3Key),
    );

    await enqueue("vif", {
      ...payload,
      photoUris, // raw URIs for sync engine to upload
      vehicleReg: formState.selectedVehicleReg,
      inspectionNo,
    });
  };

  // ─── handleSubmit ─────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
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

      const net = await NetInfo.fetch();
      const online = !!(net.isConnected && net.isInternetReachable);

      if (online) {
        if (formState.photos.some((p) => p.status === "uploading")) {
          dispatch(
            showResponseModal({
              successful: false,
              message: "Please wait for photos to finish uploading",
            }),
          );
          return;
        }
        await submitOnline();
        dispatch(
          showResponseModal({
            successful: true,
            message: "Inspection submitted successfully!",
          }),
        );
      } else {
        await queueOffline();
        dispatch(
          showResponseModal({
            successful: true,
            message:
              "No network — saved offline. Will submit automatically when back online.",
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
    cardContent: { padding: 16, gap: 20, paddingBottom: 32 },
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
    offlineBadge: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: theme.colors.warning + "20",
      borderRadius: theme.radius.md,
      borderWidth: 0.5,
      borderColor: theme.colors.warning + "40",
    },
    offlineBadgeText: {
      fontSize: 12,
      color: theme.colors.warning,
      fontWeight: "500",
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
            {/* Offline indicator */}
            {!isOnline && (
              <View style={styles.offlineBadge}>
                <ThemedText style={styles.offlineBadgeText}>
                  ⚡ Offline — form will be saved and submitted when back online
                </ThemedText>
              </View>
            )}

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
                  {isOnline ? "Submit Inspection" : "Save Offline"}
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
