// import { SCF_clickUpService } from "@/services/scf.clickUp.service";
// import {
//   Vif_clickUpService,
//   uploadPhoto,
// } from "@/services/vif.clickUp.service";
// import { client } from "@/src/amplify";
// import NetInfo from "@react-native-community/netinfo";
// import { uploadData } from "aws-amplify/storage";
// import { File } from "expo-file-system";
// import {
//   QueuedSubmission,
//   getPending,
//   markCompleted,
//   markFailed,
//   markSyncing,
//   pruneCompleted,
//   resetStuckSyncing,
// } from "./submissionQueue";

// export type SyncCallbacks = {
//   onSyncStart?: () => void;
//   onSyncSuccess?: (count: number) => void;
//   onSyncError?: (error: string) => void;
// };

// // ─── GraphQL ──────────────────────────────────────────────────
// const UPDATE_FLEET = /* GraphQL */ `
//   mutation UpdateFleet($input: UpdateFleetInput!) {
//     updateFleet(input: $input) {
//       id
//       currentkm
//     }
//   }
// `;

// const CREATE_INSPECTION = /* GraphQL */ `
//   mutation CreateInspection($input: CreateInspectionInput!) {
//     createInspection(input: $input) {
//       id
//       fleetid
//       inspectionNo
//     }
//   }
// `;

// const INSPECTIONS_BY_FLEET_LATEST = /* GraphQL */ `
//   query InspectionsByFleetAndNumber(
//     $fleetid: String!
//     $sortDirection: ModelSortDirection
//     $limit: Int
//   ) {
//     inspectionsByFleetAndNumber(
//       fleetid: $fleetid
//       sortDirection: $sortDirection
//       limit: $limit
//     ) {
//       items {
//         inspectionNo
//       }
//     }
//   }
// `;

// // ─── S3 helpers ───────────────────────────────────────────────
// const cleanVehicleReg = (reg: string) => reg.replace(/[^a-zA-Z0-9]/g, "-");
// const randomString = (length = 8) =>
//   Math.random()
//     .toString(36)
//     .substring(2, 2 + length);
// const generateS3Key = (
//   vehicleReg: string,
//   inspectionNo: number,
//   index: number,
// ) =>
//   `inspections/${cleanVehicleReg(vehicleReg)}/${inspectionNo}/${Date.now()}-${index}-${randomString()}.jpg`;

// const getLatestInspectionNo = async (
//   fleetId: string,
// ): Promise<number | null> => {
//   try {
//     const result = (await client.graphql({
//       query: INSPECTIONS_BY_FLEET_LATEST,
//       variables: { fleetid: fleetId, sortDirection: "DESC", limit: 1 },
//       authMode: "apiKey",
//     })) as any;
//     const items = result?.data?.inspectionsByFleetAndNumber?.items ?? [];
//     return (items[0]?.inspectionNo ?? 0) + 1;
//   } catch {
//     return null;
//   }
// };

// const uploadLocalPhotos = async (
//   photoUris: Array<{
//     uri: string;
//     name: string;
//     type: string;
//     s3Key: string;
//     status: string;
//   }>,
//   vehicleReg: string,
//   inspectionNo: number,
// ): Promise<string[]> => {
//   const keys: string[] = [];
//   for (let i = 0; i < photoUris.length; i++) {
//     const photo = photoUris[i];
//     if (photo.s3Key && photo.status === "success") {
//       keys.push(photo.s3Key);
//       continue;
//     }
//     try {
//       const response = await fetch(photo.uri);
//       const blob = await response.blob();
//       const s3Key = generateS3Key(vehicleReg, inspectionNo, i);
//       await uploadData({
//         path: s3Key,
//         data: blob,
//         options: { contentType: "image/jpeg" },
//       }).result;
//       keys.push(s3Key);
//     } catch (err) {
//       console.warn(`[SyncEngine] Failed to upload photo ${i + 1}:`, err);
//     }
//   }
//   return keys;
// };

// const cleanupPersistedPhotos = async (
//   photoUris: Array<{ uri: string }>,
// ): Promise<void> => {
//   for (const photo of photoUris) {
//     if (photo.uri.includes("offline_photos")) {
//       try {
//         const file = new File(photo.uri);

//         if (file.exists) {
//           file.delete();
//         }
//       } catch {
//         console.warn(
//           "[SyncEngine] Could not delete persisted photo:",
//           photo.uri,
//         );
//       }
//     }
//   }
// };

