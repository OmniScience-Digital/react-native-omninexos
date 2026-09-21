// src/state/gql.ts
//
// Read-only GraphQL helper used by RTK Query *query* endpoints.
//
//  • Fails fast when the device is definitely offline (no radio at all), so a
//    refetch never waits on a request that cannot succeed.
//  • Adds a timeout, because Amplify/fetch have none. On a "connected but no
//    data" network a request can hang for minutes, which leaves `isFetching`
//    stuck and the pull-to-refresh spinner spinning forever.
//
// Both failures use wording that matches NETWORK_PATTERNS in api.ts, so they
// are classified as FETCH_ERROR and stay silent (no error modal), and RTK
// Query keeps the last cached `data`.
//
// Do NOT use this for mutations: a timeout on a write can look like a failure
// even though the server saved it, and a retry would then create a duplicate.
import { client } from "@/src/amplify";
import NetInfo from "@react-native-community/netinfo";

const READ_TIMEOUT_MS = 15_000;

// Only "definitely offline" short-circuits. `isInternetReachable` is often
// null/unknown on startup, so we let the request try and rely on the timeout.
let definitelyOffline = false;
NetInfo.fetch()
  .then((s) => {
    definitelyOffline = s.isConnected === false;
  })
  .catch(() => {});
NetInfo.addEventListener((s) => {
  definitelyOffline = s.isConnected === false;
});

export function gql(
  args: any,
  timeoutMs: number = READ_TIMEOUT_MS,
): Promise<any> {
  if (definitelyOffline) {
    return Promise.reject(new Error("Network request failed (offline)"));
  }
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Network request timeout")),
      timeoutMs,
    );
  });
  return Promise.race([client.graphql(args) as Promise<any>, timeout]).finally(
    () => clearTimeout(timer),
  );
}
