// //src/state/api.ts
// import { client } from "@/src/amplify";
// import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
// import {
//   CREATE_CLOCK_RECORD,
//   GET_CLOCK_RECORD,
//   LIST_CLOCK_RECORDS_BY_USER,
//   UPDATE_CLOCK_RECORD,
// } from "./graphql/clockRecordQueries";
// import {
//   CREATE_FLEET,
//   CREATE_HISTORY,
//   CREATE_INSPECTION,
//   CreateInspectionArgs,
//   DELETE_COMPONENT,
//   DELETE_FLEET,
//   GetInspectionsByFleetArgs,
//   INSPECTIONS_BY_FLEET_AND_NUMBER,
//   LIST_CATEGORIES,
//   LIST_COMPONENTS_BY_SUBCATEGORY,
//   LIST_COMPONENTS_BY_SUBCATEGORY_PAGINATED,
//   LIST_FLEETS,
//   LIST_INSPECTIONS_BY_FLEET,
//   LIST_INSPECTIONS_BY_FLEET_PAGINATED,
//   LIST_SUBCATEGORIES_BY_CATEGORY,
//   Subcategory,
//   UPDATE_COMPONENT,
//   UPDATE_FLEET,
//   UpdateFleetKmArgs,
// } from "./graphql/queries";

// // ── ClockRecord types ─────────────────────────────────────────────────────────

// export type ClockVerificationStatus =
//   | "VERIFIED"
//   | "PENDING_VERIFICATION"
//   | "REVIEW_REQUIRED";

// export interface ClockRecord {
//   id: string;
//   userId: string;
//   employeeName: string;
//   clockInTime: string;
//   clockOutTime?: string;
//   hoursWorked?: number;
//   clockInLat?: number;
//   clockInLng?: number;
//   clockOutLat?: number;
//   clockOutLng?: number;
//   clockInAddress?: string;
//   clockOutAddress?: string;
//   verificationStatus: ClockVerificationStatus;
//   similarityScore?: number;
//   syncedOffline: boolean;
//   localSelfieUri?: string | null; // cleared after S3 sync
//   date: string;
//   createdAt?: string;
//   updatedAt?: string;
// }

// export interface CreateClockRecordInput {
//   userId: string;
//   employeeName: string;
//   clockInTime: string;
//   clockInLat?: number;
//   clockInLng?: number;
//   clockInAddress?: string;
//   verificationStatus: ClockVerificationStatus;
//   syncedOffline: boolean;
//   localSelfieUri?: string | null;
//   date: string;
// }

// export interface UpdateClockRecordInput {
//   id: string;
//   clockOutTime: string;
//   hoursWorked: number;
//   clockOutLat?: number;
//   clockOutLng?: number;
//   clockOutAddress?: string;
// }

// export interface ListClockRecordsResult {
//   items: ClockRecord[];
//   nextToken: string | null;
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // API slice
// // ─────────────────────────────────────────────────────────────────────────────

// export const api = createApi({
//   reducerPath: "api",
//   baseQuery: fakeBaseQuery(),
//   tagTypes: [
//     "Fleet",
//     "Inspection",
//     "Categories",
//     "Subcategories",
//     "Components",
//     "ClockRecord",
//   ],

//   endpoints: (build) => ({
//     /* ── FLEET ─────────────────────────────────────────────────────────────── */

//     listFleets: build.query<Fleet[], void>({
//       queryFn: async () => {
//         try {
//           const { data, errors } = (await client.graphql({
//             query: LIST_FLEETS,
//             authMode: "apiKey",
//           })) as any;
//           if (errors) return { error: errors[0].message };
//           return { data: data.listFleets.items as Fleet[] };
//         } catch (e: any) {
//           return { error: e?.message ?? "Failed to fetch fleets" };
//         }
//       },
//       providesTags: ["Fleet"],
//     }),

//     updateFleetKm: build.mutation<
//       Pick<Fleet, "id" | "currentkm">,
//       UpdateFleetKmArgs
//     >({
//       queryFn: async ({ id, currentkm }) => {
//         try {
//           const { data, errors } = (await client.graphql({
//             query: UPDATE_FLEET,
//             variables: { input: { id, currentkm } },
//             authMode: "apiKey",
//           })) as any;
//           if (errors) return { error: errors[0].message };
//           return { data: data.updateFleet };
//         } catch (e: any) {
//           return { error: e?.message ?? "Failed to update fleet" };
//         }
//       },
//       invalidatesTags: ["Fleet"],
//     }),

