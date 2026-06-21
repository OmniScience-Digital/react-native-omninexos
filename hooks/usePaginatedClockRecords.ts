import { ClockRecord, useLazyListMyClockRecordsQuery } from "@/src/state/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

const CACHE_KEY = (uid: string) => `clockrecords:cache:${uid}`;

const sortDesc = (arr: ClockRecord[]) =>
  [...arr].sort(
    (a, b) =>
      new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime(),
  );

export const usePaginatedClockRecords = (userId: string, limit = 20) => {
  const [items, setItems] = useState<ClockRecord[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [trigger] = useLazyListMyClockRecordsQuery();

  const loadingRef = useRef(false);
  const loadedUserRef = useRef<string | null>(null);
  const nextTokenRef = useRef<string | null>(null);

  // ── Persist helpers ────────────────────────────────────────────────────
  const persist = useCallback(
    (records: ClockRecord[]) => {
      if (!userId || userId === "anonymous") return;
      AsyncStorage.setItem(
        CACHE_KEY(userId),
        JSON.stringify(records.slice(0, 100)),
      ).catch(() => {});
    },
    [userId],
  );

  // ── Load cache first, then hit the network ─────────────────────────────
  const loadFirstPage = useCallback(async () => {
    if (!userId || userId === "anonymous" || loadingRef.current) return;
    loadingRef.current = true;
    loadedUserRef.current = userId;
    setLoading(true);
    setNextToken(null);
    nextTokenRef.current = null;
    setHasMore(true);

    // 1️⃣ Read cache immediately — home screen shows real data before network
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY(userId));
      if (raw) {
        const cached: ClockRecord[] = JSON.parse(raw);
        setItems(cached); // render with cached data straight away
      }
    } catch {}

    // 2️⃣ Fire network request — replaces cache when it arrives
    try {
      const result = await trigger({ userId, limit, nextToken: null });
      if (result.data) {
        const sorted = sortDesc(result.data.items);
        setItems(sorted);
        setNextToken(result.data.nextToken ?? null);
        nextTokenRef.current = result.data.nextToken ?? null;
        setHasMore(!!result.data.nextToken);
        persist(sorted);
      }
    } catch {}

    setLoading(false);
    loadingRef.current = false;
  }, [userId, limit, trigger, persist]);

  const loadMore = useCallback(async () => {
    if (!hasMore || fetchingMore || loading || loadingRef.current) return;
    if (!nextTokenRef.current) return;
    setFetchingMore(true);

    try {
      const result = await trigger({
        userId,
        limit,
        nextToken: nextTokenRef.current,
      });
      if (result.data) {
        setItems((prev) => {
          const ids = new Set(prev.map((i) => i.id));
          const combined = sortDesc([
            ...prev,
            ...result.data!.items.filter((i) => !ids.has(i.id)),
          ]);
          persist(combined);
          return combined;
        });
        setNextToken(result.data.nextToken ?? null);
        nextTokenRef.current = result.data.nextToken ?? null;
        setHasMore(!!result.data.nextToken);
      }
    } catch {}

    setFetchingMore(false);
  }, [userId, limit, hasMore, fetchingMore, loading, trigger, persist]);

  // Patch a record in state AND cache (offline clock-outs)
  const patchItem = useCallback(
    (id: string, patch: Partial<ClockRecord>) => {
      setItems((prev) => {
        const updated = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
        persist(updated);
        return updated;
      });
    },
    [persist],
  );

  useEffect(() => {
    if (!userId || userId === "anonymous") return;
    if (loadedUserRef.current !== userId) {
      loadFirstPage();
    }
  }, [userId, loadFirstPage]);

  const openShifts = items.filter(
    (r) => !r.clockOutTime && !r.id.startsWith("local_"),
  );

  return {
    items,
    openShifts,
    loading,
    fetchingMore,
    loadMore,
    hasMore,
    patchItem,
    refresh: loadFirstPage,
  };
};
