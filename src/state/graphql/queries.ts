// // ─────────────────────────────────────────────────────────────────────────────
// // GraphQL documents
// // ─────────────────────────────────────────────────────────────────────────────

// export const LIST_FLEETS = /* GraphQL */ `
//   query ListFleets($nextToken: String) {
//     listFleets(limit: 500, nextToken: $nextToken) {
//       items {
//         id
//         vehicleVin
//         vehicleReg
//         vehicleMake
//         vehicleModel
//         transmitionType
//         ownershipStatus
//         fleetIndex
//         fleetNumber
//         lastServicedate
//         lastServicekm
//         lastRotationdate
//         lastRotationkm
//         servicePlanStatus
//         servicePlan
//         currentDriver
//         currentkm
//         codeRequirement
//         pdpRequirement
//         breakandLuxTest
//         serviceplankm
//         breakandLuxExpirey
//         liscenseDiscExpirey
//       }
//       nextToken
//     }
//   }
// `;

// export const INSPECTIONS_BY_FLEET_AND_NUMBER = /* GraphQL */ `
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
//         id
//         fleetid
//         inspectionNo
//         vehicleVin
//         inspectionDate
//         inspectionTime
//         odometerStart
//         vehicleReg
//         inspectorOrDriver
//         oilAndCoolant
//         fuelLevel
//         seatbeltDoorsMirrors
//         handbrake
//         tyreCondition
//         spareTyre
//         numberPlate
//         licenseDisc
//         leaks
//         lights
//         defrosterAircon
//         emergencyKit
//         clean
//         warnings
//         windscreenWipers
//         serviceBook
//         siteKit
//         photo
//         history
//       }
//     }
//   }
// `;

// export const CREATE_INSPECTION = /* GraphQL */ `
//   mutation CreateInspection($input: CreateInspectionInput!) {
//     createInspection(input: $input) {
//       id
//       fleetid
//       inspectionNo
//     }
//   }
// `;

// export const UPDATE_FLEET = /* GraphQL */ `
//   mutation UpdateFleet($input: UpdateFleetInput!) {
//     updateFleet(input: $input) {
//       id
//       currentkm
//     }
//   }
// `;

// export const LIST_RECENT_INSPECTIONS = /* GraphQL */ `
//   query ListRecentInspections($limit: Int) {
//     listInspections(limit: $limit, sortDirection: DESC) {
//       items {
//         id
//         inspectionDate
//         vehicleReg
//         odometerStart
//         inspectionNo
//       }
//     }
//   }
// `;

// // ---------- GraphQL documents ----------

// export const CREATE_FLEET = /* GraphQL */ `
//   mutation CreateFleet($input: CreateFleetInput!) {
//     createFleet(input: $input) {
//       id
//       fleetNumber
//       vehicleReg
//       vehicleMake
//       vehicleModel
//       currentDriver
//       currentkm
//       servicePlanStatus
//       liscenseDiscExpirey
//       breakandLuxExpirey
//     }
//   }
// `;

// export const DELETE_FLEET = /* GraphQL */ `
//   mutation DeleteFleet($input: DeleteFleetInput!) {
//     deleteFleet(input: $input) {
//       id
//     }
//   }
// `;

// export const LIST_INSPECTIONS_BY_FLEET = /* GraphQL */ `
//   query ListInspectionsByFleet($fleetId: String!, $limit: Int) {
//     inspectionsByFleetAndNumber(
//       fleetid: $fleetId
//       sortDirection: DESC
//       limit: $limit
//     ) {
//       items {
//         id
//         inspectionNo
//         inspectionDate
//         inspectionTime
//         odometerStart
//         inspectorOrDriver
//         oilAndCoolant
//         fuelLevel
//         seatbeltDoorsMirrors
//         handbrake
//         tyreCondition
//         spareTyre
//         numberPlate
//         licenseDisc
//         leaks
//         lights
//         defrosterAircon
//         emergencyKit
//         clean
//         warnings
//         windscreenWipers
//         serviceBook
//         siteKit
//         photo
//         history
//       }
//     }
//   }
// `;

