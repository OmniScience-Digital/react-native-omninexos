// // services/syncEngine.ts
// // Silent background service. Never shows modals. Just logs.
// // Start once in root _layout.tsx via useSyncEngine hook.

// import { SCF_clickUpService } from "@/services/scf.clickUp.service";
// import {
//   uploadPhoto,
//   Vif_clickUpService,
// } from "@/services/vif.clickUp.service";
// import { client } from "@/src/amplify";
// import NetInfo from "@react-native-community/netinfo";
// import { uploadData } from "aws-amplify/storage";
// import {
//   getPending,
//   markCompleted,
//   markFailed,
//   markSyncing,
//   pruneCompleted,
//   QueuedSubmission,
// } from "./submissionQueue";

// // ─── Inline GraphQL (same as queries.ts, duplicated to avoid circular imports)
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

// // ─── Upload local photos to S3, return keys ───────────────────
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

//     // Already uploaded — reuse existing key
//     if (photo.s3Key && photo.status === "success") {
//       keys.push(photo.s3Key);
//       continue;
//     }

//     // Upload local photo
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
//       // Skip this photo — don't fail the whole submission over one photo
//     }
//   }
//   return keys;
// };

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

// // ─── Fetch the real latest inspection number from Amplify ─────
// const getLatestInspectionNo = async (fleetId: string): Promise<number> => {
//   try {
//     const result = (await client.graphql({
//       query: INSPECTIONS_BY_FLEET_LATEST,
//       variables: { fleetid: fleetId, sortDirection: "DESC", limit: 1 },
//       authMode: "apiKey",
//     })) as any;
//     const items = result?.data?.inspectionsByFleetAndNumber?.items ?? [];
//     return (items[0]?.inspectionNo ?? 0) + 1;
//   } catch {
//     // Fall back to stored number if query fails
//     return null as any;
//   }
// };
// // ─── VIF submission ───────────────────────────────────────────
// const submitVif = async (payload: any): Promise<void> => {
//   const { photoUris = [], vehicleReg, inspectionData, fleetKmUpdate } = payload;
//   const fleetId = fleetKmUpdate.id;

//   // Always fetch fresh inspection number — the queued number may be stale
//   // if other inspections were submitted between queue time and sync time
//   const freshInspectionNo = await getLatestInspectionNo(fleetId);
//   const inspectionNo = freshInspectionNo ?? payload.inspectionNo;
//   console.log(
//     `[SyncEngine] Inspection number: ${inspectionNo} (queued was: ${payload.inspectionNo})`,
//   );

//   // Step 1: Upload any local photos to S3 using the correct inspection number
//   const s3PhotoKeys = await uploadLocalPhotos(
//     photoUris,
//     vehicleReg,
//     inspectionNo,
//   );

//   // Step 2: Update fleet km in Amplify
//   try {
//     console.log("[SyncEngine] Updating fleet km:", fleetKmUpdate);
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

//   // Step 3: Create inspection record with fresh inspection number and real S3 keys
//   const fullInspectionData = {
//     ...inspectionData,
//     inspectionNo,
//     photo: s3PhotoKeys,
//   };
//   console.log(
//     "[SyncEngine] Creating inspection:",
//     JSON.stringify(fullInspectionData, null, 2),
//   );
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

//   // Step 4: Create ClickUp task with fresh inspection number and real S3 keys
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

//   // Step 5: Attach photos to ClickUp task
//   const taskId = String(taskResponse.taskId);
//   for (let i = 0; i < photoUris.length; i++) {
//     const photo = photoUris[i];
//     try {
//       await uploadPhoto({
//         photo: { uri: photo.uri, name: photo.name, type: photo.type },
//         taskId,
//       });
//     } catch {
//       console.warn(`[SyncEngine] Failed to attach photo ${i + 1} to ClickUp`);
//     }
//   }
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

// // ─── Process one queued row ───────────────────────────────────
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
//     if (row.type === "vif") {
//       await submitVif(parsed);
//     } else if (row.type === "stock") {
//       await submitStock(parsed);
//     }
//     await markCompleted(row.id);
//     console.log(`[SyncEngine] ✓ Row ${row.id} (${row.type}) completed`);
//   } catch (error: any) {
//     const msg = error?.message ?? "Unknown error";
//     await markFailed(row.id, msg);
//     console.warn(`[SyncEngine] ✗ Row ${row.id} failed: ${msg}`);
//   }
// };

// // ─── Drain the full queue ─────────────────────────────────────
// const drainQueue = async (): Promise<void> => {
//   const rows = await getPending();
//   if (rows.length === 0) return;

//   console.log(`[SyncEngine] Draining ${rows.length} pending submission(s)`);

//   for (const row of rows) {
//     // Re-check network before each row
//     const net = await NetInfo.fetch();
//     if (!net.isConnected) {
//       console.log("[SyncEngine] Lost network mid-drain, stopping");
//       break;
//     }
//     await processRow(row);
//   }

//   await pruneCompleted();
// };

// // ─── Start / stop ─────────────────────────────────────────────
// let unsubscribe: (() => void) | null = null;

// export const startSyncEngine = (): void => {
//   if (unsubscribe) return;

//   // On startup: prune old completed rows first, then drain pending
//   NetInfo.fetch().then(async (state) => {
//     await pruneCompleted(); // always prune on startup
//     if (state.isConnected && state.isInternetReachable) {
//       drainQueue().catch((e) =>
//         console.warn("[SyncEngine] Startup drain error:", e),
//       );
//     }
//   });

//   // Listen for connectivity restored
//   unsubscribe = NetInfo.addEventListener((state) => {
//     if (state.isConnected && state.isInternetReachable) {
//       drainQueue().catch((e) => console.warn("[SyncEngine] Drain error:", e));
//     }
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

