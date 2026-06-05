// // src/state/graphql/clockRecordQueries.ts
// // All GraphQL documents for the ClockRecord model.
// // ─────────────────────────────────────────────────────────────────────────────

// // ── Mutations ────────────────────────────────────────────────────────────────

// export const CREATE_CLOCK_RECORD = /* GraphQL */ `
//   mutation CreateClockRecord($input: CreateClockRecordInput!) {
//     createClockRecord(input: $input) {
//       id
//       userId
//       employeeName
//       clockInTime
//       clockOutTime
//       hoursWorked
//       clockInLat
//       clockInLng
//       clockOutLat
//       clockOutLng
//       clockInAddress
//       clockOutAddress
//       verificationStatus
//       similarityScore
//       syncedOffline
//       date
//       createdAt
//       updatedAt
//     }
//   }
// `;

// export const UPDATE_CLOCK_RECORD = /* GraphQL */ `
//   mutation UpdateClockRecord($input: UpdateClockRecordInput!) {
//     updateClockRecord(input: $input) {
//       id
//       userId
//       clockOutTime
//       hoursWorked
//       clockOutLat
//       clockOutLng
//       clockOutAddress
//       verificationStatus
//       updatedAt
//     }
//   }
// `;

// // ── Queries ──────────────────────────────────────────────────────────────────

// // All records for the current user — used on the history screen
// export const LIST_CLOCK_RECORDS_BY_USER = /* GraphQL */ `
//   query ListClockRecordsByUser(
//     $userId: String!
//     $limit: Int
//     $nextToken: String
//   ) {
//     listClockRecords(
//       filter: { userId: { eq: $userId } }
//       limit: $limit
//       nextToken: $nextToken
//     ) {
//       items {
//         id
//         userId
//         employeeName
//         clockInTime
//         clockOutTime
//         hoursWorked
//         clockInLat
//         clockInLng
//         clockOutLat
//         clockOutLng
//         clockInAddress
//         clockOutAddress
//         verificationStatus
//         similarityScore
//         syncedOffline
//         date
//         createdAt
//         updatedAt
//       }
//       nextToken
//     }
//   }
// `;

// // Single record by id — used after create/update to confirm the write
// export const GET_CLOCK_RECORD = /* GraphQL */ `
//   query GetClockRecord($id: ID!) {
//     getClockRecord(id: $id) {
//       id
//       userId
//       employeeName
//       clockInTime
//       clockOutTime
//       hoursWorked
//       clockInAddress
//       clockOutAddress
//       verificationStatus
//       syncedOffline
//       date
//     }
//   }
// `;

// // Admin: all records for a given date (managers only — Phase 2 auth gate)
// export const LIST_CLOCK_RECORDS_BY_DATE = /* GraphQL */ `
//   query ListClockRecordsByDate($date: AWSDate!, $limit: Int) {
//     listClockRecords(filter: { date: { eq: $date } }, limit: $limit) {
//       items {
//         id
//         userId
//         employeeName
//         clockInTime
//         clockOutTime
//         hoursWorked
//         clockInAddress
//         verificationStatus
//         date
//       }
//     }
//   }
// `;

// src/state/graphql/clockRecordQueries.ts
// All GraphQL documents for the ClockRecord model.
// ─────────────────────────────────────────────────────────────────────────────

// ── Mutations ────────────────────────────────────────────────────────────────

export const CREATE_CLOCK_RECORD = /* GraphQL */ `
  mutation CreateClockRecord($input: CreateClockRecordInput!) {
    createClockRecord(input: $input) {
      id
      userId
      employeeName
      clockInTime
      clockOutTime
      hoursWorked
      clockInLat
      clockInLng
      clockOutLat
      clockOutLng
      clockInAddress
      clockOutAddress
      verificationStatus
      similarityScore
      syncedOffline
      localSelfieUri
      date
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_CLOCK_RECORD = /* GraphQL */ `
  mutation UpdateClockRecord($input: UpdateClockRecordInput!) {
    updateClockRecord(input: $input) {
      id
      userId
      clockOutTime
      hoursWorked
      clockOutLat
      clockOutLng
      clockOutAddress
      verificationStatus
      updatedAt
    }
  }
`;

// ── Queries ──────────────────────────────────────────────────────────────────

// All records for the current user — used on the history screen
export const LIST_CLOCK_RECORDS_BY_USER = /* GraphQL */ `
  query ListClockRecordsByUser(
    $userId: String!
    $limit: Int
    $nextToken: String
  ) {
    listClockRecords(
      filter: { userId: { eq: $userId } }
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        userId
        employeeName
        clockInTime
        clockOutTime
        hoursWorked
        clockInLat
        clockInLng
        clockOutLat
        clockOutLng
        clockInAddress
        clockOutAddress
        verificationStatus
        similarityScore
        syncedOffline
        date
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

// Single record by id — used after create/update to confirm the write
export const GET_CLOCK_RECORD = /* GraphQL */ `
  query GetClockRecord($id: ID!) {
    getClockRecord(id: $id) {
      id
      userId
      employeeName
      clockInTime
      clockOutTime
      hoursWorked
      clockInAddress
      clockOutAddress
      verificationStatus
      syncedOffline
      date
    }
  }
`;

// Admin: all records for a given date (managers only — Phase 2 auth gate)
export const LIST_CLOCK_RECORDS_BY_DATE = /* GraphQL */ `
  query ListClockRecordsByDate($date: AWSDate!, $limit: Int) {
    listClockRecords(filter: { date: { eq: $date } }, limit: $limit) {
      items {
        id
        userId
        employeeName
        clockInTime
        clockOutTime
        hoursWorked
        clockInAddress
        verificationStatus
        date
      }
    }
  }
`;
