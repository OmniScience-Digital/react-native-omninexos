// import { enqueue } from "@/services/submissionQueue";
// import {
//   ClockRecord,
//   ClockVerificationStatus,
//   CreateClockRecordInput,
//   UpdateClockRecordInput,
//   useCreateClockRecordMutation,
//   useUpdateClockRecordMutation,
// } from "@/src/state/api";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import NetInfo from "@react-native-community/netinfo";
// import * as Location from "expo-location";
// import { useCallback, useEffect, useRef, useState } from "react";
// import { useFaceVerification } from "./useFaceVerification";
// import { usePaginatedClockRecords } from "./usePaginatedClockRecords";

// export type { ClockRecord, ClockVerificationStatus };

// export type ClockStep =
//   | "idle"
//   | "verifying_face"
//   | "getting_location"
//   | "saving"
//   | "syncing";

// const ACTIVE_KEY = "attendance:active_record";
// const toDateStr = (d = new Date()) => d.toISOString().split("T")[0];
// const calcHours = (clockIn: string, clockOut: string) => {
//   const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime();
//   // Keep two decimal places so short shifts (e.g. 2 min = 0.03h) aren't
//   // rounded to 0.0 when displayed with toFixed(1).
//   return Math.round((ms / 3600000) * 100) / 100;
// };

// const getAddress = async (lat: number, lng: number): Promise<string> => {
//   try {
//     const [r] = await Location.reverseGeocodeAsync({
//       latitude: lat,
//       longitude: lng,
//     });
//     if (!r) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
//     return (
//       [r.name, r.street, r.city, r.region].filter(Boolean).join(", ") ||
//       `${lat.toFixed(5)}, ${lng.toFixed(5)}`
//     );
//   } catch {
//     return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
//   }
// };

// export function useClockIn(userId: string, employeeName: string) {
//   const [activeRecord, setActiveRecord] = useState<ClockRecord | null>(null);
//   const [locationPermission, setLocationPermission] = useState<boolean | null>(
//     null,
//   );
//   const [error, setError] = useState<string | null>(null);
//   const [recovering, setRecovering] = useState(true);
//   const [step, setStep] = useState<ClockStep>("idle");
//   const recoveryDone = useRef(false);

//   const [createClockRecord, { isLoading: creatingRecord }] =
//     useCreateClockRecordMutation();
//   const [updateClockRecord, { isLoading: updatingRecord }] =
//     useUpdateClockRecordMutation();

//   const { verify, verifying } = useFaceVerification(userId);

//   const {
//     items: history,
//     openShifts,
//     loading: loadingHistory,
//     fetchingMore,
//     loadMore,
//     hasMore,
//     patchItem: patchHistory,
//     refresh: refetchHistory,
//   } = usePaginatedClockRecords(userId, 10);

//   const isLoading = step !== "idle";

//   // ── Check location permission on mount and request if needed ──
//   useEffect(() => {
//     const checkLocation = async () => {
//       const { status } = await Location.getForegroundPermissionsAsync();
//       if (status === "granted") {
//         setLocationPermission(true);
//       } else {
//         setLocationPermission(false);
//       }
//     };
//     checkLocation();
//   }, []);

//   // ── Recover active record on mount ───────────────────────────
//   useEffect(() => {
//     if (recoveryDone.current || !userId || userId === "anonymous") return;
//     if (loadingHistory) return;

//     const recover = async () => {
//       setRecovering(true);
//       try {
//         const raw = await AsyncStorage.getItem(ACTIVE_KEY);
//         if (raw) {
//           const local: ClockRecord = JSON.parse(raw);
//           const serverMatch = history.find((r) => r.id === local.id);
//           if (serverMatch?.clockOutTime) {
//             await AsyncStorage.removeItem(ACTIVE_KEY);
//           } else {
//             setActiveRecord(local);
//             recoveryDone.current = true;
//             setRecovering(false);
//             return;
//           }
//         }
//         if (openShifts.length > 0) {
//           const open = openShifts[0];
//           await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(open));
//           setActiveRecord(open);
//         }
//       } catch {
//         // silent
//       } finally {
//         recoveryDone.current = true;
//         setRecovering(false);
//       }
//     };
//     recover();
//   }, [userId, loadingHistory, history, openShifts]);