// // ─── VIF submission ───────────────────────────────────────────
// const submitVif = async (payload: any): Promise<void> => {
//   const { photoUris = [], vehicleReg, inspectionData, fleetKmUpdate } = payload;
//   const fleetId = fleetKmUpdate.id;

//   const freshInspectionNo = await getLatestInspectionNo(fleetId);
//   if (freshInspectionNo === null) {
//     throw new Error(
//       "Could not determine next inspection number – network or server issue",
//     );
//   }
//   const inspectionNo = freshInspectionNo;
//   console.log(
//     `[SyncEngine] Inspection number: ${inspectionNo} (queued was: ${payload.inspectionNo})`,
//   );

//   const s3PhotoKeys = await uploadLocalPhotos(
//     photoUris,
//     vehicleReg,
//     inspectionNo,
//   );

//   try {
//     const result = (await client.graphql({
//       query: UPDATE_FLEET,
//       variables: { input: fleetKmUpdate },
//       authMode: "apiKey",
//     })) as any;
//     if (result.errors) throw new Error(result.errors[0].message);
//     console.log("[SyncEngine] Fleet km updated ✓");
//   } catch (err: any) {
//     throw new Error(`Fleet km update failed: ${err.message}`);
//   }

//   const freshHistory = inspectionData.history.replace(
//     /Inspection #\d+/,
//     `Inspection #${inspectionNo}`,
//   );
//   const fullInspectionData = {
//     ...inspectionData,
//     inspectionNo,
//     photo: s3PhotoKeys,
//     history: freshHistory,
//   };

//   try {
//     const result = (await client.graphql({
//       query: CREATE_INSPECTION,
//       variables: { input: fullInspectionData },
//       authMode: "apiKey",
//     })) as any;
//     if (result.errors) throw new Error(result.errors[0].message);
//     console.log(
//       "[SyncEngine] Inspection created ✓",
//       result.data?.createInspection,
//     );
//   } catch (err: any) {
//     throw new Error(`Inspection save failed: ${err.message}`);
//   }

//   const clickUpPayload = {
//     ...payload.clickUpPayload,
//     inspectionNo: String(inspectionNo),
//     s3PhotoKeys,
//     photoCount: s3PhotoKeys.length,
//   };
//   const taskResponse = await Vif_clickUpService.createTask(clickUpPayload);
//   if (!taskResponse.success) {
//     throw new Error(taskResponse.message || "ClickUp task creation failed");
//   }

//   const taskId = String(taskResponse.taskId);
//   for (let i = 0; i < photoUris.length; i++) {
//     try {
//       await uploadPhoto({
//         photo: {
//           uri: photoUris[i].uri,
//           name: photoUris[i].name,
//           type: photoUris[i].type,
//         },
//         taskId,
//       });
//     } catch {
//       console.warn(`[SyncEngine] Failed to attach photo ${i + 1} to ClickUp`);
//     }
//   }

//   await cleanupPersistedPhotos(photoUris);
// };

// // ─── Stock submission ─────────────────────────────────────────
// const submitStock = async (payload: any): Promise<void> => {
//   const { username, result } = payload;
//   const response = await SCF_clickUpService.createTask(username, result);
//   if (
//     !response.success &&
//     !response.message?.toLowerCase().includes("success")
//   ) {
//     throw new Error(response.message || "Stock submission failed");
//   }
// };

// // ─── Process one row ──────────────────────────────────────────
// const processRow = async (row: QueuedSubmission): Promise<void> => {
//   await markSyncing(row.id);
//   let parsed: any;
//   try {
//     parsed = JSON.parse(row.payload);
//   } catch {
//     await markFailed(row.id, "Payload JSON parse error — cannot recover");
//     return;
//   }
//   try {
//     if (row.type === "vif") await submitVif(parsed);
//     else if (row.type === "stock") await submitStock(parsed);
//     await markCompleted(row.id);
//     console.log(`[SyncEngine] ✓ Row ${row.id} (${row.type}) completed`);
//   } catch (error: any) {
//     const msg = error?.message ?? "Unknown error";
//     await markFailed(row.id, msg);
//     console.warn(`[SyncEngine] ✗ Row ${row.id} (${row.type}) failed: ${msg}`);
//   }
// };

