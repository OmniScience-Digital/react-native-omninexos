import { NonTabScreen } from "@/components/screens/non-tab-screen";
import { ThemedText } from "@/components/screens/screen";
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
  useLazyGetInspectionsByFleetQuery,
  useListFleetsQuery,
  useUpdateFleetKmMutation,
} from "@/src/state/api";
import { useAppDispatch, useAppSelector } from "@/src/state/redux";
import NetInfo from "@react-native-community/netinfo";
import { uploadData } from "aws-amplify/storage";
import {
  copyAsync,
  documentDirectory,
  makeDirectoryAsync,
} from "expo-file-system/legacy";
import { useEffect, useRef, useState } from "react";
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

const persistPhotoLocally = async (
  uri: string,
  photoId: string,
): Promise<string> => {
  const dir = `${documentDirectory}offline_photos/`;
  await makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}${photoId}.jpg`;
  if (uri === dest) return dest;
  await copyAsync({ from: uri, to: dest });
  return dest;
};

export default function VehicleInspectionForm() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const dispatch = useAppDispatch();

  const { data: vehicles = [], isLoading: vehiclesLoading } =
    useListFleetsQuery();
  const [createInspection] = useCreateInspectionMutation();
  const [fetchLatestInspection] = useLazyGetInspectionsByFleetQuery();
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
    NetInfo.fetch().then((state) => {
      const online = !!state.isConnected;
      console.log(
        `[VIF] Initial — connected: ${state.isConnected}, reachable: ${state.isInternetReachable}, isOnline: ${online}`,
      );
      setIsOnline(online);
    });
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected;
      console.log(
        `[VIF] Change — connected: ${state.isConnected}, reachable: ${state.isInternetReachable}, isOnline: ${online}`,
      );
      setIsOnline(online);
    });
    return () => unsub();
  }, []);

  // ─── Auto-fill from last inspection ──────────────────────
  // Runs when the vehicle changes, or when a NEWER inspection arrives while the
  // form is still exactly what we auto-filled. Background refetches (app
  // foreground, realtime sync) must never overwrite answers the inspector has
  // already changed.
  const formRef = useRef(formState);
  formRef.current = formState;
  const autofillRef = useRef<{
    vehicleId: string;
    inspectionId: string;
    odometer: string;
    answers: (boolean | null)[];
  } | null>(null);

  useEffect(() => {
    const vehicleId = formState.selectedVehicleId;
    if (!vehicleId) {
      autofillRef.current = null; // form was reset
      return;
    }
    if (!recentInspection?.odometerStart) return;

    const prev = autofillRef.current;
    if (prev && prev.vehicleId === vehicleId) {
      if (prev.inspectionId === recentInspection.id) return; // nothing new
      const current = formRef.current;
      const untouched =
        current.odometerValue === prev.odometer &&
        current.booleanQuestions.every((q, i) => q.value === prev.answers[i]);
      if (!untouched) return; // inspector already edited – keep their answers
    }

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
    const odometer = recentInspection.odometerStart.toString();
    dispatch(setOdometer(odometer));
    const answers = formRef.current.booleanQuestions.map((q) => q.value);
    fieldNames.forEach((field, idx) => {
      const value = (recentInspection as any)[field];
      if (value !== undefined && value !== null) {
        dispatch(setBooleanAnswer({ index: idx, value }));
        answers[idx] = value;
      }
    });
    autofillRef.current = {
      vehicleId,
      inspectionId: recentInspection.id,
      odometer,
      answers,
    };
  }, [recentInspection, formState.selectedVehicleId, dispatch]);

  // ─── Pull-to-refresh — just refetch data, sync engine handles queue ──
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchFleets(),
        formState.selectedVehicleId
          ? refetchRecentInspection()
          : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const vehiclesForForm = vehicles
    .filter((v) => v.vehicleReg !== null && v.vehicleVin !== null)
    .map((v) => ({
      id: v.id,
      vehicleReg: v.vehicleReg as string,
      vehicleVin: v.vehicleVin as string,
    }));

  const photosReady = isOnline
    ? formState.photos.length > 0 &&
      !formState.photos.some((p) => p.status === "uploading")
    : true;

  const canSubmit =
    !!formState.selectedVehicleId &&
    !!formState.odometerValue &&
    photosReady &&
    !formState.booleanQuestions.some((q) => q.value === null);

  // What the inspector still has to provide (same rules as canSubmit).
  const getMissingItems = (): string[] => {
    const missing: string[] = [];
    if (!formState.selectedVehicleId) missing.push("Select a vehicle");
    if (!formState.odometerValue) missing.push("Provide vehicle mileage");
    if (formState.booleanQuestions.some((q) => q.value === null)) {
      missing.push(
        `Answer all ${formState.booleanQuestions.length} inspection questions`,
      );
    }
    if (isOnline) {
      if (formState.photos.length === 0) {
        missing.push("Upload inspection photos");
      } else if (formState.photos.some((p) => p.status === "uploading")) {
        missing.push("Wait for photos to finish uploading");
      }
    }
    return missing;
  };

  const missingMessage = (missing: string[]): string => {
    if (missing.length === 1) {
      const item = missing[0];
      return `Please ${item.charAt(0).toLowerCase()}${item.slice(1)}.`;
    }
    return `Please complete the following:\n${missing
      .map((m) => `• ${m}`)
      .join("\n")}`;
  };

  const uploadLocalPhotos = async (inspectionNo: number): Promise<string[]> => {
    const s3Keys: string[] = [];
    for (let i = 0; i < formState.photos.length; i++) {
      const photo = formState.photos[i];
      if (photo.status === "success" && photo.s3Key) {
        s3Keys.push(photo.s3Key);
        continue;
      }
      if ((photo.status as string) === "local" || photo.status === "error") {
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
        }
      }
    }
    return s3Keys;
  };

  const buildPayload = (
    s3PhotoKeys: string[],
    inspectionNo: number,
    fleets: Fleet[] = vehicles,
  ) => {
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

    const customFields = calculateCustomFields(formState, fleets, timestamp);

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

  const submitOnline = async (): Promise<"submitted" | "queued"> => {
    // Never number an inspection from the cache: the web app or another phone
    // may have added one since. Ask the server, exactly as the sync engine does
    // for queued items (getLatestInspectionNo).
    let latestNo: number;
    try {
      const latest = await fetchLatestInspection({
        fleetId: formState.selectedVehicleId,
        sortDirection: "DESC",
        limit: 1,
      }).unwrap();
      latestNo = latest?.[0]?.inspectionNo ?? 0;
    } catch (e: any) {
      if (e?.status !== "FETCH_ERROR") throw e;
      // "Connected" but the server can't be reached, and nothing has been
      // written yet – safe to fall back to the offline queue.
      await queueOffline();
      return "queued";
    }
    const inspectionNo = latestNo + 1;

    // "Service required" / "Tyre rotation required" depend on the vehicle's
    // last service / rotation km. Use the server's current copy, not whatever
    // the phone cached (e.g. a rotation km edited on the web since the last
    // sync). If it can't be fetched, fall back to the cached copy.
    let fleetsForFlags = vehicles;
    try {
      const fresh = await refetchFleets().unwrap();
      if (fresh?.length) fleetsForFlags = fresh;
    } catch {}

    const s3PhotoKeys = await uploadLocalPhotos(inspectionNo);
    const payload = buildPayload(s3PhotoKeys, inspectionNo, fleetsForFlags);

    await updateFleetKm(payload.fleetKmUpdate).unwrap();
    await createInspection({ input: payload.inspectionData }).unwrap();

    const taskResponse = await Vif_clickUpService.createTask(
      payload.clickUpPayload,
    );
    if (!taskResponse.success) {
      throw new Error(taskResponse.message || "Failed to create ClickUp task");
    }

    const taskId = String(taskResponse.taskId);
    for (let i = 0; i < payload.clickUpPhotos.length; i++) {
      const result = await uploadPhoto({
        photo: payload.clickUpPhotos[i],
        taskId,
      });
      if (!result?.success) throw new Error(`Failed to attach photo ${i + 1}`);
    }
    return "submitted";
  };

  const queueOffline = async () => {
    const inspectionNo = (recentInspection?.inspectionNo ?? 0) + 1;

    const photoUris: Array<{
      uri: string;
      name: string;
      type: string;
      s3Key: string;
      status: string;
    }> = [];

    for (let i = 0; i < formState.photos.length; i++) {
      const p = formState.photos[i];
      let persistedUri = p.uri;
      try {
        persistedUri = await persistPhotoLocally(p.uri, p.id);
      } catch (err) {
        console.warn(
          `[VIF] Could not persist photo ${i + 1} locally, using original URI:`,
          err,
        );
      }
      photoUris.push({
        uri: persistedUri,
        name: `photo_${i + 1}.jpg`,
        type: "image/jpeg",
        s3Key: p.s3Key || "",
        status: p.status,
      });
    }

    const payload = buildPayload(
      formState.photos.filter((p) => p.s3Key).map((p) => p.s3Key),
      inspectionNo, // provisional – the sync engine re-derives it from the server
    );

    try {
      await enqueue("vif", {
        ...payload,
        photoUris,
        vehicleReg: formState.selectedVehicleReg,
        inspectionNo,
      });
    } catch (err) {
      console.error("Failed to queue offline submission", err);
      dispatch(
        showResponseModal({
          successful: false,
          message: "Could not save offline data. Please try again.",
        }),
      );
      throw err;
    }
  };

  const handleSubmit = async () => {
    const missing = getMissingItems();
    if (missing.length > 0) {
      dispatch(
        showResponseModal({
          successful: false,
          message: missingMessage(missing),
        }),
      );
      return;
    }

    setSubmitting(true);
    try {
      const net = await NetInfo.fetch();
      const online = !!net.isConnected;

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
        const outcome = await submitOnline();
        dispatch(
          showResponseModal({
            successful: true,
            message:
              outcome === "queued"
                ? "Couldn't reach the server — saved offline. Will submit automatically when back online."
                : "Inspection submitted successfully!",
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <CustomScrollView>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>
              Vehicle Inspection Form
            </ThemedText>
          </View>
          <View style={styles.cardContent}>
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
              disabled={submitting}
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
