// // hooks/useClockIn.ts
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

// const ACTIVE_KEY = "attendance:active_record";
// const toDateStr = (d = new Date()) => d.toISOString().split("T")[0];
// const calcHours = (clockIn: string, clockOut: string) =>
//   Math.round(
//     ((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3600000) *
//       100,
//   ) / 100;

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

// // ─────────────────────────────────────────────────────────────────────────────

// export function useClockIn(userId: string, employeeName: string) {
//   const [activeRecord, setActiveRecord] = useState<ClockRecord | null>(null);
//   const [locationPermission, setLocationPermission] = useState<boolean | null>(
//     null,
//   );
//   const [error, setError] = useState<string | null>(null);
//   const [recovering, setRecovering] = useState(true);
//   const recoveryDone = useRef(false);

//   // ── RTK mutations ─────────────────────────────────────────────────────────
//   const [createClockRecord, { isLoading: creatingRecord }] =
//     useCreateClockRecordMutation();
//   const [updateClockRecord, { isLoading: updatingRecord }] =
//     useUpdateClockRecordMutation();

//   // ── Face verification ────────────────────────────────────────────────────
//   const { verify, verifying } = useFaceVerification(userId);

//   // ── Paginated history — same pattern as usePaginatedInspections ───────────
//   const {
//     items: history,
//     openShifts,
//     loading: loadingHistory,
//     fetchingMore,
//     loadMore,
//     hasMore,
//     refresh: refetchHistory,
//   } = usePaginatedClockRecords(userId, 20);

//   const isLoading = creatingRecord || updatingRecord || verifying;

//   // ── Recover active record on mount ───────────────────────────────────────
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
//         // Recovery failed silently
//       } finally {
//         recoveryDone.current = true;
//         setRecovering(false);
//       }
//     };

//     recover();
//   }, [userId, loadingHistory, history, openShifts]);

//   // ── Cross-check: if active record was closed on another device ────────────
//   useEffect(() => {
//     if (!activeRecord || activeRecord.id.startsWith("local_")) return;
//     const serverRecord = history.find((r) => r.id === activeRecord.id);
//     if (serverRecord?.clockOutTime) {
//       AsyncStorage.removeItem(ACTIVE_KEY);
//       setActiveRecord(null);
//     }
//   }, [history, activeRecord]);

//   // ── Location permission ───────────────────────────────────────────────────
//   useEffect(() => {
//     Location.requestForegroundPermissionsAsync().then(({ status }) => {
//       setLocationPermission(status === "granted");
//     });
//   }, []);

//   const getLocation = useCallback(async () => {
//     if (!locationPermission) return null;
//     try {
//       const loc = await Location.getCurrentPositionAsync({
//         accuracy: Location.Accuracy.Balanced,
//       });
//       return loc.coords;
//     } catch {
//       return null;
//     }
//   }, [locationPermission]);

//   const isOnline = useCallback(async (): Promise<boolean> => {
//     const state = await NetInfo.fetch();
//     return state.isConnected === true && state.isInternetReachable !== false;
//   }, []);

//   // ── Clock In ──────────────────────────────────────────────────────────────
//   const clockIn = useCallback(async () => {
//     setError(null);
//     try {
//       const faceResult = await verify();
//       if (faceResult === null) return null;

//       // Block clock-in if not verified
//       if (faceResult.status !== "VERIFIED") {
//         setError(`Verification failed: ${faceResult.reason}`);
//         return null;
//       }

//       // Get location and network status
//       const [coords, online] = await Promise.all([getLocation(), isOnline()]);

//       const now = new Date().toISOString();
//       const address = coords
//         ? await getAddress(coords.latitude, coords.longitude)
//         : undefined;

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

//       if (!online) {
//         await enqueue("clockin" as any, input);
//         const localRecord: ClockRecord = {
//           ...input,
//           id: `local_${Date.now()}`,
//           createdAt: now,
//         };
//         await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(localRecord));
//         setActiveRecord(localRecord);
//         return localRecord;
//       }