//     createFleet: build.mutation<Fleet, Omit<Fleet, "id">>({
//       queryFn: async (input) => {
//         try {
//           const { data, errors } = (await client.graphql({
//             query: CREATE_FLEET,
//             variables: { input },
//             authMode: "apiKey",
//           })) as any;
//           if (errors) throw new Error(errors[0].message);
//           return { data: data.createFleet };
//         } catch (e: any) {
//           return { error: e.message };
//         }
//       },
//       invalidatesTags: ["Fleet"],
//     }),

//     updateFleet: build.mutation<Fleet, Partial<Fleet> & { id: string }>({
//       queryFn: async (input) => {
//         try {
//           const { data, errors } = (await client.graphql({
//             query: UPDATE_FLEET,
//             variables: { input },
//             authMode: "apiKey",
//           })) as any;
//           if (errors) throw new Error(errors[0].message);
//           return { data: data.updateFleet };
//         } catch (e: any) {
//           return { error: e.message };
//         }
//       },
//       invalidatesTags: ["Fleet"],
//     }),

//     deleteFleet: build.mutation<{ id: string }, string>({
//       queryFn: async (id) => {
//         try {
//           const { data, errors } = (await client.graphql({
//             query: DELETE_FLEET,
//             variables: { input: { id } },
//             authMode: "apiKey",
//           })) as any;
//           if (errors) throw new Error(errors[0].message);
//           return { data: { id } };
//         } catch (e: any) {
//           return { error: e.message };
//         }
//       },
//       invalidatesTags: ["Fleet"],
//     }),

//     /* ── INSPECTION ────────────────────────────────────────────────────────── */

//     getInspectionsByFleet: build.query<Inspection[], GetInspectionsByFleetArgs>(
//       {
//         queryFn: async ({ fleetId, sortDirection = "DESC", limit = 1 }) => {
//           try {
//             const { data, errors } = (await client.graphql({
//               query: INSPECTIONS_BY_FLEET_AND_NUMBER,
//               variables: { fleetid: fleetId, sortDirection, limit },
//               authMode: "apiKey",
//             })) as any;
//             if (errors) return { error: errors[0].message };
//             return {
//               data: data.inspectionsByFleetAndNumber.items as Inspection[],
//             };
//           } catch (e: any) {
//             return { error: e?.message ?? "Failed to fetch inspections" };
//           }
//         },
//         providesTags: (_result, _error, arg) => [
//           { type: "Inspection", id: arg.fleetId },
//         ],
//       },
//     ),

//     createInspection: build.mutation<
//       Pick<Inspection, "id" | "fleetid" | "inspectionNo">,
//       CreateInspectionArgs
//     >({
//       queryFn: async ({ input }) => {
//         try {
//           const { data, errors } = (await client.graphql({
//             query: CREATE_INSPECTION,
//             variables: { input },
//             authMode: "apiKey",
//           })) as any;
//           if (errors) return { error: errors[0].message };
//           return { data: data.createInspection };
//         } catch (e: any) {
//           return { error: e?.message ?? "Failed to create inspection" };
//         }
//       },
//       invalidatesTags: (_result, _error, arg) => [
//         { type: "Inspection", id: arg.input.fleetid },
//       ],
//     }),

//     listInspectionsByFleet: build.query<
//       Inspection[],
//       { fleetId: string; limit?: number }
//     >({
//       queryFn: async ({ fleetId, limit = 100 }) => {
//         try {
//           const { data, errors } = (await client.graphql({
//             query: LIST_INSPECTIONS_BY_FLEET,
//             variables: { fleetId, limit },
//             authMode: "apiKey",
//           })) as any;
//           if (errors) throw new Error(errors[0].message);
//           return {
//             data: data.inspectionsByFleetAndNumber.items as Inspection[],
//           };
//         } catch (e: any) {
//           return { error: e.message };
//         }
//       },
//       providesTags: (_result, _error, { fleetId }) => [
//         { type: "Inspection", id: fleetId },
//       ],
//     }),