// export const CREATE_HISTORY = /* GraphQL */ `
//   mutation CreateHistory($input: CreateHistoryInput!) {
//     createHistory(input: $input) {
//       id
//     }
//   }
// `;
// // Categories
// export const LIST_CATEGORIES = /* GraphQL */ `
//   query ListCategories {
//     listCategories {
//       items {
//         id
//         categoryName
//         createdAt
//         updatedAt
//       }
//     }
//   }
// `;

// // ----------------------------------------------------------------------
// // Subcategories
// // ----------------------------------------------------------------------
// export const LIST_SUBCATEGORIES_BY_CATEGORY = /* GraphQL */ `
//   query ListSubCategoriesByCategoryId($categoryId: String!) {
//     listSubCategoriesByCategoryIdAndName(categoryId: $categoryId) {
//       items {
//         id
//         subcategoryName
//         categoryId
//         createdAt
//         updatedAt
//       }
//     }
//   }
// `;

// // ----------------------------------------------------------------------
// // Components – fetch ALL fields for edit modal
// // ----------------------------------------------------------------------
// export const LIST_COMPONENTS_BY_SUBCATEGORY = /* GraphQL */ `
//   query ListComponentsBySubCategoryId($subcategoryId: String!) {
//     listComponentsBySubCategoryId(subcategoryId: $subcategoryId) {
//       items {
//         id
//         componentId
//         componentName
//         description
//         primarySupplier
//         primarySupplierItemCode
//         secondarySupplier
//         secondarySupplierItemCode
//         currentStock
//         minimumStock
//         notes
//         subcategoryId
//       }
//     }
//   }
// `;
// // ----------------------------------------------------------------------
// // Create / Update / Delete Component
// // ----------------------------------------------------------------------
// export const UPDATE_COMPONENT = /* GraphQL */ `
//   mutation UpdateComponent($input: UpdateComponentInput!) {
//     updateComponent(input: $input) {
//       id
//       componentId
//       componentName
//       description
//       primarySupplier
//       primarySupplierItemCode
//       secondarySupplier
//       secondarySupplierItemCode
//       currentStock
//       minimumStock
//       notes
//       subcategoryId
//     }
//   }
// `;

// // COMPONENTS paginated
// // ----------------------------------------------
// // COMPONENTS (paginated)
// // ----------------------------------------------
// export const LIST_COMPONENTS_BY_SUBCATEGORY_PAGINATED = /* GraphQL */ `
//   query ListComponentsBySubCategoryIdPaginated(
//     $subcategoryId: String!
//     $limit: Int
//     $nextToken: String
//   ) {
//     listComponentsBySubCategoryId(
//       subcategoryId: $subcategoryId
//       limit: $limit
//       nextToken: $nextToken
//     ) {
//       items {
//         id
//         componentId
//         componentName
//         description
//         primarySupplier
//         primarySupplierItemCode
//         secondarySupplier
//         secondarySupplierItemCode
//         currentStock
//         minimumStock
//         notes
//         subcategoryId
//       }
//       nextToken
//     }
//   }
// `;

// // ----------------------------------------------
// // INSPECTIONS (paginated)
// // ----------------------------------------------
// export const LIST_INSPECTIONS_BY_FLEET_PAGINATED = /* GraphQL */ `
//   query ListInspectionsByFleetPaginated(
//     $fleetId: String!
//     $limit: Int
//     $nextToken: String
//   ) {
//     inspectionsByFleetAndNumber(
//       fleetid: $fleetId
//       sortDirection: DESC
//       limit: $limit
//       nextToken: $nextToken
//     ) {
//       items {
//         id
//         inspectionNo
//         inspectionDate
//         inspectionTime
//         odometerStart
//         vehicleReg
//         inspectorOrDriver
//         oilAndCoolant
//         fuelLevel
//         seatbeltDoorsMirrors
//         handbrake
//         tyreCondition
//         spareTyre
//         numberPlate
//         licenseDisc
//         leaks
//         lights
//         defrosterAircon
//         emergencyKit
//         clean
//         warnings
//         windscreenWipers
//         serviceBook
//         siteKit
//         photo
//         history
//       }
//       nextToken
//     }
//   }
// `;

// export const DELETE_COMPONENT = /* GraphQL */ `
//   mutation DeleteComponent($input: DeleteComponentInput!) {
//     deleteComponent(input: $input) {
//       id
//     }
//   }
// `;