//       const result = await createClockRecord(input).unwrap();
//       await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(result));
//       setActiveRecord(result);
//       refetchHistory();
//       return result;
//     } catch (e: any) {
//       setError(e?.message ?? "Failed to clock in");
//       return null;
//     }
//   }, [
//     userId,
//     employeeName,
//     getLocation,
//     isOnline,
//     createClockRecord,
//     refetchHistory,
//     verify,
//   ]);

//   // ── Clock Out ─────────────────────────────────────────────────────────────
//   const clockOut = useCallback(
//     async (recordToClose?: ClockRecord) => {
//       const target = recordToClose ?? activeRecord;
//       if (!target) {
//         setError("No active clock-in found");
//         return null;
//       }
//       setError(null);
//       try {
//         const faceResult = await verify();
//         if (faceResult === null) return null;

//         if (faceResult.status !== "VERIFIED") {
//           setError(`Verification failed: ${faceResult.reason}`);
//           return null;
//         }

//         const [coords, online] = await Promise.all([getLocation(), isOnline()]);

//         const now = new Date().toISOString();
//         const address = coords
//           ? await getAddress(coords.latitude, coords.longitude)
//           : undefined;
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

//         if (!online || target.id.startsWith("local_")) {
//           await enqueue("clockout" as any, {
//             ...input,
//             originalClockIn: target,
//           });
//           if (!recordToClose) {
//             await AsyncStorage.removeItem(ACTIVE_KEY);
//             setActiveRecord(null);
//           }
//           refetchHistory();
//           return { ...target, ...input, syncedOffline: true } as ClockRecord;
//         }

//         const result = await updateClockRecord(input).unwrap();
//         if (!recordToClose) {
//           await AsyncStorage.removeItem(ACTIVE_KEY);
//           setActiveRecord(null);
//         }
//         refetchHistory();
//         return result;
//       } catch (e: any) {
//         setError(e?.message ?? "Failed to clock out");
//         return null;
//       }
//     },
//     [
//       activeRecord,
//       getLocation,
//       isOnline,
//       updateClockRecord,
//       refetchHistory,
//       verify,
//     ],
//   );

//   const clearError = useCallback(() => setError(null), []);

//   return {
//     activeRecord,
//     history,
//     openShifts,
//     isClockedIn: !!activeRecord,
//     isLoading,
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

// hooks/useClockIn.ts
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

