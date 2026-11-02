// components/ims/IMSCategoryListScreen.tsx
import { NonTabScreen } from "@/components/screens/non-tab-screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/src/contexts/theme-context";
import {
  useInventoryCountsQuery,
  useListCategoriesQuery,
} from "@/src/state/api";
import { ChevronRight, Package } from "lucide-react-native";
import { useState } from "react";
import {
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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

  const {
    data: counts,
    isLoading: countsLoading,
    refetch: refetchCounts,
  } = useInventoryCountsQuery();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchCategories(), refetchCounts()]);
    } finally {
      setRefreshing(false);
    }
  };

  const countsByCategory = new Map(
    (counts?.categories ?? []).map((c) => [c.categoryId, c]),
  );

  const totals = counts?.totals ?? {
    subcategoryCount: 0,
    componentCount: 0,
    lowStockCount: 0,
  };
  const countsPending = countsLoading || !counts;

  if (categoriesLoading) {
    return (
      <NonTabScreen
        title="Inventory Management"
        subtitle="Track inventory"
        showBack
        scrollable
      >
        <View style={{ padding: 16 }}>
          <ListSkeleton lines={2} />
        </View>
      </NonTabScreen>
    );
  }

  const summaryItems = [
    {
      label: "CATEGORIES",
      val: categories.length,
      warn: false,
      pending: false,
    },
    {
      label: "COMPONENTS",
      val: totals.componentCount,
      warn: false,
      pending: countsPending,
    },
    {
      label: "LOW STOCK",
      val: totals.lowStockCount,
      warn: totals.lowStockCount > 0,
      pending: countsPending,
    },
  ];

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
                {item.pending ? "…" : item.val}
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

        {categories.map((cat) => {
          const c = countsByCategory.get(cat.id);
          const lowStock = c?.lowStockCount ?? 0;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.catRow,
                {
                  backgroundColor: C.card,
                  borderColor: lowStock > 0 ? C.warning + "40" : C.border,
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
                  {c
                    ? `${c.subcategoryCount} subcategories · ${c.componentCount} components`
                    : "Loading counts…"}
                </Text>
              </View>
              <View style={styles.catRight}>
                {lowStock > 0 && (
                  <View
                    style={[
                      styles.tagWarning,
                      { borderColor: C.warning + "40" },
                    ]}
                  >
                    <Text style={[styles.tagText, { color: C.warning }]}>
                      {lowStock} low
                    </Text>
                  </View>
                )}
                <ChevronRight size={16} color={C.textMuted} />
              </View>
            </TouchableOpacity>
          );
        })}
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