//   // Cross-check: skip local_ IDs
//   useEffect(() => {
//     if (!activeRecord || activeRecord.id.startsWith("local_")) return;
//     const serverRecord = history.find((r) => r.id === activeRecord.id);
//     if (serverRecord?.clockOutTime) {
//       AsyncStorage.removeItem(ACTIVE_KEY);
//       setActiveRecord(null);
//     }
//   }, [history, activeRecord]);

//   // ── Get location (works offline) ────────────────────────────
//   const getLocation = useCallback(async () => {
//     // If permission not yet determined, request it now
//     let permissionGranted = locationPermission;
//     if (locationPermission === false) {
//       const { status } = await Location.requestForegroundPermissionsAsync();
//       const granted = status === "granted";
//       setLocationPermission(granted);
//       // Use the value we just resolved, not the (stale) `locationPermission`
//       // closure variable — setState doesn't apply until the next render, so
//       // re-reading `locationPermission` here would still see the old value
//       // and incorrectly bail out on the very first clock-in after granting
//       // permission.
//       permissionGranted = granted;
//       if (!granted) {
//         setError("Location permission required to record your work location.");
//         return null;
//       }
//     }
//     if (permissionGranted === false) return null;

//     try {
//       const loc = await Promise.race([
//         Location.getCurrentPositionAsync({
//           accuracy: Location.Accuracy.Balanced,
//         }),
//         new Promise<never>((_, reject) =>
//           setTimeout(() => reject(new Error("GPS fix timed out")), 8000),
//         ),
//       ]);
//       return loc.coords;
//     } catch (err: any) {
//       // Live GPS fix failed or timed out (common on some Android devices,
//       // especially indoors or on a cold start) — fall back to the device's
//       // last known position rather than giving up on location entirely.
//       console.warn("Live location error, trying last known position:", err);
//       try {
//         const lastKnown = await Location.getLastKnownPositionAsync({
//           maxAge: 5 * 60 * 1000, // accept a fix up to 5 min old
//         });
//         return lastKnown?.coords ?? null;
//       } catch (fallbackErr) {
//         console.warn("Last known location also unavailable:", fallbackErr);
//         return null;
//       }
//     }
//   }, [locationPermission]);

//   const checkOnline = useCallback(async (): Promise<boolean> => {
//     const state = await NetInfo.fetch();
//     return state.isConnected === true && state.isInternetReachable === true;
//   }, []);

//   // ── Clock In ─────────────────────────────────────────────────
//   const clockIn = useCallback(async (): Promise<ClockRecord | null> => {
//     if (step !== "idle") return null;
//     setError(null);

//     try {
//       setStep("verifying_face");
//       const faceResult = await verify();
//       if (faceResult === null) {
//         setStep("idle");
//         return null;
//       }

//       if (faceResult.status === "REVIEW_REQUIRED") {
//         setError(`Verification failed: ${faceResult.reason}`);
//         setStep("idle");
//         return null;
//       }

//       setStep("getting_location");
//       const [coords, online] = await Promise.all([
//         getLocation(),
//         checkOnline(),
//       ]);

//       // TEMP DEBUG — remove after diagnosing location issue
//       console.log(
//         "[ClockIn DEBUG] coords:",
//         coords,
//         "online:",
//         online,
//         "locationPermission:",
//         locationPermission,
//       );

//       const address = coords
//         ? online
//           ? await getAddress(coords.latitude, coords.longitude)
//           : `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
//         : undefined;

//       // TEMP DEBUG — remove after diagnosing location issue
//       console.log("[ClockIn DEBUG] resolved address:", address);

