// hooks/useCategoryCache.ts
// Seeds SQLite category cache when online.
// ComponentItem uses this instead of RTK queries when offline.

import {
    getCachedComponents,
    getCachedSubcategories,
    getLastSyncedAt,
    seedCategories,
    seedComponents,
    seedSubcategories,
} from "@/services/categoryCache";
import {
    useListCategoriesQuery,
    useListComponentsBySubcategoryQuery,
    useListSubcategoriesByCategoryQuery,
} from "@/src/state/api";
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useRef, useState } from "react";

// ─── Seed the cache whenever online and data is fresh ─────────
export const useSeedCategoryCache = () => {
  const { data: categories = [] } = useListCategoriesQuery();
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current || categories.length === 0) return;

    NetInfo.fetch().then(async (state) => {
      if (!state.isConnected) return;

      try {
        // Check if we synced in the last hour — skip if fresh
        const lastSync = await getLastSyncedAt();
        if (lastSync) {
          const diffMs = Date.now() - new Date(lastSync).getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          if (diffHours < 1) {
            console.log("[CategoryCache] Fresh — skipping seed");
            seeded.current = true;
            return;
          }
        }

        console.log("[CategoryCache] Seeding categories...");
        await seedCategories(categories);
        seeded.current = true;
        console.log(`[CategoryCache] Seeded ${categories.length} categories ✓`);
      } catch (err) {
        console.warn("[CategoryCache] Seed failed:", err);
      }
    });
  }, [categories]);
};

// ─── Offline-aware subcategories ──────────────────────────────
export const useSubcategories = (categoryId: string, isOnline: boolean) => {
  const { data: liveData = [], isLoading } =
    useListSubcategoriesByCategoryQuery(categoryId, {
      skip: !categoryId || !isOnline,
    });

  const [cachedData, setCachedData] = useState<any[]>([]);
  const [cacheLoading, setCacheLoading] = useState(false);

  useEffect(() => {
    if (!categoryId || isOnline) return;
    setCacheLoading(true);
    getCachedSubcategories(categoryId)
      .then((data) => {
        setCachedData(data);

        // Also seed subcategories into cache while online so they're available later
      })
      .catch((err) =>
        console.warn("[CategoryCache] getCachedSubcategories:", err),
      )
      .finally(() => setCacheLoading(false));
  }, [categoryId, isOnline]);

  // When online and data loads, seed into cache for future offline use
  useEffect(() => {
    if (!isOnline || liveData.length === 0) return;
    seedSubcategories(liveData).catch((err) =>
      console.warn("[CategoryCache] seedSubcategories:", err),
    );
  }, [liveData, isOnline]);

  return {
    data: isOnline ? liveData : cachedData,
    isLoading: isOnline ? isLoading : cacheLoading,
  };
};

// ─── Offline-aware components ─────────────────────────────────
export const useComponents = (subcategoryId: string, isOnline: boolean) => {
  const { data: liveData = [], isLoading } =
    useListComponentsBySubcategoryQuery(subcategoryId, {
      skip: !subcategoryId || !isOnline,
    });

  const [cachedData, setCachedData] = useState<any[]>([]);
  const [cacheLoading, setCacheLoading] = useState(false);

  useEffect(() => {
    if (!subcategoryId || isOnline) return;
    setCacheLoading(true);
    getCachedComponents(subcategoryId)
      .then((data) => setCachedData(data))
      .catch((err) => console.warn("[CategoryCache] getCachedComponents:", err))
      .finally(() => setCacheLoading(false));
  }, [subcategoryId, isOnline]);

  // Seed into cache while online
  useEffect(() => {
    if (!isOnline || liveData.length === 0) return;
    seedComponents(
      liveData.map((c: any) => ({
        id: c.id,
        componentId: c.componentId || c.componentName,
        componentName: c.componentName,
        subcategoryId,
      })),
    ).catch((err) => console.warn("[CategoryCache] seedComponents:", err));
  }, [liveData, isOnline, subcategoryId]);

  return {
    data: isOnline ? liveData : cachedData,
    isLoading: isOnline ? isLoading : cacheLoading,
  };
};