// // ─── Drain ────────────────────────────────────────────────────
// let isDraining = false;

// const drainQueue = async (callbacks: SyncCallbacks = {}): Promise<void> => {
//   if (isDraining) return;
//   isDraining = true;
//   try {
//     const rows = await getPending();
//     console.log(
//       `[SyncEngine] Pending rows: ${rows.length}`,
//       rows.map((r) => `${r.id}:${r.type}`),
//     );
//     if (rows.length === 0) return;

//     callbacks.onSyncStart?.();
//     console.log(`[SyncEngine] Draining ${rows.length} submission(s)`);

//     let syncedCount = 0;
//     for (const row of rows) {
//       const net = await NetInfo.fetch();
//       if (!net.isConnected) {
//         console.log("[SyncEngine] Lost network mid-drain, stopping");
//         break;
//       }
//       await processRow(row);
//       syncedCount++;
//     }

//     await pruneCompleted();
//     callbacks.onSyncSuccess?.(syncedCount);
//   } catch (e: any) {
//     callbacks.onSyncError?.(e.message ?? "Unknown error");
//   } finally {
//     isDraining = false;
//   }
// };

// // ─── Start / stop ─────────────────────────────────────────────
// let unsubscribe: (() => void) | null = null;
// let wasOnline = false;

// export const startSyncEngine = (callbacks: SyncCallbacks = {}): void => {
//   if (unsubscribe) return;

//   NetInfo.fetch().then(async (state) => {
//     await resetStuckSyncing();
//     await pruneCompleted();
//     if (state.isConnected) {
//       wasOnline = true;
//       drainQueue(callbacks).catch((e) =>
//         console.warn("[SyncEngine] Startup drain error:", e),
//       );
//     }
//   });

//   unsubscribe = NetInfo.addEventListener((state) => {
//     const online = !!state.isConnected;
//     if (online && !wasOnline) {
//       console.log("[SyncEngine] Network restored — draining queue");
//       setTimeout(() => {
//         drainQueue(callbacks).catch((e) =>
//           console.warn("[SyncEngine] Drain error:", e),
//         );
//       }, 2000);
//     }
//     wasOnline = online;
//   });

//   console.log("[SyncEngine] Started");
// };

// export const stopSyncEngine = (): void => {
//   if (unsubscribe) {
//     unsubscribe();
//     unsubscribe = null;
//     console.log("[SyncEngine] Stopped");
//   }
// };

// export const triggerSync = async (
//   callbacks: SyncCallbacks = {},
// ): Promise<void> => {
//   const net = await NetInfo.fetch();
//   if (!net.isConnected) throw new Error("No network connection");
//   await drainQueue(callbacks);
// };

import { SCF_clickUpService } from "@/services/scf.clickUp.service";
import {
  Vif_clickUpService,
  uploadPhoto,
} from "@/services/vif.clickUp.service";
import { client } from "@/src/amplify";
import NetInfo from "@react-native-community/netinfo";
import { uploadData } from "aws-amplify/storage";
import { deleteAsync } from "expo-file-system/legacy";
import {
  QueuedSubmission,
  getPending,
  markCompleted,
  markFailed,
  markSyncing,
  pruneCompleted,
  resetStuckSyncing,
} from "./submissionQueue";

export type SyncCallbacks = {
  onSyncStart?: () => void;
  onSyncSuccess?: (count: number) => void;
  onSyncError?: (error: string) => void;
};

// ─── GraphQL ──────────────────────────────────────────────────
const UPDATE_FLEET = /* GraphQL */ `
  mutation UpdateFleet($input: UpdateFleetInput!) {
    updateFleet(input: $input) {
      id
      currentkm
    }
  }
`;

const CREATE_INSPECTION = /* GraphQL */ `
  mutation CreateInspection($input: CreateInspectionInput!) {
    createInspection(input: $input) {
      id
      fleetid
      inspectionNo
    }
  }
`;

const INSPECTIONS_BY_FLEET_LATEST = /* GraphQL */ `
  query InspectionsByFleetAndNumber(
    $fleetid: String!
    $sortDirection: ModelSortDirection
    $limit: Int
  ) {
    inspectionsByFleetAndNumber(
      fleetid: $fleetid
      sortDirection: $sortDirection
      limit: $limit
    ) {
      items {
        inspectionNo
      }
    }
  }
`;