//       const now = new Date().toISOString();
//       const input: CreateClockRecordInput = {
//         userId,
//         employeeName,
//         clockInTime: now,
//         verificationStatus: faceResult.status,
//         syncedOffline: !online,
//         date: toDateStr(),
//         ...(coords && {
//           clockInLat: coords.latitude,
//           clockInLng: coords.longitude,
//         }),
//         ...(address && { clockInAddress: address }),
//         ...(faceResult.similarity > 0 && {
//           similarityScore: faceResult.similarity,
//         }),
//       };

//       // TEMP DEBUG — remove after diagnosing location issue
//       console.log("[ClockIn DEBUG] mutation input:", JSON.stringify(input));

//       setStep("saving");

//       if (!online) {
//         await enqueue("clockin", {
//           ...input,
//           localSelfieUri: (faceResult as any).localSelfieUri ?? null,
//         });
//         const localRecord: ClockRecord = {
//           ...input,
//           id: `local_${Date.now()}`,
//           createdAt: now,
//         };
//         await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(localRecord));
//         setActiveRecord(localRecord);
//         setStep("idle");
//         return localRecord;
//       }

//       const result = await createClockRecord(input).unwrap();
//       await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(result));
//       setActiveRecord(result);
//       refetchHistory();
//       setStep("idle");
//       return result;
//     } catch (e: any) {
//       console.error("[clockIn] failed:", e);
//       setError(e?.message ?? "Failed to clock in");
//       setStep("idle");
//       return null;
//     }
//   }, [
//     step,
//     userId,
//     employeeName,
//     getLocation,
//     checkOnline,
//     createClockRecord,
//     refetchHistory,
//     verify,
//   ]);

//   // ── Clock Out ────────────────────────────────────────────────
//   const clockOut = useCallback(
//     async (recordToClose?: ClockRecord): Promise<ClockRecord | null> => {
//       const target = recordToClose ?? activeRecord;
//       if (!target) {
//         setError("No active clock-in found");
//         return null;
//       }
//       if (step !== "idle") return null;

//       setError(null);

//       try {
//         setStep("verifying_face");
//         const faceResult = await verify();
//         if (faceResult === null) {
//           setStep("idle");
//           return null;
//         }

//         setStep("getting_location");
//         const [coords, online] = await Promise.all([
//           getLocation(),
//           checkOnline(),
//         ]);

//         if (online && faceResult.status !== "VERIFIED") {
//           setError(`Verification failed: ${faceResult.reason}`);
//           setStep("idle");
//           return null;
//         }

//         const address = coords
//           ? online
//             ? await getAddress(coords.latitude, coords.longitude)
//             : `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
//           : undefined;

//         const now = new Date().toISOString();
//         const hoursWorked = calcHours(target.clockInTime, now);

//         const input: UpdateClockRecordInput = {
//           id: target.id,
//           clockOutTime: now,
//           hoursWorked,
//           ...(coords && {
//             clockOutLat: coords.latitude,
//             clockOutLng: coords.longitude,
//           }),
//           ...(address && { clockOutAddress: address }),
//         };

//         setStep("saving");

//         if (!online || target.id.startsWith("local_")) {
//           const enqueuePayload = {
//             ...input,
//             userId,
//             originalClockIn: target,
//             localSelfieUri: (faceResult as any).localSelfieUri ?? null,
//           };
//           // surface what we're about to queue so it's visible on device
//           setError(
//             `[ENQUEUE] id:${input.id} | clockOutTime:${input.clockOutTime} | hrs:${input.hoursWorked}`,
//           );
//           await enqueue("clockout", enqueuePayload);
//           const closedRecord = {
//             ...target,
//             ...input,
//             syncedOffline: true,
//           } as ClockRecord;
//           // Optimistically patch the history item locally so the UI shows the
//           // shift as closed immediately — no server fetch needed (server doesn't
//           // have the clockOut yet; it will sync when connection returns).
//           patchHistory(target.id, {
//             clockOutTime: input.clockOutTime,
//             hoursWorked: input.hoursWorked,
//             syncedOffline: true,
//           });
//           if (!recordToClose) {
//             await AsyncStorage.removeItem(ACTIVE_KEY);
//             setActiveRecord(null);
//           }
//           setStep("idle");
//           return closedRecord;
//         }

