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

// ─────────────────────────────────────────────────────────────────────────────
// API slice  (mirrors teacher's `api` in state/api.ts)
// ─────────────────────────────────────────────────────────────────────────────

export const api = createApi({
  reducerPath: "api",
  baseQuery: fakeBaseQuery(), // Amplify handles transport — no REST base URL
  tagTypes: ["Fleet", "Inspection"],

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
  }),
});

export const {
  useListFleetsQuery,
  useGetInspectionsByFleetQuery,
  useLazyGetInspectionsByFleetQuery,
  useCreateInspectionMutation,
  useUpdateFleetKmMutation,
} = api;

// ─────────────────────────────────────────────────────────────────────────────
// Pure utility — replaces the async getNextInspectionNumber function
// ─────────────────────────────────────────────────────────────────────────────

export function getNextInspectionNumber(
  inspections: Inspection[] | undefined,
): number {
  return (inspections?.[0]?.inspectionNo ?? 0) + 1;
}