// // (Optional) If you need to create a component, add this mutation:
// export const CREATE_COMPONENT = /* GraphQL */ `
//   mutation CreateComponent($input: CreateComponentInput!) {
//     createComponent(input: $input) {
//       id
//       componentId
//       componentName
//       description
//       primarySupplier
//       primarySupplierItemCode
//       secondarySupplier
//       secondarySupplierItemCode
//       qtyExStock
//       currentStock
//       minimumStock
//       notes
//       subcategoryId
//     }
//   }
// `;
// export const LIST_PERMISSIONS_BY_USER_ID = /* GraphQL */ `
//   query ListPermissionsByUserId($userId: String!) {
//     listPermissionsByUserId(userId: $userId) {
//       items {
//         id
//         userId
//         permissions
//       }
//     }
//   }
// `;

// // ─────────────────────────────────────────────────────────────────────────────
// // Arg types
// // ─────────────────────────────────────────────────────────────────────────────

// export interface GetInspectionsByFleetArgs {
//   fleetId: string;
//   sortDirection?: "ASC" | "DESC";
//   limit?: number;
// }

// export interface CreateInspectionArgs {
//   input: Omit<Inspection, "id">;
// }

// export interface UpdateFleetKmArgs {
//   id: string;
//   currentkm: number;
// }

// export interface Category {
//   id: string;
//   categoryName: string;
// }

// export interface Subcategory {
//   id: string;
//   subcategoryName: string;
//   categoryId: string;
// }

// export interface Component {
//   id: string;
//   componentId: string;
//   componentName: string;
//   subcategoryId: string;
// }

// ─────────────────────────────────────────────────────────────────────────────
// GraphQL documents
// ─────────────────────────────────────────────────────────────────────────────

export const LIST_FLEETS = /* GraphQL */ `
  query ListFleets($nextToken: String) {
    listFleets(limit: 500, nextToken: $nextToken) {
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
      nextToken
    }
  }
`;

export const INSPECTIONS_BY_FLEET_AND_NUMBER = /* GraphQL */ `
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

export const CREATE_INSPECTION = /* GraphQL */ `
  mutation CreateInspection($input: CreateInspectionInput!) {
    createInspection(input: $input) {
      id
      fleetid
      inspectionNo
    }
  }
`;

export const UPDATE_FLEET = /* GraphQL */ `
  mutation UpdateFleet($input: UpdateFleetInput!) {
    updateFleet(input: $input) {
      id
      currentkm
    }
  }
`;

// Minimal, paginated query used only to COUNT inspections (Home screen's
// "Total Inspections"). Selects just `id` — nothing else is needed to count
// — and follows nextToken so a fleet with more inspections than one page
// doesn't undercount. Previously named LIST_RECENT_INSPECTIONS; defined but
// never actually used anywhere, which is how the real bug (Home computed
// "total inspections" from the highest per-vehicle inspection NUMBER, not an
// actual count — see api.ts's getTotalInspectionCount) went unnoticed.
export const COUNT_INSPECTIONS = /* GraphQL */ `
  query CountInspections($nextToken: String) {
    listInspections(limit: 1000, nextToken: $nextToken) {
      items {
        id
      }
      nextToken
    }
  }
`;

// ---------- GraphQL documents ----------

export const CREATE_FLEET = /* GraphQL */ `
  mutation CreateFleet($input: CreateFleetInput!) {
    createFleet(input: $input) {
      id
      fleetNumber
      vehicleReg
      vehicleMake
      vehicleModel
      currentDriver
      currentkm
      servicePlanStatus
      liscenseDiscExpirey
      breakandLuxExpirey
    }
  }
`;

export const DELETE_FLEET = /* GraphQL */ `
  mutation DeleteFleet($input: DeleteFleetInput!) {
    deleteFleet(input: $input) {
      id
    }
  }