//         const result = await updateClockRecord(input).unwrap();
//         if (!recordToClose) {
//           await AsyncStorage.removeItem(ACTIVE_KEY);
//           setActiveRecord(null);
//         }
//         refetchHistory();
//         setStep("idle");
//         return result;
//       } catch (e: any) {
//         console.error("[clockOut] failed:", e);
//         setError(e?.message ?? "Failed to clock out");
//         setStep("idle");
//         return null;
//       }
//     },
//     [
//       step,
//       activeRecord,
//       userId,
//       getLocation,
//       checkOnline,
//       updateClockRecord,
//       patchHistory,
//       refetchHistory,
//       verify,
//     ],
//   );

//   const clearError = useCallback(() => setError(null), []);

//   const stepLabel: string = {
//     idle: "",
//     verifying_face: "Verifying face…",
//     getting_location: "Getting location…",
//     saving: "Saving…",
//     syncing: "Syncing…",
//   }[step];

//   return {
//     activeRecord,
//     history,
//     openShifts,
//     isClockedIn: !!activeRecord,
//     isLoading,
//     step,
//     stepLabel,
//     loadingHistory,
//     fetchingMore,
//     loadMore,
//     hasMore,
//     recovering,
//     locationPermission,
//     error,
//     clearError,
//     clockIn,
//     clockOut,
//     refetchHistory,
//   };
// }

import { enqueue } from "@/services/submissionQueue";
import {
  ClockRecord,
  ClockVerificationStatus,
  CreateClockRecordInput,
  UpdateClockRecordInput,
  useCreateClockRecordMutation,
  useUpdateClockRecordMutation,
} from "@/src/state/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFaceVerification } from "./useFaceVerification";
import { usePaginatedClockRecords } from "./usePaginatedClockRecords";

export type { ClockRecord, ClockVerificationStatus };

export type ClockStep =
  | "idle"
  | "verifying_face"
  | "getting_location"
  | "saving"
  | "syncing";

const ACTIVE_KEY = "attendance:active_record";
const toDateStr = (d = new Date()) => d.toISOString().split("T")[0];
const calcHours = (clockIn: string, clockOut: string) => {
  const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  // Keep two decimal places so short shifts (e.g. 2 min = 0.03h) aren't
  // rounded to 0.0 when displayed with toFixed(1).
  return Math.round((ms / 3600000) * 100) / 100;
};