// ─── S3 helpers ───────────────────────────────────────────────
const cleanVehicleReg = (reg: string) => reg.replace(/[^a-zA-Z0-9]/g, "-");
const randomString = (length = 8) =>
  Math.random()
    .toString(36)
    .substring(2, 2 + length);
const generateS3Key = (
  vehicleReg: string,
  inspectionNo: number,
  index: number,
) =>
  `inspections/${cleanVehicleReg(vehicleReg)}/${inspectionNo}/${Date.now()}-${index}-${randomString()}.jpg`;

const getLatestInspectionNo = async (
  fleetId: string,
): Promise<number | null> => {
  try {
    const result = (await client.graphql({
      query: INSPECTIONS_BY_FLEET_LATEST,
      variables: { fleetid: fleetId, sortDirection: "DESC", limit: 1 },
      authMode: "apiKey",
    })) as any;
    const items = result?.data?.inspectionsByFleetAndNumber?.items ?? [];
    return (items[0]?.inspectionNo ?? 0) + 1;
  } catch {
    return null;
  }
};

const uploadLocalPhotos = async (
  photoUris: Array<{
    uri: string;
    name: string;
    type: string;
    s3Key: string;
    status: string;
  }>,
  vehicleReg: string,
  inspectionNo: number,
): Promise<string[]> => {
  const keys: string[] = [];
  for (let i = 0; i < photoUris.length; i++) {
    const photo = photoUris[i];
    if (photo.s3Key && photo.status === "success") {
      keys.push(photo.s3Key);
      continue;
    }
    try {
      const response = await fetch(photo.uri);
      const blob = await response.blob();
      const s3Key = generateS3Key(vehicleReg, inspectionNo, i);
      await uploadData({
        path: s3Key,
        data: blob,
        options: { contentType: "image/jpeg" },
      }).result;
      keys.push(s3Key);
    } catch (err) {
      console.warn(`[SyncEngine] Failed to upload photo ${i + 1}:`, err);
    }
  }
  return keys;
};

const cleanupPersistedPhotos = async (
  photoUris: Array<{ uri: string }>,
): Promise<void> => {
  for (const photo of photoUris) {
    if (photo.uri.includes("offline_photos")) {
      try {
        await deleteAsync(photo.uri, { idempotent: true });
      } catch {
        console.warn(
          "[SyncEngine] Could not delete persisted photo:",
          photo.uri,
        );
      }
    }
  }
};

// ─── VIF submission ───────────────────────────────────────────
const submitVif = async (payload: any): Promise<void> => {
  const { photoUris = [], vehicleReg, inspectionData, fleetKmUpdate } = payload;
  const fleetId = fleetKmUpdate.id;

  const freshInspectionNo = await getLatestInspectionNo(fleetId);
  if (freshInspectionNo === null) {
    throw new Error(
      "Could not determine next inspection number – network or server issue",
    );
  }
  const inspectionNo = freshInspectionNo;
  console.log(
    `[SyncEngine] Inspection number: ${inspectionNo} (queued was: ${payload.inspectionNo})`,
  );

  const s3PhotoKeys = await uploadLocalPhotos(
    photoUris,
    vehicleReg,
    inspectionNo,
  );

  try {
    const result = (await client.graphql({
      query: UPDATE_FLEET,
      variables: { input: fleetKmUpdate },
      authMode: "apiKey",
    })) as any;
    if (result.errors) throw new Error(result.errors[0].message);
    console.log("[SyncEngine] Fleet km updated ✓");
  } catch (err: any) {
    throw new Error(`Fleet km update failed: ${err.message}`);
  }

  const freshHistory = inspectionData.history.replace(
    /Inspection #\d+/,
    `Inspection #${inspectionNo}`,
  );
  const fullInspectionData = {
    ...inspectionData,
    inspectionNo,
    photo: s3PhotoKeys,
    history: freshHistory,
  };

  try {
    const result = (await client.graphql({
      query: CREATE_INSPECTION,
      variables: { input: fullInspectionData },
      authMode: "apiKey",
    })) as any;
    if (result.errors) throw new Error(result.errors[0].message);
    console.log(
      "[SyncEngine] Inspection created ✓",
      result.data?.createInspection,
    );
  } catch (err: any) {
    throw new Error(`Inspection save failed: ${err.message}`);
  }

  const clickUpPayload = {
    ...payload.clickUpPayload,
    inspectionNo: String(inspectionNo),
    s3PhotoKeys,
    photoCount: s3PhotoKeys.length,
  };
  const taskResponse = await Vif_clickUpService.createTask(clickUpPayload);
  if (!taskResponse.success) {
    throw new Error(taskResponse.message || "ClickUp task creation failed");
  }

  const taskId = String(taskResponse.taskId);
  for (let i = 0; i < photoUris.length; i++) {
    try {
      await uploadPhoto({
        photo: {
          uri: photoUris[i].uri,
          name: photoUris[i].name,
          type: photoUris[i].type,
        },
        taskId,
      });
    } catch {
      console.warn(`[SyncEngine] Failed to attach photo ${i + 1} to ClickUp`);
    }
  }

  await cleanupPersistedPhotos(photoUris);
};

