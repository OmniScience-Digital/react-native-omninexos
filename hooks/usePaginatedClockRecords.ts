// hooks/usePaginatedClockRecords.ts
// Follows the exact same pattern as usePaginatedInspections.ts
import { ClockRecord, useLazyListMyClockRecordsQuery } from "@/src/state/api";
import { useCallback, useEffect, useRef, useState } from "react";

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

  const loadFirstPage = useCallback(async () => {
    if (!userId || userId === "anonymous" || loadingRef.current) return;
    loadingRef.current = true;
    loadedUserRef.current = userId;
    setLoading(true);
    setItems([]);
    setNextToken(null);
    nextTokenRef.current = null;
    setHasMore(true);

    const result = await trigger({ userId, limit, nextToken: null });
    if (result.data) {
      const { items: newItems, nextToken: newToken } = result.data;
      // Sort newest first
      const sorted = [...newItems].sort(
        (a, b) =>
          new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime(),
      );
      setItems(sorted);
      setNextToken(newToken ?? null);
      nextTokenRef.current = newToken ?? null;
      setHasMore(!!newToken);
    }
    setLoading(false);
    loadingRef.current = false;
  }, [userId, limit, trigger]);

  const loadMore = useCallback(async () => {
    if (!hasMore || fetchingMore || loading || loadingRef.current) return;
    if (!nextTokenRef.current) return;
    setFetchingMore(true);

    const result = await trigger({
      userId,
      limit,
      nextToken: nextTokenRef.current,
    });
    if (result.data) {
      const { items: newItems, nextToken: newToken } = result.data;
      setItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const fresh = newItems.filter((i) => !existingIds.has(i.id));
        const combined = [...prev, ...fresh];
        return combined.sort(
          (a, b) =>
            new Date(b.clockInTime).getTime() -
            new Date(a.clockInTime).getTime(),
        );
      });
      setNextToken(newToken ?? null);
      nextTokenRef.current = newToken ?? null;
      setHasMore(!!newToken);
    }
    setFetchingMore(false);
  }, [userId, limit, hasMore, fetchingMore, loading, trigger]);

  useEffect(() => {
    if (!userId || userId === "anonymous") return;
    if (loadedUserRef.current !== userId) {
      loadFirstPage();
    }
  }, [userId, loadFirstPage]);

  // Expose open shifts separately — used for orphaned shift recovery
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
    refresh: loadFirstPage,
  };
};