const getAddress = async (lat: number, lng: number): Promise<string> => {
  try {
    const [r] = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lng,
    });
    if (!r) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    return (
      [r.name, r.street, r.city, r.region].filter(Boolean).join(", ") ||
      `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    );
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
};

export function useClockIn(userId: string, employeeName: string) {
  const [activeRecord, setActiveRecord] = useState<ClockRecord | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(true);
  const [step, setStep] = useState<ClockStep>("idle");
  const recoveryDone = useRef(false);

  const [createClockRecord, { isLoading: creatingRecord }] =
    useCreateClockRecordMutation();
  const [updateClockRecord, { isLoading: updatingRecord }] =
    useUpdateClockRecordMutation();

  const { verify, verifying } = useFaceVerification(userId);

  const {
    items: history,
    openShifts,
    loading: loadingHistory,
    fetchingMore,
    loadMore,
    hasMore,
    patchItem: patchHistory,
    refresh: refetchHistory,
  } = usePaginatedClockRecords(userId, 10);

  const isLoading = step !== "idle";

  // ── Check location permission on mount and request if needed ──
  useEffect(() => {
    const checkLocation = async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        setLocationPermission(true);
      } else {
        setLocationPermission(false);
      }
    };
    checkLocation();
  }, []);

  // ── Recover active record on mount ───────────────────────────
  useEffect(() => {
    if (recoveryDone.current || !userId || userId === "anonymous") return;
    if (loadingHistory) return;

    const recover = async () => {
      setRecovering(true);
      try {
        const raw = await AsyncStorage.getItem(ACTIVE_KEY);
        if (raw) {
          const local: ClockRecord = JSON.parse(raw);
          const serverMatch = history.find((r) => r.id === local.id);
          if (serverMatch?.clockOutTime) {
            await AsyncStorage.removeItem(ACTIVE_KEY);
          } else {
            setActiveRecord(local);
            recoveryDone.current = true;
            setRecovering(false);
            return;
          }
        }
        if (openShifts.length > 0) {
          const open = openShifts[0];
          await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(open));
          setActiveRecord(open);
        }
      } catch {
        // silent
      } finally {
        recoveryDone.current = true;
        setRecovering(false);
      }
    };
    recover();
  }, [userId, loadingHistory, history, openShifts]);

  // Cross-check: skip local_ IDs
  useEffect(() => {
    if (!activeRecord || activeRecord.id.startsWith("local_")) return;
    const serverRecord = history.find((r) => r.id === activeRecord.id);
    if (serverRecord?.clockOutTime) {
      AsyncStorage.removeItem(ACTIVE_KEY);
      setActiveRecord(null);
    }
  }, [history, activeRecord]);

  // ── Get location (works offline) ────────────────────────────
  const getLocation = useCallback(async () => {
    // If permission not yet determined, request it now
    let permissionGranted = locationPermission;
    if (locationPermission === false) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === "granted";
      setLocationPermission(granted);
      // Use the value we just resolved, not the (stale) `locationPermission`
      // closure variable — setState doesn't apply until the next render, so
      // re-reading `locationPermission` here would still see the old value
      // and incorrectly bail out on the very first clock-in after granting
      // permission.
      permissionGranted = granted;
      if (!granted) {
        setError("Location permission required to record your work location.");
        return null;
      }
    }
    if (permissionGranted === false) return null;

    try {
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("GPS fix timed out")), 8000),
        ),
      ]);
      return loc.coords;
    } catch (err: any) {
      // Live GPS fix failed or timed out (common on some Android devices,
      // especially indoors or on a cold start) — fall back to the device's
      // last known position rather than giving up on location entirely.
      console.warn("Live location error, trying last known position:", err);
      try {
        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 5 * 60 * 1000, // accept a fix up to 5 min old
        });
        return lastKnown?.coords ?? null;
      } catch (fallbackErr) {
        console.warn("Last known location also unavailable:", fallbackErr);
        return null;
      }
    }
  }, [locationPermission]);

  const checkOnline = useCallback(async (): Promise<boolean> => {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable === true;
  }, []);

  // ── Clock In ─────────────────────────────────────────────────
  const clockIn = useCallback(async (): Promise<ClockRecord | null> => {
    if (step !== "idle") return null;
    setError(null);

    try {
      setStep("verifying_face");
      const faceResult = await verify();
      if (faceResult === null) {
        setStep("idle");
        return null;
      }

      if (faceResult.status === "REVIEW_REQUIRED") {
        setError(`Verification failed: ${faceResult.reason}`);
        setStep("idle");
        return null;
      }

      setStep("getting_location");
      const [coords, online] = await Promise.all([
        getLocation(),
        checkOnline(),
      ]);

      const address = coords
        ? online
          ? await getAddress(coords.latitude, coords.longitude)
          : `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
        : undefined;

      const now = new Date().toISOString();
      const input: CreateClockRecordInput = {
        userId,
        employeeName,
        clockInTime: now,
        verificationStatus: faceResult.status,
        syncedOffline: !online,
        date: toDateStr(),
        ...(coords && {
          clockInLat: coords.latitude,
          clockInLng: coords.longitude,
        }),
        ...(address && { clockInAddress: address }),
        ...(faceResult.similarity > 0 && {
          similarityScore: faceResult.similarity,
        }),
      };

      setStep("saving");

      if (!online) {
        await enqueue("clockin", {
          ...input,
          localSelfieUri: (faceResult as any).localSelfieUri ?? null,
        });
        const localRecord: ClockRecord = {
          ...input,
          id: `local_${Date.now()}`,
          createdAt: now,
        };
        await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(localRecord));
        setActiveRecord(localRecord);
        setStep("idle");
        return localRecord;
      }

      const result = await createClockRecord(input).unwrap();
      await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(result));
      setActiveRecord(result);
      refetchHistory();
      setStep("idle");
      return result;
    } catch (e: any) {
      console.error("[clockIn] failed:", e);
      setError(e?.message ?? "Failed to clock in");
      setStep("idle");
      return null;
    }
  }, [
    step,
    userId,
    employeeName,
    getLocation,
    checkOnline,
    createClockRecord,
    refetchHistory,
    verify,
  ]);

  // ── Clock Out ────────────────────────────────────────────────
  const clockOut = useCallback(
    async (recordToClose?: ClockRecord): Promise<ClockRecord | null> => {
      const target = recordToClose ?? activeRecord;
      if (!target) {
        setError("No active clock-in found");
        return null;
      }
      if (step !== "idle") return null;

      setError(null);

      try {
        setStep("verifying_face");
        const faceResult = await verify();
        if (faceResult === null) {
          setStep("idle");
          return null;
        }

        setStep("getting_location");
        const [coords, online] = await Promise.all([
          getLocation(),
          checkOnline(),
        ]);

        if (online && faceResult.status !== "VERIFIED") {
          setError(`Verification failed: ${faceResult.reason}`);
          setStep("idle");
          return null;
        }

        const address = coords
          ? online
            ? await getAddress(coords.latitude, coords.longitude)
            : `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
          : undefined;

        const now = new Date().toISOString();
        const hoursWorked = calcHours(target.clockInTime, now);

        const input: UpdateClockRecordInput = {
          id: target.id,
          clockOutTime: now,
          hoursWorked,
          ...(coords && {
            clockOutLat: coords.latitude,
            clockOutLng: coords.longitude,
          }),
          ...(address && { clockOutAddress: address }),
        };

        setStep("saving");

        if (!online || target.id.startsWith("local_")) {
          const enqueuePayload = {
            ...input,
            userId,
            originalClockIn: target,
            localSelfieUri: (faceResult as any).localSelfieUri ?? null,
          };
          await enqueue("clockout", enqueuePayload);
          const closedRecord = {
            ...target,
            ...input,
            syncedOffline: true,
          } as ClockRecord;
          // Optimistically patch the history item locally so the UI shows the
          // shift as closed immediately — no server fetch needed (server doesn't
          // have the clockOut yet; it will sync when connection returns).
          patchHistory(target.id, {
            clockOutTime: input.clockOutTime,
            hoursWorked: input.hoursWorked,
            syncedOffline: true,
          });
          if (!recordToClose) {
            await AsyncStorage.removeItem(ACTIVE_KEY);
            setActiveRecord(null);
          }
          setStep("idle");
          return closedRecord;
        }

        const result = await updateClockRecord(input).unwrap();
        if (!recordToClose) {
          await AsyncStorage.removeItem(ACTIVE_KEY);
          setActiveRecord(null);
        }
        refetchHistory();
        setStep("idle");
        return result;
      } catch (e: any) {
        console.error("[clockOut] failed:", e);
        setError(e?.message ?? "Failed to clock out");
        setStep("idle");
        return null;
      }
    },
    [
      step,
      activeRecord,
      userId,
      getLocation,
      checkOnline,
      updateClockRecord,
      patchHistory,
      refetchHistory,
      verify,
    ],
  );

  const clearError = useCallback(() => setError(null), []);

  const stepLabel: string = {
    idle: "",
    verifying_face: "Verifying face…",
    getting_location: "Getting location…",
    saving: "Saving…",
    syncing: "Syncing…",
  }[step];

  return {
    activeRecord,
    history,
    openShifts,
    isClockedIn: !!activeRecord,
    isLoading,
    step,
    stepLabel,
    loadingHistory,
    fetchingMore,
    loadMore,
    hasMore,
    recovering,
    locationPermission,
    error,
    clearError,
    clockIn,
    clockOut,
    refetchHistory,
  };
}
