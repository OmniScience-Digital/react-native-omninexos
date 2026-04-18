// state/api.ts
import { client } from "@/src/amplify";
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";

// ─────────────────────────────────────────────────────────────────────────────
// GraphQL documents
// ─────────────────────────────────────────────────────────────────────────────

const LIST_FLEETS = /* GraphQL */ `
  query ListFleets {
    listFleets {
      items {
        id
        vehicleVin
        vehicleReg
        vehicleMake
        vehicleModel
        transmitionType
        ownershipStatus
        fleetIndex
        fleetNumber
        lastServicedate
        lastServicekm
        lastRotationdate
        lastRotationkm
        servicePlanStatus
        servicePlan
        currentDriver
        currentkm
        codeRequirement
        pdpRequirement
        breakandLuxTest
        serviceplankm
        breakandLuxExpirey
        liscenseDiscExpirey
      }
    }
  }
`;

const INSPECTIONS_BY_FLEET_AND_NUMBER = /* GraphQL */ `
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
        id
        fleetid
        inspectionNo
        vehicleVin
        inspectionDate
        inspectionTime
        odometerStart
        vehicleReg
        inspectorOrDriver
        oilAndCoolant
        fuelLevel
        seatbeltDoorsMirrors
        handbrake
        tyreCondition
        spareTyre
        numberPlate
        licenseDisc
        leaks
        lights
        defrosterAircon
        emergencyKit
        clean
        warnings
        windscreenWipers
        serviceBook
        siteKit
        photo
        history
      }
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

const UPDATE_FLEET = /* GraphQL */ `
  mutation UpdateFleet($input: UpdateFleetInput!) {
    updateFleet(input: $input) {
      id
      currentkm
    }
  }
`;

const LIST_RECENT_INSPECTIONS = /* GraphQL */ `
  query ListRecentInspections($limit: Int) {
    listInspections(limit: $limit, sortDirection: DESC) {
      items {
        id
        inspectionDate
        vehicleReg
        odometerStart
        inspectionNo
      }
    }
  }
`;

// Categories
const LIST_CATEGORIES = /* GraphQL */ `
  query ListCategories {
    listCategories {
      items {
        id
        categoryName
      }
    }
  }
`;

// Subcategories by categoryId
const LIST_SUBCATEGORIES_BY_CATEGORY = /* GraphQL */ `
  query ListSubCategoriesByCategoryIdAndName($categoryId: String!) {
    listSubCategoriesByCategoryIdAndName(categoryId: $categoryId) {
      items {
        id
        subcategoryName
        categoryId
      }
    }
  }
`;

// Components by subcategoryId
const LIST_COMPONENTS_BY_SUBCATEGORY = /* GraphQL */ `
  query ListComponentsBySubCategoryId($subcategoryId: String!) {
    listComponentsBySubCategoryId(subcategoryId: $subcategoryId) {
      items {
        id
        componentId
        componentName
        subcategoryId
      }
    }
  }
`;
// ─────────────────────────────────────────────────────────────────────────────
// Arg types
// ─────────────────────────────────────────────────────────────────────────────

export interface GetInspectionsByFleetArgs {
  fleetId: string;
  sortDirection?: "ASC" | "DESC";
  limit?: number;
}

export interface CreateInspectionArgs {
  input: Omit<Inspection, "id">;
}

export interface UpdateFleetKmArgs {
  id: string;
  currentkm: number;
}

export interface Category {
  id: string;
  categoryName: string;
}

export interface Subcategory {
  id: string;
  subcategoryName: string;
  categoryId: string;
}

export interface Component {
  id: string;
  componentId: string;
  componentName: string;
  subcategoryId: string;
}
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
  }),
});

export const {
  useListFleetsQuery,
  useGetInspectionsByFleetQuery,
  useLazyGetInspectionsByFleetQuery,
  useCreateInspectionMutation,
  useUpdateFleetKmMutation,
  // stock
  useListCategoriesQuery,
  useListSubcategoriesByCategoryQuery,
  useListComponentsBySubcategoryQuery,
} = api;
