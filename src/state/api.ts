// state/api.ts
import { client } from "@/src/amplify";
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  CREATE_FLEET,
  CREATE_HISTORY,
  CREATE_INSPECTION,
  CreateInspectionArgs,
  DELETE_FLEET,
  GetInspectionsByFleetArgs,
  INSPECTIONS_BY_FLEET_AND_NUMBER,
  LIST_CATEGORIES,
  LIST_COMPONENTS_BY_SUBCATEGORY,
  LIST_FLEETS,
  LIST_INSPECTIONS_BY_FLEET,
  LIST_SUBCATEGORIES_BY_CATEGORY,
  Subcategory,
  UPDATE_FLEET,
  UpdateFleetKmArgs,
} from "./graphql/queries";

// ─────────────────────────────────────────────────────────────────────────────
// API slice  (mirrors teacher's `api` in state/api.ts)
// ─────────────────────────────────────────────────────────────────────────────

export const api = createApi({
  reducerPath: "api",
  baseQuery: fakeBaseQuery(), // Amplify handles transport — no REST base URL
  tagTypes: [
    "Fleet",
    "Inspection",
    "Categories",
    "Subcategories",
    "Components",
  ],

  endpoints: (build) => ({
    /* ── FLEET ─────────────────────────────────────────────────────────────── */

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
          return { error: e?.message ?? "Failed to fetch fleets" };
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
          return { error: e?.message ?? "Failed to update fleet" };
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
          return { error: e.message };
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
          return { error: e.message };
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
          return { error: e.message };
        }
      },
      invalidatesTags: ["Fleet"],
    }),

    /* ── INSPECTION ────────────────────────────────────────────────────────── */

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
            return { error: e?.message ?? "Failed to fetch inspections" };
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
          return { error: e?.message ?? "Failed to create inspection" };
        }
      },
      invalidatesTags: (_result, _error, arg) => [
        { type: "Inspection", id: arg.input.fleetid },
      ],
    }),
    // ---- Inspections ----
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
          return { error: e.message };
        }
      },
      providesTags: (_result, _error, { fleetId }) => [
        { type: "Inspection", id: fleetId },
      ],
    }),

    // ─── New stock control endpoints ──────────────────────────
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
          return { error: e?.message ?? "Failed to fetch categories" };
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
          return { error: e?.message ?? "Failed to fetch subcategories" };
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
          return { error: e?.message ?? "Failed to fetch components" };
        }
      },
      providesTags: (_result, _error, subcategoryId) => [
        { type: "Components", id: subcategoryId },
      ],
    }),

    // ---- History ----
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
          return { error: e.message };
        }
      },
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
  // stock
  useListCategoriesQuery,
  useListSubcategoriesByCategoryQuery,
  useListComponentsBySubcategoryQuery,
} = api;
