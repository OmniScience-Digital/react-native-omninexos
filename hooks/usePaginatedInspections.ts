// hooks/usePaginatedInspections.ts
import { useLazyListInspectionsByFleetPaginatedQuery } from "@/src/state/api";
import { useCallback, useEffect, useRef, useState } from "react";

export const usePaginatedInspections = (fleetId: string, limit = 20) => {
  const [items, setItems] = useState<Inspection[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [trigger] = useLazyListInspectionsByFleetPaginatedQuery();

  const loadingRef = useRef(false); // guards against concurrent first-page fetches
  const loadedFleetRef = useRef<string | null>(null);
  const nextTokenRef = useRef<string | null>(null); // always in sync with state

  const loadFirstPage = useCallback(async () => {
    if (!fleetId || loadingRef.current) return;
    loadingRef.current = true;
    loadedFleetRef.current = fleetId;
    setLoading(true);
    setItems([]);
    setNextToken(null);
    nextTokenRef.current = null;
    setHasMore(true);

    const result = await trigger({ fleetId, limit, nextToken: null });
    if (result.data) {
      const { items: newItems, nextToken: newToken } = result.data;
      setItems(newItems);
      setNextToken(newToken ?? null);
      nextTokenRef.current = newToken ?? null;
      setHasMore(!!newToken);
    }
    setLoading(false);
    loadingRef.current = false;
  }, [fleetId, limit, trigger]);

  const loadMore = useCallback(async () => {
    if (!hasMore || fetchingMore || loading || loadingRef.current) return;
    if (!nextTokenRef.current) return; // nothing left to page
    setFetchingMore(true);

    const result = await trigger({
      fleetId,
      limit,
      nextToken: nextTokenRef.current,
    });
    if (result.data) {
      const { items: newItems, nextToken: newToken } = result.data;
      setItems((prev) => {
        // deduplicate by id in case of any overlap
        const existingIds = new Set(prev.map((i) => i.id));
        const fresh = newItems.filter((i) => !existingIds.has(i.id));
        return [...prev, ...fresh];
      });
      setNextToken(newToken ?? null);
      nextTokenRef.current = newToken ?? null;
      setHasMore(!!newToken);
    }
    setFetchingMore(false);
  }, [fleetId, limit, hasMore, fetchingMore, loading, trigger]);

  useEffect(() => {
    if (!fleetId) return;
    if (loadedFleetRef.current !== fleetId) {
      loadFirstPage();
    }
  }, [fleetId, loadFirstPage]);

  return {
    items,
    loading,
    fetchingMore,
    loadMore,
    hasMore,
    refresh: loadFirstPage,
  };
};