const ACTIVE_KEY = "attendance:active_record";
const toDateStr = (d = new Date()) => d.toISOString().split("T")[0];
const calcHours = (clockIn: string, clockOut: string) =>
  Math.round(
    ((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3600000) *
      100,
  ) / 100;

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

// ─────────────────────────────────────────────────────────────────────────────

export function useClockIn(userId: string, employeeName: string) {
  const [activeRecord, setActiveRecord] = useState<ClockRecord | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(true);
  const recoveryDone = useRef(false);

  // ── RTK mutations ─────────────────────────────────────────────────────────
  const [createClockRecord, { isLoading: creatingRecord }] =
    useCreateClockRecordMutation();
  const [updateClockRecord, { isLoading: updatingRecord }] =
    useUpdateClockRecordMutation();

  // ── Face verification ────────────────────────────────────────────────────
  const { verify, verifying } = useFaceVerification(userId);

  // ── Paginated history — same pattern as usePaginatedInspections ───────────
  const {
    items: history,
    openShifts,
    loading: loadingHistory,
    fetchingMore,
    loadMore,
    hasMore,
    refresh: refetchHistory,
  } = usePaginatedClockRecords(userId, 20);

  const isLoading = creatingRecord || updatingRecord || verifying;

  // ── Recover active record on mount ───────────────────────────────────────
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
        // Recovery failed silently
      } finally {
        recoveryDone.current = true;
        setRecovering(false);
      }
    };

    recover();
  }, [userId, loadingHistory, history, openShifts]);

  // ── Cross-check: if active record was closed on another device ────────────
  useEffect(() => {
    if (!activeRecord || activeRecord.id.startsWith("local_")) return;
    const serverRecord = history.find((r) => r.id === activeRecord.id);
    if (serverRecord?.clockOutTime) {
      AsyncStorage.removeItem(ACTIVE_KEY);
      setActiveRecord(null);
    }
  }, [history, activeRecord]);

  // ── Location permission ───────────────────────────────────────────────────
  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      setLocationPermission(status === "granted");
    });
  }, []);

  const getLocation = useCallback(async () => {
    if (!locationPermission) return null;
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return loc.coords;
    } catch {
      return null;
    }
  }, [locationPermission]);

  const isOnline = useCallback(async (): Promise<boolean> => {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable !== false;
  }, []);

  // ── Clock In ──────────────────────────────────────────────────────────────
  const clockIn = useCallback(async () => {
    setError(null);
    try {
      const faceResult = await verify();
      if (faceResult === null) return null;

      // Block clock-in only on REVIEW_REQUIRED (active rejection), not PENDING
      if (faceResult.status === "REVIEW_REQUIRED") {
        setError(`Verification failed: ${faceResult.reason}`);
        return null;
      }

      // Get location and network status
      const [coords, online] = await Promise.all([getLocation(), isOnline()]);

      const now = new Date().toISOString();
      const address = coords
        ? await getAddress(coords.latitude, coords.longitude)
        : undefined;

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

      if (!online) {
        // Store selfie URI for later sync if we captured one offline
        const offlinePayload = {
          ...input,
          localSelfieUri: (faceResult as any).localSelfieUri ?? null,
        };
        await enqueue("clockin" as any, offlinePayload);
        const localRecord: ClockRecord = {
          ...input,
          id: `local_${Date.now()}`,
          createdAt: now,
        };
        await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(localRecord));
        setActiveRecord(localRecord);
        return localRecord;
      }

      const result = await createClockRecord(input).unwrap();
      await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(result));
      setActiveRecord(result);
      refetchHistory();
      return result;
    } catch (e: any) {
      setError(e?.message ?? "Failed to clock in");
      return null;
    }
  }, [
    userId,
    employeeName,
    getLocation,
    isOnline,
    createClockRecord,
    refetchHistory,
    verify,
  ]);

  // ── Clock Out ─────────────────────────────────────────────────────────────
  const clockOut = useCallback(
    async (recordToClose?: ClockRecord) => {
      const target = recordToClose ?? activeRecord;
      if (!target) {
        setError("No active clock-in found");
        return null;
      }
      setError(null);
      try {
        const faceResult = await verify();
        if (faceResult === null) return null;

        // Get location and connectivity together in one call
        const [coords, online] = await Promise.all([getLocation(), isOnline()]);

        // Online: require full VERIFIED. Offline: allow PENDING_VERIFICATION.
        if (!online && faceResult.status === "REVIEW_REQUIRED") {
          setError(`Verification failed: ${faceResult.reason}`);
          return null;
        }
        if (online && faceResult.status !== "VERIFIED") {
          setError(`Verification failed: ${faceResult.reason}`);
          return null;
        }

        const now = new Date().toISOString();
        const address = coords
          ? await getAddress(coords.latitude, coords.longitude)
          : undefined;
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

        if (!online || target.id.startsWith("local_")) {
          await enqueue("clockout" as any, {
            ...input,
            originalClockIn: target,
          });
          if (!recordToClose) {
            await AsyncStorage.removeItem(ACTIVE_KEY);
            setActiveRecord(null);
          }
          refetchHistory();
          return { ...target, ...input, syncedOffline: true } as ClockRecord;
        }

        const result = await updateClockRecord(input).unwrap();
        if (!recordToClose) {
          await AsyncStorage.removeItem(ACTIVE_KEY);
          setActiveRecord(null);
        }
        refetchHistory();
        return result;
      } catch (e: any) {
        setError(e?.message ?? "Failed to clock out");
        return null;
      }
    },
    [
      activeRecord,
      getLocation,
      isOnline,
      updateClockRecord,
      refetchHistory,
      verify,
    ],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    activeRecord,
    history,
    openShifts,
    isClockedIn: !!activeRecord,
    isLoading,
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