// ─── Stock submission ─────────────────────────────────────────
const submitStock = async (payload: any): Promise<void> => {
  const { username, result } = payload;
  const response = await SCF_clickUpService.createTask(username, result);
  if (
    !response.success &&
    !response.message?.toLowerCase().includes("success")
  ) {
    throw new Error(response.message || "Stock submission failed");
  }
};

// ─── Clock record GraphQL mutations ──────────────────────────
const CREATE_CLOCK_RECORD = /* GraphQL */ `
  mutation CreateClockRecord($input: CreateClockRecordInput!) {
    createClockRecord(input: $input) {
      id
      userId
      employeeName
      clockInTime
      verificationStatus
      syncedOffline
      date
    }
  }
`;

const UPDATE_CLOCK_RECORD_MUTATION = /* GraphQL */ `
  mutation UpdateClockRecord($input: UpdateClockRecordInput!) {
    updateClockRecord(input: $input) {
      id
      clockOutTime
      hoursWorked
      verificationStatus
      similarityScore
    }
  }
`;

const VERIFY_URL: string =
  (require("@/amplify_outputs.json") as any)?.custom?.verifyFaceApiUrl ?? "";

// Upload offline selfie and run verification, returns updated status info
const syncOfflineSelfie = async (
  userId: string,
  localUri: string,
  clockRecordId: string,
): Promise<{
  status: "VERIFIED" | "REVIEW_REQUIRED";
  similarity: number;
  selfieKey: string | null;
}> => {
  try {
    const selfieKey = `hr/clock-selfies/${userId}/${Date.now()}.jpg`;
    const response = await fetch(localUri);
    const blob = await response.blob();
    await uploadData({
      path: selfieKey,
      data: blob,
      options: { contentType: "image/jpeg" },
    }).result;

    if (VERIFY_URL) {
      const lambdaRes = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, selfieKey, clockRecordId }),
      });
      const body = await lambdaRes.json();
      return {
        status: body.verified ? "VERIFIED" : "REVIEW_REQUIRED",
        similarity: body.similarity ?? 0,
        selfieKey,
      };
    }

    return { status: "REVIEW_REQUIRED", similarity: 0, selfieKey };
  } catch {
    return { status: "REVIEW_REQUIRED", similarity: 0, selfieKey: null };
  }
};

// ─── Clock-in sync ────────────────────────────────────────────
const submitClockIn = async (payload: any): Promise<void> => {
  const { localSelfieUri, ...input } = payload;

  // Create the clock record first
  const { data, errors } = (await client.graphql({
    query: CREATE_CLOCK_RECORD,
    variables: {
      input: {
        ...input,
        syncedOffline: true,
        verificationStatus: localSelfieUri
          ? "PENDING_VERIFICATION"
          : input.verificationStatus,
      },
    },
    authMode: "apiKey",
  })) as any;

  if (errors) throw new Error(errors[0].message);

  const createdRecord = data.createClockRecord;

  // If we stored a selfie offline, upload and verify now
  if (localSelfieUri && createdRecord?.id && input.userId) {
    const verifyResult = await syncOfflineSelfie(
      input.userId,
      localSelfieUri,
      createdRecord.id,
    );

    // Update the record with verification result
    await client.graphql({
      query: UPDATE_CLOCK_RECORD_MUTATION,
      variables: {
        input: {
          id: createdRecord.id,
          verificationStatus: verifyResult.status,
          similarityScore: verifyResult.similarity,
        },
      },
      authMode: "apiKey",
    });

    // Clean up local selfie file — deleteAsync imported statically at top
    try {
      await deleteAsync(localSelfieUri, { idempotent: true });
    } catch {}
  }
};