//     listInspectionsByFleetPaginated: build.query<
//       { items: Inspection[]; nextToken: string | null },
//       { fleetId: string; limit?: number; nextToken?: string | null }
//     >({
//       queryFn: async ({ fleetId, limit = 20, nextToken = null }) => {
//         try {
//           const { data, errors } = (await client.graphql({
//             query: LIST_INSPECTIONS_BY_FLEET_PAGINATED,
//             variables: { fleetId, limit, nextToken },
//             authMode: "apiKey",
//           })) as any;
//           if (errors) throw new Error(errors[0].message);
//           return {
//             data: {
//               items: data.inspectionsByFleetAndNumber.items as Inspection[],
//               nextToken: data.inspectionsByFleetAndNumber.nextToken ?? null,
//             },
//           };
//         } catch (e: any) {
//           return { error: e.message };
//         }
//       },
//       providesTags: (_result, _error, { fleetId }) => [
//         { type: "Inspection", id: fleetId },
//       ],
//     }),

//     /* ── STOCK CONTROL ─────────────────────────────────────────────────────── */

//     listCategories: build.query<Category[], void>({
//       queryFn: async () => {
//         try {
//           const { data, errors } = (await client.graphql({
//             query: LIST_CATEGORIES,
//             authMode: "apiKey",
//           })) as any;
//           if (errors) return { error: errors[0].message };
//           return { data: data.listCategories.items as Category[] };
//         } catch (e: any) {
//           return { error: e?.message ?? "Failed to fetch categories" };
//         }
//       },
//       providesTags: ["Categories"],
//     }),

//     listSubcategoriesByCategory: build.query<Subcategory[], string>({
//       queryFn: async (categoryId) => {
//         try {
//           const { data, errors } = (await client.graphql({
//             query: LIST_SUBCATEGORIES_BY_CATEGORY,
//             variables: { categoryId },
//             authMode: "apiKey",
//           })) as any;
//           if (errors) return { error: errors[0].message };
//           return {
//             data: data.listSubCategoriesByCategoryIdAndName
//               .items as Subcategory[],
//           };
//         } catch (e: any) {
//           return { error: e?.message ?? "Failed to fetch subcategories" };
//         }
//       },
//       providesTags: (_result, _error, categoryId) => [
//         { type: "Subcategories", id: categoryId },
//       ],
//     }),

//     listComponentsBySubcategory: build.query<Component[], string>({
//       queryFn: async (subcategoryId) => {
//         try {
//           const { data, errors } = (await client.graphql({
//             query: LIST_COMPONENTS_BY_SUBCATEGORY,
//             variables: { subcategoryId },
//             authMode: "apiKey",
//           })) as any;
//           if (errors) return { error: errors[0].message };
//           return {
//             data: data.listComponentsBySubCategoryId.items as Component[],
//           };
//         } catch (e: any) {
//           return { error: e?.message ?? "Failed to fetch components" };
//         }
//       },
//       providesTags: (_result, _error, subcategoryId) => [
//         { type: "Components", id: subcategoryId },
//       ],
//     }),

//     updateComponent: build.mutation<
//       Component,
//       Partial<Component> & { id: string }
//     >({
//       queryFn: async (input) => {
//         try {
//           const response: any = await client.graphql({
//             query: UPDATE_COMPONENT,
//             variables: { input },
//             authMode: "apiKey",
//           });
//           if (response.errors) throw new Error(response.errors[0].message);
//           return { data: response.data.updateComponent };
//         } catch (e: any) {
//           return { error: e.message };
//         }
//       },
//       invalidatesTags: (_result, _error, { subcategoryId }) =>
//         subcategoryId
//           ? [{ type: "Components", id: subcategoryId }]
//           : ["Components"],
//     }),

//     listComponentsBySubcategoryPaginated: build.query<
//       { items: Component[]; nextToken: string | null },
//       { subcategoryId: string; limit?: number; nextToken?: string | null }
//     >({
//       queryFn: async ({ subcategoryId, limit = 20, nextToken = null }) => {
//         try {
//           const { data, errors } = (await client.graphql({
//             query: LIST_COMPONENTS_BY_SUBCATEGORY_PAGINATED,
//             variables: { subcategoryId, limit, nextToken },
//             authMode: "apiKey",
//           })) as any;
//           if (errors) throw new Error(errors[0].message);
//           return {
//             data: {
//               items: data.listComponentsBySubCategoryId.items as Component[],
//               nextToken: data.listComponentsBySubCategoryId.nextToken ?? null,
//             },
//           };
//         } catch (e: any) {
//           return { error: e.message };
//         }
//       },
//       providesTags: (_result, _error, { subcategoryId }) => [
//         { type: "Components", id: subcategoryId },
//       ],
//     }),

