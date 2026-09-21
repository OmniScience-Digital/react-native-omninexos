// src/state/realtime.ts
//
// Phase 3 – live auto-sync. When the web app (or another phone) creates,
// updates or deletes a Fleet / Category / SubCategory / Component / Inspection,
// AppSync pushes an event here and we refetch just the cached queries that
// event affects. The vehicle you add on the web shows up on the phone in
// seconds, without pulling to refresh.
//
// Design rules (offline-first app):
//  • Best effort only. Any failure here is silent and never shows a modal; the
//    freshness policy in api.ts (refetch on mount / foreground / reconnect) is
//    still the safety net, so the app is correct even if this never connects.
//  • Only runs while the app is in the foreground AND online.
//  • Refetches matching cache entries in place. It deliberately does NOT use
//    `invalidateTags`: RTK Query *removes* invalidated entries that have no
//    active subscriber, and those entries are our offline data.
//  • Events are coalesced (a bulk import on the web = one refetch, not 500).
//  • Paginated lists (fleet inspection history, inventory component list) keep
//    their own local state and are excluded; they refresh on open / pull.
import { client } from "@/src/amplify";
import { api } from "@/src/state/api";
import NetInfo from "@react-native-community/netinfo";
import { AppState } from "react-native";

/** Flip to false to disable realtime without touching anything else. */
export const REALTIME_SYNC_ENABLED = true;

type Tag = string | { type: string; id: string };

interface Target {
  dispatch: (action: any) => any;
  getState: () => any;
}

export interface RealtimeOptions {
  /** Coalescing window for bursts of events. */
  debounceMs?: number;
  /** First reconnect delay; doubles each failure up to maxRetryMs. */
  retryBaseMs?: number;
  maxRetryMs?: number;
}

interface Feed {
  field: string;
  doc: string;
  tags: (row: any) => Tag[];
}

/** onCreate/onUpdate/onDelete feeds for one model. */
function feeds(
  model: string,
  extraFields: string,
  tags: (row: any) => Tag[],
): Feed[] {
  return (["Create", "Update", "Delete"] as const).map((op) => ({
    field: `on${op}${model}`,
    doc: `subscription On${op}${model} { on${op}${model} { id ${extraFields} } }`,
    tags,
  }));
}

// Which cached queries does an event affect? (Tag ids match providesTags in api.ts.)
const FEEDS: Feed[] = [
  ...feeds("Fleet", "", () => ["Fleet"]),
  ...feeds("Category", "", () => ["Categories"]),
  ...feeds("SubCategory", "categoryId", (r) =>
    r?.categoryId ? [{ type: "Subcategories", id: r.categoryId }] : [],
  ),
  ...feeds("Component", "subcategoryId", (r) =>
    r?.subcategoryId ? [{ type: "Components", id: r.subcategoryId }] : [],
  ),
  // A new inspection also moves the vehicle's odometer, so refresh fleets too.
  ...feeds("Inspection", "fleetid", (r) => [
    ...(r?.fleetid ? [{ type: "Inspection", id: r.fleetid }] : []),
    "Fleet",
  ]),
];

/**
 * Refetch, in place, every cached non-paginated query that provides one of
 * `tags`. Includes entries with no active subscriber so the offline copy stays
 * warm, and never removes anything from the cache.
 */
export function refetchCachedByTags(target: Target, tags: Tag[]): number {
  if (!tags.length) return 0;
  const entries = api.util.selectInvalidatedBy(
    target.getState(),
    tags as any,
  ) as { endpointName: string; originalArgs: unknown }[];

  let count = 0;
  for (const { endpointName, originalArgs } of entries) {
    if (endpointName.endsWith("Paginated")) continue;
    const endpoint = (api.endpoints as Record<string, any>)[endpointName];
    if (!endpoint?.initiate) continue;
    target.dispatch(
      endpoint.initiate(originalArgs, { forceRefetch: true, subscribe: false }),
    );
    count++;
  }
  return count;
}

/**
 * Start listening. Returns a cleanup function.
 * Call once while the user is signed in (see hooks/useRealtimeSync.ts).
 */
export function startRealtimeSync(
  target: Target,
  options: RealtimeOptions = {},
): () => void {
  if (!REALTIME_SYNC_ENABLED) return () => {};

  const {
    debounceMs = 1500,
    retryBaseMs = 3000,
    maxRetryMs = 60_000,
  } = options;

  let subs: { unsubscribe: () => void }[] = [];
  let stopped = false;
  let appActive = AppState.currentState === "active";
  let online = true;
  let failures = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let needsCatchUp = false;
  const pending = new Map<string, Tag>();

  const enqueue = (tag: Tag) => {
    pending.set(typeof tag === "string" ? tag : `${tag.type}:${tag.id}`, tag);
    if (!flushTimer) flushTimer = setTimeout(flush, debounceMs);
  };

  function flush() {
    flushTimer = null;
    const tags = [...pending.values()];
    pending.clear();
    try {
      refetchCachedByTags(target, tags);
    } catch (e) {
      if (__DEV__) console.log("[Realtime] refetch failed", e);
    }
  }

  const unsubscribeAll = () => {
    subs.forEach((s) => {
      try {
        s.unsubscribe();
      } catch {}
    });
    subs = [];
  };

  const clearRetry = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };

  const canRun = () => !stopped && appActive && online;

  function scheduleRetry() {
    unsubscribeAll();
    needsCatchUp = true;
    if (!canRun() || retryTimer) return;
    const delay = Math.min(retryBaseMs * 2 ** failures, maxRetryMs);
    failures += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      start();
    }, delay);
  }

  function start() {
    if (!canRun() || subs.length) return;
    // After a dropped subscription we may have missed events: catch up on the
    // core lists. (Foreground / reconnect are already covered by RTK's own
    // refetchOnFocus / refetchOnReconnect, so they don't need this.)
    if (needsCatchUp) {
      needsCatchUp = false;
      enqueue("Fleet");
      enqueue("Categories");
    }
    try {
      for (const feed of FEEDS) {
        const observable: any = client.graphql({
          query: feed.doc,
          authMode: "apiKey",
        } as any);
        subs.push(
          observable.subscribe({
            next: (evt: any) => {
              failures = 0;
              const row = evt?.data?.[feed.field];
              feed.tags(row).forEach(enqueue);
            },
            error: (e: unknown) => {
              if (__DEV__) console.log("[Realtime] subscription error", e);
              scheduleRetry();
            },
          }),
        );
      }
    } catch (e) {
      if (__DEV__) console.log("[Realtime] could not subscribe", e);
      scheduleRetry();
    }
  }

  function stop() {
    clearRetry();
    unsubscribeAll();
  }

  const appSub = AppState.addEventListener("change", (state) => {
    appActive = state === "active";
    if (appActive) {
      failures = 0;
      start();
    } else {
      stop(); // sockets don't survive backgrounding anyway
    }
  });

  const netUnsub = NetInfo.addEventListener((net) => {
    const nowOnline =
      net.isConnected === true && net.isInternetReachable !== false;
    if (nowOnline === online) return;
    online = nowOnline;
    if (online) {
      failures = 0;
      start();
    } else {
      stop();
    }
  });

  start();

  return () => {
    stopped = true;
    stop();
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    pending.clear();
    appSub.remove();
    netUnsub();
  };
}