// ─── Clock-out sync ───────────────────────────────────────────
const submitClockOut = async (payload: any): Promise<void> => {
  const { originalClockIn: _ignored, localSelfieUri, ...input } = payload;

  if (input.id?.startsWith("local_")) {
    // The clock-in was also offline — we can't update a local_ ID
    // The clock-in sync should have created the real record; skip for now
    console.warn("[SyncEngine] Clock-out skipped — local_ ID not resolved yet");
    return;
  }

  const { errors } = (await client.graphql({
    query: UPDATE_CLOCK_RECORD_MUTATION,
    variables: { input },
    authMode: "apiKey",
  })) as any;

  if (errors) throw new Error(errors[0].message);

  // Sync clock-out selfie if present
  if (localSelfieUri && input.id && input.userId) {
    await syncOfflineSelfie(input.userId, localSelfieUri, input.id);
  }
};

// ─── Process one row ──────────────────────────────────────────
const processRow = async (row: QueuedSubmission): Promise<void> => {
  await markSyncing(row.id);
  let parsed: any;
  try {
    parsed = JSON.parse(row.payload);
  } catch {
    await markFailed(row.id, "Payload JSON parse error — cannot recover");
    return;
  }
  try {
    if (row.type === "vif") await submitVif(parsed);
    else if (row.type === "stock") await submitStock(parsed);
    else if (row.type === "clockin") await submitClockIn(parsed);
    else if (row.type === "clockout") await submitClockOut(parsed);
    await markCompleted(row.id);
    console.log(`[SyncEngine] ✓ Row ${row.id} (${row.type}) completed`);
  } catch (error: any) {
    const msg = error?.message ?? "Unknown error";
    await markFailed(row.id, msg);
    console.warn(`[SyncEngine] ✗ Row ${row.id} (${row.type}) failed: ${msg}`);
  }
};

// ─── Drain ────────────────────────────────────────────────────
let isDraining = false;

const drainQueue = async (callbacks: SyncCallbacks = {}): Promise<void> => {
  if (isDraining) return;
  isDraining = true;
  try {
    const rows = await getPending();
    console.log(
      `[SyncEngine] Pending rows: ${rows.length}`,
      rows.map((r) => `${r.id}:${r.type}`),
    );
    if (rows.length === 0) return;

    callbacks.onSyncStart?.();
    console.log(`[SyncEngine] Draining ${rows.length} submission(s)`);

    let syncedCount = 0;
    for (const row of rows) {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        console.log("[SyncEngine] Lost network mid-drain, stopping");
        break;
      }
      await processRow(row);
      syncedCount++;
    }

    await pruneCompleted();
    callbacks.onSyncSuccess?.(syncedCount);
  } catch (e: any) {
    callbacks.onSyncError?.(e.message ?? "Unknown error");
  } finally {
    isDraining = false;
  }
};

// ─── Start / stop ─────────────────────────────────────────────
let unsubscribe: (() => void) | null = null;
let wasOnline = false;

export const startSyncEngine = (callbacks: SyncCallbacks = {}): void => {
  if (unsubscribe) return;

  NetInfo.fetch().then(async (state) => {
    await resetStuckSyncing();
    await pruneCompleted();
    if (state.isConnected) {
      wasOnline = true;
      drainQueue(callbacks).catch((e) =>
        console.warn("[SyncEngine] Startup drain error:", e),
      );
    }
  });

  unsubscribe = NetInfo.addEventListener((state) => {
    const online = !!state.isConnected;
    if (online && !wasOnline) {
      console.log("[SyncEngine] Network restored — draining queue");
      setTimeout(() => {
        drainQueue(callbacks).catch((e) =>
          console.warn("[SyncEngine] Drain error:", e),
        );
      }, 2000);
    }
    wasOnline = online;
  });

  console.log("[SyncEngine] Started");
};

export const stopSyncEngine = (): void => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
    console.log("[SyncEngine] Stopped");
  }
};

export const triggerSync = async (
  callbacks: SyncCallbacks = {},
): Promise<void> => {
  const net = await NetInfo.fetch();
  if (!net.isConnected) throw new Error("No network connection");
  await drainQueue(callbacks);
};