//     deleteComponent: build.mutation<{ id: string }, string>({
//       queryFn: async (id) => {
//         try {
//           const response: any = await client.graphql({
//             query: DELETE_COMPONENT,
//             variables: { input: { id } },
//             authMode: "apiKey",
//           });
//           if (response.errors) throw new Error(response.errors[0].message);
//           return { data: { id } };
//         } catch (e: any) {
//           return { error: e.message };
//         }
//       },
//       invalidatesTags: (_result, _error, id) => [
//         { type: "Components" as const, id },
//       ],
//     }),

//     /* ── HISTORY ───────────────────────────────────────────────────────────── */

//     addHistoryEntry: build.mutation<
//       HistoryEntry,
//       Omit<HistoryEntry, "id" | "timestamp">
//     >({
//       queryFn: async (input) => {
//         try {
//           const { data, errors } = (await client.graphql({
//             query: CREATE_HISTORY,
//             variables: {
//               input: { ...input, timestamp: new Date().toISOString() },
//             },
//             authMode: "apiKey",
//           })) as any;
//           if (errors) throw new Error(errors[0].message);
//           return { data: data.createHistory };
//         } catch (e: any) {
//           return { error: e.message };
//         }
//       },
//     }),

//     /* ── ATTENDANCE ────────────────────────────────────────────────────────── */

//     createClockRecord: build.mutation<ClockRecord, CreateClockRecordInput>({
//       queryFn: async (input) => {
//         try {
//           const { data, errors } = (await client.graphql({
//             query: CREATE_CLOCK_RECORD,
//             variables: { input },
//             authMode: "apiKey",
//           })) as any;
//           if (errors) throw new Error(errors[0].message);
//           return { data: data.createClockRecord as ClockRecord };
//         } catch (e: any) {
//           return { error: e?.message ?? "Failed to clock in" };
//         }
//       },
//       invalidatesTags: (_result, _error, { userId }) => [
//         { type: "ClockRecord", id: userId },
//       ],
//     }),

//     updateClockRecord: build.mutation<ClockRecord, UpdateClockRecordInput>({
//       queryFn: async (input) => {
//         try {
//           const { data, errors } = (await client.graphql({
//             query: UPDATE_CLOCK_RECORD,
//             variables: { input },
//             authMode: "apiKey",
//           })) as any;
//           if (errors) throw new Error(errors[0].message);
//           return { data: data.updateClockRecord as ClockRecord };
//         } catch (e: any) {
//           return { error: e?.message ?? "Failed to clock out" };
//         }
//       },
//       invalidatesTags: (_result, _error, { id }) => [
//         { type: "ClockRecord", id },
//       ],
//     }),

//     listMyClockRecords: build.query<
//       ListClockRecordsResult,
//       { userId: string; limit?: number; nextToken?: string | null }
//     >({
//       queryFn: async ({ userId, limit = 50, nextToken = null }) => {
//         try {
//           const { data, errors } = (await client.graphql({
//             query: LIST_CLOCK_RECORDS_BY_USER,
//             variables: { userId, limit, nextToken },
//             authMode: "apiKey",
//           })) as any;
//           if (errors) throw new Error(errors[0].message);
//           return {
//             data: {
//               items: data.listClockRecords.items as ClockRecord[],
//               nextToken: data.listClockRecords.nextToken ?? null,
//             },
//           };
//         } catch (e: any) {
//           return { error: e?.message ?? "Failed to fetch attendance records" };
//         }
//       },
//       providesTags: (_result, _error, { userId }) => [
//         { type: "ClockRecord", id: userId },
//       ],
//     }),

//     getClockRecord: build.query<ClockRecord, string>({
//       queryFn: async (id) => {
//         try {
//           const { data, errors } = (await client.graphql({
//             query: GET_CLOCK_RECORD,
//             variables: { id },
//             authMode: "apiKey",
//           })) as any;
//           if (errors) throw new Error(errors[0].message);
//           return { data: data.getClockRecord as ClockRecord };
//         } catch (e: any) {
//           return { error: e?.message ?? "Failed to fetch record" };
//         }
//       },
//       providesTags: (_result, _error, id) => [{ type: "ClockRecord", id }],
//     }),
//   }),
// });