`;

export const LIST_INSPECTIONS_BY_FLEET = /* GraphQL */ `
  query ListInspectionsByFleet($fleetId: String!, $limit: Int) {
    inspectionsByFleetAndNumber(
      fleetid: $fleetId
      sortDirection: DESC
      limit: $limit
    ) {
      items {
        id
        inspectionNo
        inspectionDate
        inspectionTime
        odometerStart
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

export const CREATE_HISTORY = /* GraphQL */ `
  mutation CreateHistory($input: CreateHistoryInput!) {
    createHistory(input: $input) {
      id
    }
  }
`;
// Categories
export const LIST_CATEGORIES = /* GraphQL */ `
  query ListCategories {
    listCategories {
      items {
        id
        categoryName
        createdAt
        updatedAt
      }
    }
  }
`;

// ----------------------------------------------------------------------
// Subcategories
// ----------------------------------------------------------------------
export const LIST_SUBCATEGORIES_BY_CATEGORY = /* GraphQL */ `
  query ListSubCategoriesByCategoryId($categoryId: String!) {
    listSubCategoriesByCategoryIdAndName(categoryId: $categoryId) {
      items {
        id
        subcategoryName
        categoryId
        createdAt
        updatedAt
      }
    }
  }
`;

// ----------------------------------------------------------------------
// Components – fetch ALL fields for edit modal
// ----------------------------------------------------------------------
export const LIST_COMPONENTS_BY_SUBCATEGORY = /* GraphQL */ `
  query ListComponentsBySubCategoryId($subcategoryId: String!) {
    listComponentsBySubCategoryId(subcategoryId: $subcategoryId) {
      items {
        id
        componentId
        componentName
        description
        primarySupplier
        primarySupplierItemCode
        secondarySupplier
        secondarySupplierItemCode
        currentStock
        minimumStock
        notes
        subcategoryId
      }
    }
  }
`;
// ----------------------------------------------------------------------
// Create / Update / Delete Component
// ----------------------------------------------------------------------
export const UPDATE_COMPONENT = /* GraphQL */ `
  mutation UpdateComponent($input: UpdateComponentInput!) {
    updateComponent(input: $input) {
      id
      componentId
      componentName
      description
      primarySupplier
      primarySupplierItemCode
      secondarySupplier
      secondarySupplierItemCode
      currentStock
      minimumStock
      notes
      subcategoryId
    }
  }
`;

// COMPONENTS paginated
// ----------------------------------------------
// COMPONENTS (paginated)
// ----------------------------------------------
export const LIST_COMPONENTS_BY_SUBCATEGORY_PAGINATED = /* GraphQL */ `
  query ListComponentsBySubCategoryIdPaginated(
    $subcategoryId: String!
    $limit: Int
    $nextToken: String
  ) {
    listComponentsBySubCategoryId(
      subcategoryId: $subcategoryId
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        componentId
        componentName
        description
        primarySupplier
        primarySupplierItemCode
        secondarySupplier
        secondarySupplierItemCode
        currentStock
        minimumStock
        notes
        subcategoryId
      }
      nextToken
    }
  }
`;

// ----------------------------------------------
// INSPECTIONS (paginated)
// ----------------------------------------------
export const LIST_INSPECTIONS_BY_FLEET_PAGINATED = /* GraphQL */ `
  query ListInspectionsByFleetPaginated(
    $fleetId: String!
    $limit: Int
    $nextToken: String
  ) {
    inspectionsByFleetAndNumber(
      fleetid: $fleetId
      sortDirection: DESC
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        inspectionNo
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
      nextToken
    }
  }
`;

export const DELETE_COMPONENT = /* GraphQL */ `
  mutation DeleteComponent($input: DeleteComponentInput!) {
    deleteComponent(input: $input) {
      id
    }
  }
`;

// (Optional) If you need to create a component, add this mutation:
export const CREATE_COMPONENT = /* GraphQL */ `
  mutation CreateComponent($input: CreateComponentInput!) {
    createComponent(input: $input) {
      id
      componentId
      componentName
      description
      primarySupplier
      primarySupplierItemCode
      secondarySupplier
      secondarySupplierItemCode
      qtyExStock
      currentStock
      minimumStock
      notes
      subcategoryId
    }
  }
`;
export const LIST_PERMISSIONS_BY_USER_ID = /* GraphQL */ `
  query ListPermissionsByUserId($userId: String!) {
    listPermissionsByUserId(userId: $userId) {
      items {
        id
        userId
        permissions
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
