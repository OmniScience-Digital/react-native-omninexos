// // hooks/usePaginatedComponents.ts
// import { useLazyListComponentsBySubcategoryPaginatedQuery } from "@/src/state/api";
// import { useCallback, useEffect, useState } from "react";

// export const usePaginatedComponents = (subcategoryId: string, limit = 20) => {
//   const [items, setItems] = useState<Component[]>([]);
//   const [nextToken, setNextToken] = useState<string | null>(null);
//   const [hasMore, setHasMore] = useState(true);
//   const [loading, setLoading] = useState(false);
//   const [fetchingMore, setFetchingMore] = useState(false);
//   const [trigger] = useLazyListComponentsBySubcategoryPaginatedQuery();

//   const loadFirstPage = useCallback(async () => {
//     if (!subcategoryId) return;
//     setLoading(true);
//     setItems([]);
//     setNextToken(null);
//     setHasMore(true);
//     const result = await trigger({ subcategoryId, limit, nextToken: null });
//     if (result.data) {
//       const { items: newItems, nextToken: newToken } = result.data;
//       setItems(newItems);
//       setNextToken(newToken);
//       setHasMore(!!newToken);
//     }
//     setLoading(false);
//   }, [subcategoryId, limit, trigger]);

//   const loadMore = useCallback(async () => {
//     if (!hasMore || fetchingMore || loading) return;
//     setFetchingMore(true);
//     const result = await trigger({ subcategoryId, limit, nextToken });
//     if (result.data) {
//       const { items: newItems, nextToken: newToken } = result.data;
//       setItems((prev) => {
//         // Deduplicate by ID using Map
//         const map = new Map(prev.map((item) => [item.id, item]));
//         newItems.forEach((item) => map.set(item.id, item));
//         return Array.from(map.values());
//       });
//       setNextToken(newToken);
//       setHasMore(!!newToken);
//     }
//     setFetchingMore(false);
//   }, [
//     subcategoryId,
//     limit,
//     nextToken,
//     hasMore,
//     fetchingMore,
//     loading,
//     trigger,
//   ]);

//   useEffect(() => {
//     loadFirstPage();
//   }, [subcategoryId]);

//   return {
//     items,
//     loading,
//     fetchingMore,
//     loadMore,
//     hasMore,
//     refresh: loadFirstPage,
//   };
// };

// hooks/usePaginatedComponents.ts
import { useLazyListComponentsBySubcategoryPaginatedQuery } from "@/src/state/api";
import { useCallback, useEffect, useState } from "react";

export const usePaginatedComponents = (subcategoryId: string, limit = 20) => {
  const [items, setItems] = useState<Component[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [trigger, { isLoading: isTriggerLoading }] =
    useLazyListComponentsBySubcategoryPaginatedQuery();

  const loadFirstPage = useCallback(async () => {
    if (!subcategoryId) return;
    // Only show loading if there's no cached data AND no ongoing request
    if (items.length === 0 && !isTriggerLoading) {
      setIsInitialLoading(true);
    }
    const result = await trigger({ subcategoryId, limit, nextToken: null });
    if (result.data) {
      const { items: newItems, nextToken: newToken } = result.data;
      setItems(newItems);
      setNextToken(newToken);
      setHasMore(!!newToken);
    }
    setIsInitialLoading(false);
  }, [subcategoryId, limit, trigger, items.length, isTriggerLoading]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isFetchingMore || isInitialLoading) return;
    setIsFetchingMore(true);
    const result = await trigger({ subcategoryId, limit, nextToken });
    if (result.data) {
      const { items: newItems, nextToken: newToken } = result.data;
      // Deduplicate
      const unique = [...items, ...newItems].filter(
        (v, i, a) => a.findIndex((t) => t.id === v.id) === i,
      );
      setItems(unique);
      setNextToken(newToken);
      setHasMore(!!newToken);
    }
    setIsFetchingMore(false);
  }, [
    subcategoryId,
    limit,
    nextToken,
    hasMore,
    isFetchingMore,
    isInitialLoading,
    trigger,
    items,
  ]);

  useEffect(() => {
    if (subcategoryId) {
      loadFirstPage();
    }
  }, [subcategoryId]);

  const refresh = useCallback(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  return {
    items,
    loading: isInitialLoading || (isTriggerLoading && items.length === 0),
    fetchingMore: isFetchingMore,
    loadMore,
    hasMore,
    refresh,
  };
};