// export const {
//   useListFleetsQuery,
//   useGetInspectionsByFleetQuery,
//   useLazyGetInspectionsByFleetQuery,
//   useCreateInspectionMutation,
//   useUpdateFleetKmMutation,
//   useCreateFleetMutation,
//   useUpdateFleetMutation,
//   useDeleteFleetMutation,
//   useListInspectionsByFleetQuery,
//   useAddHistoryEntryMutation,
//   // stock
//   useListCategoriesQuery,
//   useListSubcategoriesByCategoryQuery,
//   useListComponentsBySubcategoryQuery,
//   useUpdateComponentMutation,
//   useDeleteComponentMutation,
//   useLazyListSubcategoriesByCategoryQuery,
//   useLazyListComponentsBySubcategoryQuery,
//   useListComponentsBySubcategoryPaginatedQuery,
//   useLazyListComponentsBySubcategoryPaginatedQuery,
//   useListInspectionsByFleetPaginatedQuery,
//   useLazyListInspectionsByFleetPaginatedQuery,
//   // attendance
//   useCreateClockRecordMutation,
//   useUpdateClockRecordMutation,
//   useListMyClockRecordsQuery,
//   useLazyListMyClockRecordsQuery,
//   useGetClockRecordQuery,
//   useLazyGetClockRecordQuery,
// } = api;

//src/state/api.ts
import { client } from "@/src/amplify";
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  CREATE_CLOCK_RECORD,
  GET_CLOCK_RECORD,
  LIST_CLOCK_RECORDS_BY_USER,
  UPDATE_CLOCK_RECORD,
} from "./graphql/clockRecordQueries";
import {
  CREATE_FLEET,
  CREATE_HISTORY,
  CREATE_INSPECTION,
  CreateInspectionArgs,
  DELETE_COMPONENT,
  DELETE_FLEET,
  GetInspectionsByFleetArgs,
  INSPECTIONS_BY_FLEET_AND_NUMBER,
  LIST_CATEGORIES,
  LIST_COMPONENTS_BY_SUBCATEGORY,
  LIST_COMPONENTS_BY_SUBCATEGORY_PAGINATED,
  LIST_FLEETS,
  LIST_INSPECTIONS_BY_FLEET,
  LIST_INSPECTIONS_BY_FLEET_PAGINATED,
  LIST_SUBCATEGORIES_BY_CATEGORY,
  Subcategory,
  UPDATE_COMPONENT,
  UPDATE_FLEET,
  UpdateFleetKmArgs,
} from "./graphql/queries";

// ── ClockRecord types ─────────────────────────────────────────────────────────

export type ClockVerificationStatus =
  | "VERIFIED"
  | "PENDING_VERIFICATION"
  | "REVIEW_REQUIRED";

