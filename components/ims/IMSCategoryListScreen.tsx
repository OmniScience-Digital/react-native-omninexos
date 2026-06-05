// components/ims/IMSCategoryListScreen.tsx
import { NonTabScreen } from "@/components/screens/non-tab-screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useTheme } from "@/src/contexts/theme-context";
import {
  useLazyListComponentsBySubcategoryQuery,
  useLazyListSubcategoriesByCategoryQuery,
  useListCategoriesQuery,
} from "@/src/state/api";
import { ChevronRight, Package } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface CategoryWithCounts extends Category {
  subcategoryCount: number;
  componentCount: number;
  lowStockCount: number;
}

export default function IMSCategoryListScreen({
  onSelectCategory,
}: {
  onSelectCategory: (cat: Category) => void;
}) {
  const { theme } = useTheme();
  const C = theme.colors;
  const {
    data: categories = [],
    isLoading: categoriesLoading,
    refetch: refetchCategories,
  } = useListCategoriesQuery();

  const [getSubcategories] = useLazyListSubcategoriesByCategoryQuery();
  const [getComponents] = useLazyListComponentsBySubcategoryQuery();

  const [categoriesWithCounts, setCategoriesWithCounts] = useState<
    CategoryWithCounts[]
  >([]);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCounts = useCallback(
    async (cats: Category[]) => {
      if (!cats.length) {
        setCategoriesWithCounts([]);
        setLoadingCounts(false);
        return;
      }
      setLoadingCounts(true);
      const enriched: CategoryWithCounts[] = [];

      for (const cat of cats) {
        const subResult = await getSubcategories(cat.id).unwrap();
        const subcategories = subResult || [];
        const subcategoryCount = subcategories.length;

        let componentCount = 0;
        let lowStockCount = 0;

        for (const sub of subcategories) {
          const compResult = await getComponents(sub.id).unwrap();
          const components = compResult || [];
          componentCount += components.length;
          lowStockCount += components.filter(
            (c) => (c.currentStock ?? 0) < (c.minimumStock ?? 0),
          ).length;
        }

        enriched.push({
          ...cat,
          subcategoryCount,
          componentCount,
          lowStockCount,
        });
      }

      setCategoriesWithCounts(enriched);
      setLoadingCounts(false);
    },
    [getSubcategories, getComponents],
  );

  // Initial load or when categories change
  useEffect(() => {
    fetchCounts(categories);
  }, [categories, fetchCounts]);

  const onRefresh = async () => {
    setRefreshing(true);
    const result = await refetchCategories();
    if (result.data) {
      // Categories updated, fetchCounts will re-run automatically via useEffect
    }
    setRefreshing(false);
  };

  const isLoading = categoriesLoading || loadingCounts;
  const totalCategories = categoriesWithCounts.length;
  const totalComponents = categoriesWithCounts.reduce(
    (sum, cat) => sum + cat.componentCount,
    0,
  );
  const totalLowStock = categoriesWithCounts.reduce(
    (sum, cat) => sum + cat.lowStockCount,
    0,
  );

  const summaryItems = [
    { label: "CATEGORIES", val: totalCategories, warn: false },
    { label: "COMPONENTS", val: totalComponents, warn: false },
    { label: "LOW STOCK", val: totalLowStock, warn: totalLowStock > 0 },
  ];

  if (isLoading && !refreshing) {
    return (
      <NonTabScreen
        title="Inventory Management"
        subtitle="Track inventory"
        showBack
        scrollable
      >
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" />
        </View>
      </NonTabScreen>
    );
  }

  return (
    <NonTabScreen
      title="Inventory Management"
      subtitle="Track inventory"
      showBack
      scrollable
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <StatusBar barStyle="light-content" backgroundColor={C.background} />
      <CustomScrollView>
        <View style={styles.summaryRow}>
          {summaryItems.map((item) => (
            <View
              key={item.label}
              style={[
                styles.summaryCard,
                {
                  backgroundColor: C.card,
                  borderColor: item.warn ? C.warning + "40" : C.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.summaryVal,
                  { color: item.warn ? C.warning : C.text },
                ]}
              >
                {item.val}
              </Text>
              <Text style={[styles.summaryLabel, { color: C.textMuted }]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
        <Text
          style={[
            styles.sectionLabel,
            { color: C.accent, marginBottom: 10, marginHorizontal: 2 },
          ]}
        >
          CATEGORY SELECTION
        </Text>
        {categoriesWithCounts.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.catRow,
              {
                backgroundColor: C.card,
                borderColor:
                  cat.lowStockCount > 0 ? C.warning + "40" : C.border,
              },
            ]}
            onPress={() => onSelectCategory(cat)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.catIcon,
                { backgroundColor: C.background, borderColor: C.border },
              ]}
            >
              <Package size={18} color={C.accent} />
            </View>
            <View style={styles.catInfo}>
              <Text style={[styles.catName, { color: C.text }]}>
                {cat.categoryName}
              </Text>
              <Text style={[styles.catMeta, { color: C.textMuted }]}>
                {cat.subcategoryCount} subcategories · {cat.componentCount}{" "}
                components
              </Text>
            </View>
            <View style={styles.catRight}>
              {cat.lowStockCount > 0 && (
                <View
                  style={[styles.tagWarning, { borderColor: C.warning + "40" }]}
                >
                  <Text style={[styles.tagText, { color: C.warning }]}>
                    {cat.lowStockCount} low
                  </Text>
                </View>
              )}
              <ChevronRight size={16} color={C.textMuted} />
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 40 }} />
      </CustomScrollView>
    </NonTabScreen>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
  },
  summaryVal: { fontSize: 22, fontWeight: "800" },
  summaryLabel: {
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 3,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  catIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  catInfo: { flex: 1 },
  catName: { fontSize: 15, fontWeight: "700" },
  catMeta: { fontSize: 11, marginTop: 2 },
  catRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  tagWarning: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#2e1f00",
  },
  tagText: { fontSize: 10, fontWeight: "700" },
});