// export const triggerSync = async (): Promise<void> => {
//   const net = await NetInfo.fetch();
//   if (!net.isConnected) throw new Error("No network connection");
//   await drainQueue();
// };

// services/syncEngine.ts
// Silent background service. Never shows modals. Just logs.
// Start once in root _layout.tsx via useSyncEngine hook.

import { SCF_clickUpService } from "@/services/scf.clickUp.service";
import {
  uploadPhoto,
  Vif_clickUpService,
} from "@/services/vif.clickUp.service";
import { client } from "@/src/amplify";
import NetInfo from "@react-native-community/netinfo";
import { uploadData } from "aws-amplify/storage";
import {
  getPending,
  markCompleted,
  markFailed,
  markSyncing,
  pruneCompleted,
  QueuedSubmission,
} from "./submissionQueue";

// ─── Inline GraphQL (same as queries.ts, duplicated to avoid circular imports)
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

// ─── Upload local photos to S3, return keys ───────────────────
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

    // Already uploaded — reuse existing key
    if (photo.s3Key && photo.status === "success") {
      keys.push(photo.s3Key);
      continue;
    }

    // Upload local photo
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
      // Skip this photo — don't fail the whole submission over one photo
    }
  }
  return keys;
};

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

// ─── Fetch the real latest inspection number from Amplify ─────
const getLatestInspectionNo = async (fleetId: string): Promise<number> => {
  try {
    const result = (await client.graphql({
      query: INSPECTIONS_BY_FLEET_LATEST,
      variables: { fleetid: fleetId, sortDirection: "DESC", limit: 1 },
      authMode: "apiKey",
    })) as any;
    const items = result?.data?.inspectionsByFleetAndNumber?.items ?? [];
    return (items[0]?.inspectionNo ?? 0) + 1;
  } catch {
    // Fall back to stored number if query fails
    return null as any;
  }
};
// ─── VIF submission ───────────────────────────────────────────
const submitVif = async (payload: any): Promise<void> => {
  const { photoUris = [], vehicleReg, inspectionData, fleetKmUpdate } = payload;
  const fleetId = fleetKmUpdate.id;

  // Always fetch fresh inspection number — the queued number may be stale
  // if other inspections were submitted between queue time and sync time
  const freshInspectionNo = await getLatestInspectionNo(fleetId);
  const inspectionNo = freshInspectionNo ?? payload.inspectionNo;
  console.log(
    `[SyncEngine] Inspection number: ${inspectionNo} (queued was: ${payload.inspectionNo})`,
  );

  // Step 1: Upload any local photos to S3 using the correct inspection number
  const s3PhotoKeys = await uploadLocalPhotos(
    photoUris,
    vehicleReg,
    inspectionNo,
  );

  // Step 2: Update fleet km in Amplify
  try {
    console.log("[SyncEngine] Updating fleet km:", fleetKmUpdate);
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

  // Step 3: Create inspection record with fresh inspection number and real S3 keys
  const fullInspectionData = {
    ...inspectionData,
    inspectionNo,
    photo: s3PhotoKeys,
  };
  console.log(
    "[SyncEngine] Creating inspection:",
    JSON.stringify(fullInspectionData, null, 2),
  );
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

  // Step 4: Create ClickUp task with fresh inspection number and real S3 keys
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

  // Step 5: Attach photos to ClickUp task
  const taskId = String(taskResponse.taskId);
  for (let i = 0; i < photoUris.length; i++) {
    const photo = photoUris[i];
    try {
      await uploadPhoto({
        photo: { uri: photo.uri, name: photo.name, type: photo.type },
        taskId,
      });
    } catch {
      console.warn(`[SyncEngine] Failed to attach photo ${i + 1} to ClickUp`);
    }
  }
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

// ─── Process one queued row ───────────────────────────────────
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
    if (row.type === "vif") {
      await submitVif(parsed);
    } else if (row.type === "stock") {
      await submitStock(parsed);
    }
    await markCompleted(row.id);
    console.log(`[SyncEngine] ✓ Row ${row.id} (${row.type}) completed`);
  } catch (error: any) {
    const msg = error?.message ?? "Unknown error";
    await markFailed(row.id, msg);
    console.warn(`[SyncEngine] ✗ Row ${row.id} failed: ${msg}`);
  }
};

// ─── Drain the full queue ─────────────────────────────────────
const drainQueue = async (): Promise<void> => {
  const rows = await getPending();
  if (rows.length === 0) return;

  console.log(`[SyncEngine] Draining ${rows.length} pending submission(s)`);

  for (const row of rows) {
    // Re-check network before each row
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      console.log("[SyncEngine] Lost network mid-drain, stopping");
      break;
    }
    await processRow(row);
  }

  await pruneCompleted();
};

// ─── Start / stop ─────────────────────────────────────────────
let unsubscribe: (() => void) | null = null;

export const startSyncEngine = (): void => {
  if (unsubscribe) return;

  // On startup: prune old completed rows first, then drain pending
  NetInfo.fetch().then(async (state) => {
    await pruneCompleted(); // always prune on startup
    if (state.isConnected && state.isInternetReachable !== false) {
      drainQueue().catch((e) =>
        console.warn("[SyncEngine] Startup drain error:", e),
      );
    }
  });

  // Listen for connectivity restored
  unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      drainQueue().catch((e) => console.warn("[SyncEngine] Drain error:", e));
    }
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

export const triggerSync = async (): Promise<void> => {
  const net = await NetInfo.fetch();
  if (!net.isConnected) throw new Error("No network connection");
  await drainQueue();
};