export interface ClockRecord {
  id: string;
  userId: string;
  employeeName: string;
  clockInTime: string;
  clockOutTime?: string;
  hoursWorked?: number;
  clockInLat?: number;
  clockInLng?: number;
  clockOutLat?: number;
  clockOutLng?: number;
  clockInAddress?: string;
  clockOutAddress?: string;
  verificationStatus: ClockVerificationStatus;
  similarityScore?: number;
  syncedOffline: boolean;
  localSelfieUri?: string | null;
  date: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateClockRecordInput {
  userId: string;
  employeeName: string;
  clockInTime: string;
  clockInLat?: number;
  clockInLng?: number;
  clockInAddress?: string;
  verificationStatus: ClockVerificationStatus;
  syncedOffline: boolean;
  localSelfieUri?: string | null;
  date: string;
}

export interface UpdateClockRecordInput {
  id: string;
  clockOutTime: string;
  hoursWorked: number;
  clockOutLat?: number;
  clockOutLng?: number;
  clockOutAddress?: string;
}

export interface ListClockRecordsResult {
  items: ClockRecord[];
  nextToken: string | null;
}

// ── Network error helper ──────────────────────────────────────────────────────
// Returns FETCH_ERROR for connectivity failures so:
//   1. The error middleware skips the modal
//   2. RTK Query serves the persisted cache instead
const NETWORK_PATTERNS = [
  "network",
  "fetch",
  "Failed to fetch",
  "Network request failed",
  "offline",
  "timeout",
  "Load failed",
  "Could not connect",
  "ERR_INTERNET_DISCONNECTED",
];

function isNetworkErr(msg: string): boolean {
  const lower = (msg ?? "").toLowerCase();
  return NETWORK_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

function netAwareError(e: any): { error: any } {
  const msg = e?.message ?? String(e) ?? "Unknown error";
  if (isNetworkErr(msg)) {
    return { error: { status: "FETCH_ERROR", error: msg } };
  }
  return { error: msg };
}

// ─────────────────────────────────────────────────────────────────────────────
// API slice
// ─────────────────────────────────────────────────────────────────────────────

export const api = createApi({
  reducerPath: "api",
  baseQuery: fakeBaseQuery(),
  tagTypes: [
    "Fleet",
    "Inspection",
    "Categories",
    "Subcategories",
    "Components",
    "ClockRecord",
  ],

  endpoints: (build) => ({
    /* ── FLEET ──────────────────────────────────────────────────────────── */

    listFleets: build.query<Fleet[], void>({
      queryFn: async () => {
        try {
          const { data, errors } = (await client.graphql({
            query: LIST_FLEETS,
            authMode: "apiKey",
          })) as any;
          if (errors) return { error: errors[0].message };
          return { data: data.listFleets.items as Fleet[] };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      providesTags: ["Fleet"],
    }),

    updateFleetKm: build.mutation<
      Pick<Fleet, "id" | "currentkm">,
      UpdateFleetKmArgs
    >({
      queryFn: async ({ id, currentkm }) => {
        try {
          const { data, errors } = (await client.graphql({
            query: UPDATE_FLEET,
            variables: { input: { id, currentkm } },
            authMode: "apiKey",
          })) as any;
          if (errors) return { error: errors[0].message };
          return { data: data.updateFleet };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      invalidatesTags: ["Fleet"],
    }),

    createFleet: build.mutation<Fleet, Omit<Fleet, "id">>({
      queryFn: async (input) => {
        try {
          const { data, errors } = (await client.graphql({
            query: CREATE_FLEET,
            variables: { input },
            authMode: "apiKey",
          })) as any;
          if (errors) throw new Error(errors[0].message);
          return { data: data.createFleet };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      invalidatesTags: ["Fleet"],
    }),

    updateFleet: build.mutation<Fleet, Partial<Fleet> & { id: string }>({
      queryFn: async (input) => {
        try {
          const { data, errors } = (await client.graphql({
            query: UPDATE_FLEET,
            variables: { input },
            authMode: "apiKey",
          })) as any;
          if (errors) throw new Error(errors[0].message);
          return { data: data.updateFleet };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      invalidatesTags: ["Fleet"],
    }),

    deleteFleet: build.mutation<{ id: string }, string>({
      queryFn: async (id) => {
        try {
          const { data, errors } = (await client.graphql({
            query: DELETE_FLEET,
            variables: { input: { id } },
            authMode: "apiKey",
          })) as any;
          if (errors) throw new Error(errors[0].message);
          return { data: { id } };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      invalidatesTags: ["Fleet"],
    }),

    /* ── INSPECTION ─────────────────────────────────────────────────────── */

    getInspectionsByFleet: build.query<Inspection[], GetInspectionsByFleetArgs>(
      {
        queryFn: async ({ fleetId, sortDirection = "DESC", limit = 1 }) => {
          try {
            const { data, errors } = (await client.graphql({
              query: INSPECTIONS_BY_FLEET_AND_NUMBER,
              variables: { fleetid: fleetId, sortDirection, limit },
              authMode: "apiKey",
            })) as any;
            if (errors) return { error: errors[0].message };
            return {
              data: data.inspectionsByFleetAndNumber.items as Inspection[],
            };
          } catch (e: any) {
            return netAwareError(e);
          }
        },
        providesTags: (_result, _error, arg) => [
          { type: "Inspection", id: arg.fleetId },
        ],
      },
    ),

    createInspection: build.mutation<
      Pick<Inspection, "id" | "fleetid" | "inspectionNo">,
      CreateInspectionArgs
    >({
      queryFn: async ({ input }) => {
        try {
          const { data, errors } = (await client.graphql({
            query: CREATE_INSPECTION,
            variables: { input },
            authMode: "apiKey",
          })) as any;
          if (errors) return { error: errors[0].message };
          return { data: data.createInspection };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      invalidatesTags: (_result, _error, arg) => [
        { type: "Inspection", id: arg.input.fleetid },
      ],
    }),

    listInspectionsByFleet: build.query<
      Inspection[],
      { fleetId: string; limit?: number }
    >({
      queryFn: async ({ fleetId, limit = 100 }) => {
        try {
          const { data, errors } = (await client.graphql({
            query: LIST_INSPECTIONS_BY_FLEET,
            variables: { fleetId, limit },
            authMode: "apiKey",
          })) as any;
          if (errors) throw new Error(errors[0].message);
          return {
            data: data.inspectionsByFleetAndNumber.items as Inspection[],
          };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      providesTags: (_result, _error, { fleetId }) => [
        { type: "Inspection", id: fleetId },
      ],
    }),

    listInspectionsByFleetPaginated: build.query<
      { items: Inspection[]; nextToken: string | null },
      { fleetId: string; limit?: number; nextToken?: string | null }
    >({
      queryFn: async ({ fleetId, limit = 20, nextToken = null }) => {
        try {
          const { data, errors } = (await client.graphql({
            query: LIST_INSPECTIONS_BY_FLEET_PAGINATED,
            variables: { fleetId, limit, nextToken },
            authMode: "apiKey",
          })) as any;
          if (errors) throw new Error(errors[0].message);
          return {
            data: {
              items: data.inspectionsByFleetAndNumber.items as Inspection[],
              nextToken: data.inspectionsByFleetAndNumber.nextToken ?? null,
            },
          };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      providesTags: (_result, _error, { fleetId }) => [
        { type: "Inspection", id: fleetId },
      ],
    }),

    /* ── STOCK CONTROL ──────────────────────────────────────────────────── */

    listCategories: build.query<Category[], void>({
      queryFn: async () => {
        try {
          const { data, errors } = (await client.graphql({
            query: LIST_CATEGORIES,
            authMode: "apiKey",
          })) as any;
          if (errors) return { error: errors[0].message };
          return { data: data.listCategories.items as Category[] };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      providesTags: ["Categories"],
    }),

    listSubcategoriesByCategory: build.query<Subcategory[], string>({
      queryFn: async (categoryId) => {
        try {
          const { data, errors } = (await client.graphql({
            query: LIST_SUBCATEGORIES_BY_CATEGORY,
            variables: { categoryId },
            authMode: "apiKey",
          })) as any;
          if (errors) return { error: errors[0].message };
          return {
            data: data.listSubCategoriesByCategoryIdAndName
              .items as Subcategory[],
          };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      providesTags: (_result, _error, categoryId) => [
        { type: "Subcategories", id: categoryId },
      ],
    }),

    listComponentsBySubcategory: build.query<Component[], string>({
      queryFn: async (subcategoryId) => {
        try {
          const { data, errors } = (await client.graphql({
            query: LIST_COMPONENTS_BY_SUBCATEGORY,
            variables: { subcategoryId },
            authMode: "apiKey",
          })) as any;
          if (errors) return { error: errors[0].message };
          return {
            data: data.listComponentsBySubCategoryId.items as Component[],
          };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      providesTags: (_result, _error, subcategoryId) => [
        { type: "Components", id: subcategoryId },
      ],
    }),

    updateComponent: build.mutation<
      Component,
      Partial<Component> & { id: string }
    >({
      queryFn: async (input) => {
        try {
          const response: any = await client.graphql({
            query: UPDATE_COMPONENT,
            variables: { input },
            authMode: "apiKey",
          });
          if (response.errors) throw new Error(response.errors[0].message);
          return { data: response.data.updateComponent };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      invalidatesTags: (_result, _error, { subcategoryId }) =>
        subcategoryId
          ? [{ type: "Components", id: subcategoryId }]
          : ["Components"],
    }),

    listComponentsBySubcategoryPaginated: build.query<
      { items: Component[]; nextToken: string | null },
      { subcategoryId: string; limit?: number; nextToken?: string | null }
    >({
      queryFn: async ({ subcategoryId, limit = 20, nextToken = null }) => {
        try {
          const { data, errors } = (await client.graphql({
            query: LIST_COMPONENTS_BY_SUBCATEGORY_PAGINATED,
            variables: { subcategoryId, limit, nextToken },
            authMode: "apiKey",
          })) as any;
          if (errors) throw new Error(errors[0].message);
          return {
            data: {
              items: data.listComponentsBySubCategoryId.items as Component[],
              nextToken: data.listComponentsBySubCategoryId.nextToken ?? null,
            },
          };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      providesTags: (_result, _error, { subcategoryId }) => [
        { type: "Components", id: subcategoryId },
      ],
    }),

    deleteComponent: build.mutation<{ id: string }, string>({
      queryFn: async (id) => {
        try {
          const response: any = await client.graphql({
            query: DELETE_COMPONENT,
            variables: { input: { id } },
            authMode: "apiKey",
          });
          if (response.errors) throw new Error(response.errors[0].message);
          return { data: { id } };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      invalidatesTags: (_result, _error, id) => [
        { type: "Components" as const, id },
      ],
    }),

    /* ── HISTORY ────────────────────────────────────────────────────────── */

    addHistoryEntry: build.mutation<
      HistoryEntry,
      Omit<HistoryEntry, "id" | "timestamp">
    >({
      queryFn: async (input) => {
        try {
          const { data, errors } = (await client.graphql({
            query: CREATE_HISTORY,
            variables: {
              input: { ...input, timestamp: new Date().toISOString() },
            },
            authMode: "apiKey",
          })) as any;
          if (errors) throw new Error(errors[0].message);
          return { data: data.createHistory };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
    }),

    /* ── ATTENDANCE ─────────────────────────────────────────────────────── */

    createClockRecord: build.mutation<ClockRecord, CreateClockRecordInput>({
      queryFn: async (input) => {
        try {
          const { data, errors } = (await client.graphql({
            query: CREATE_CLOCK_RECORD,
            variables: { input },
            authMode: "apiKey",
          })) as any;
          if (errors) throw new Error(errors[0].message);
          return { data: data.createClockRecord as ClockRecord };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      invalidatesTags: (_result, _error, { userId }) => [
        { type: "ClockRecord", id: userId },
      ],
    }),

    updateClockRecord: build.mutation<ClockRecord, UpdateClockRecordInput>({
      queryFn: async (input) => {
        try {
          const { data, errors } = (await client.graphql({
            query: UPDATE_CLOCK_RECORD,
            variables: { input },
            authMode: "apiKey",
          })) as any;
          if (errors) throw new Error(errors[0].message);
          return { data: data.updateClockRecord as ClockRecord };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: "ClockRecord", id },
      ],
    }),

    listMyClockRecords: build.query<
      ListClockRecordsResult,
      { userId: string; limit?: number; nextToken?: string | null }
    >({
      queryFn: async ({ userId, limit = 50, nextToken = null }) => {
        try {
          const { data, errors } = (await client.graphql({
            query: LIST_CLOCK_RECORDS_BY_USER,
            variables: { userId, limit, nextToken },
            authMode: "apiKey",
          })) as any;
          if (errors) throw new Error(errors[0].message);
          return {
            data: {
              items: data.listClockRecords.items as ClockRecord[],
              nextToken: data.listClockRecords.nextToken ?? null,
            },
          };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      providesTags: (_result, _error, { userId }) => [
        { type: "ClockRecord", id: userId },
      ],
    }),

    getClockRecord: build.query<ClockRecord, string>({
      queryFn: async (id) => {
        try {
          const { data, errors } = (await client.graphql({
            query: GET_CLOCK_RECORD,
            variables: { id },
            authMode: "apiKey",
          })) as any;
          if (errors) throw new Error(errors[0].message);
          return { data: data.getClockRecord as ClockRecord };
        } catch (e: any) {
          return netAwareError(e);
        }
      },
      providesTags: (_result, _error, id) => [{ type: "ClockRecord", id }],
    }),
  }),
});

export const {
  useListFleetsQuery,
  useGetInspectionsByFleetQuery,
  useLazyGetInspectionsByFleetQuery,
  useCreateInspectionMutation,
  useUpdateFleetKmMutation,
  useCreateFleetMutation,
  useUpdateFleetMutation,
  useDeleteFleetMutation,
  useListInspectionsByFleetQuery,
  useAddHistoryEntryMutation,
  useListCategoriesQuery,
  useListSubcategoriesByCategoryQuery,
  useListComponentsBySubcategoryQuery,
  useUpdateComponentMutation,
  useDeleteComponentMutation,
  useLazyListSubcategoriesByCategoryQuery,
  useLazyListComponentsBySubcategoryQuery,
  useListComponentsBySubcategoryPaginatedQuery,
  useLazyListComponentsBySubcategoryPaginatedQuery,
  useListInspectionsByFleetPaginatedQuery,
  useLazyListInspectionsByFleetPaginatedQuery,
  useCreateClockRecordMutation,
  useUpdateClockRecordMutation,
  useListMyClockRecordsQuery,
  useLazyListMyClockRecordsQuery,
  useGetClockRecordQuery,
  useLazyGetClockRecordQuery,
} = api;
