// src/screens/IMSSubcategoryScreen.tsx
import { NonTabScreen } from "@/components/ui/non-tab-screen";
import { CustomScrollView } from "@/components/ui/scrollView";

import { useTheme } from "@/src/contexts/theme-context";
import {
    useDeleteComponentMutation,
    useListComponentsBySubcategoryQuery,
    useListSubcategoriesByCategoryQuery,
    useUpdateComponentMutation,
} from "@/src/state/api";

import { ArrowLeft, Search } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import ComponentCard from "./ComponentCard";
import DeleteConfirmModal from "./DeleteConfirmModal";
import EditComponentModal from "./EditComponentModal";

interface Props {
  category: Category;
  onBack: () => void;
}

export default function IMSSubcategoryScreen({ category, onBack }: Props) {
  const { theme } = useTheme();
  const C = theme.colors;
  const { data: subcategories = [], isLoading: subsLoading } =
    useListSubcategoriesByCategoryQuery(category.id);
  const [selectedSubId, setSelectedSubId] = useState<string>(
    subcategories[0]?.id ?? "",
  );
  const {
    data: componentsRaw = [],
    isLoading: compsLoading,
    refetch,
  } = useListComponentsBySubcategoryQuery(selectedSubId, {
    skip: !selectedSubId,
  });
  const [updateComponent] = useUpdateComponentMutation();
  const [deleteComponent] = useDeleteComponentMutation();

  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<
    "all" | "in-stock" | "out-of-stock"
  >("all");
  const [editTarget, setEditTarget] = useState<Component | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  // Local overrides for optimistic updates
  const [compOverrides, setCompOverrides] = useState<
    Record<string, Component[]>
  >({});
  const allComponents: Component[] = useMemo(() => {
    const base = compOverrides[selectedSubId] ?? componentsRaw;
    return base;
  }, [selectedSubId, componentsRaw, compOverrides]);

  const filtered = useMemo(() => {
    return allComponents.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch =
        search.length < 2 ||
        c.componentId.toLowerCase().includes(q) ||
        (c.componentName ?? "").toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q) ||
        (c.primarySupplier ?? "").toLowerCase().includes(q);
      const matchStock =
        stockFilter === "all" ||
        (stockFilter === "in-stock" && c.currentStock >= c.minimumStock) ||
        (stockFilter === "out-of-stock" && c.currentStock < c.minimumStock);
      return matchSearch && matchStock;
    });
  }, [allComponents, search, stockFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filterLabels = [
    { key: "all", label: "ALL" },
    { key: "in-stock", label: "IN STOCK" },
    { key: "out-of-stock", label: "OUT" },
  ] as const;

  const handleUpdateComponent = async (updated: Component) => {
    // Optimistic update
    setCompOverrides((prev) => ({
      ...prev,
      [selectedSubId]: allComponents.map((c) =>
        c.id === updated.id ? updated : c,
      ),
    }));
    try {
      await updateComponent(updated).unwrap();
      refetch();
    } catch (err) {
      // revert optimistic update on error
      refetch();
    }
  };

  const handleDeleteComponent = async (compId: string) => {
    // Optimistic delete
    setCompOverrides((prev) => ({
      ...prev,
      [selectedSubId]: allComponents.filter((c) => c.id !== compId),
    }));
    try {
      await deleteComponent(compId).unwrap();
      refetch();
    } catch (err) {
      refetch();
    }
  };

  if (subsLoading)
    return <ActivityIndicator size="large" style={{ marginTop: 50 }} />;

  const selectedSub = subcategories.find((s) => s.id === selectedSubId);

  return (
    <NonTabScreen
      title="Inventory Management"
      subtitle="Track your inventory"
      showBack
      scrollable
    >
      <StatusBar barStyle="light-content" backgroundColor={C.background} />
      <View
        style={[
          styles.navbar,
          { backgroundColor: C.glass, borderBottomColor: C.border },
        ]}
      >
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={22} color={C.text} />
        </TouchableOpacity>
        <View style={styles.navCenter}>
          <Text style={[styles.navTitle, { color: C.text }]}>
            {category.categoryName}
          </Text>
          <Text style={[styles.navSub, { color: C.accent }]}>
            {subcategories.length} subcategories
          </Text>
        </View>
        <View style={[styles.tagBlue, { borderColor: C.info + "30" }]}>
          <Text style={[styles.tagText, { color: C.info }]}>
            {allComponents.length} items
          </Text>
        </View>
      </View>

      <CustomScrollView>
        <View
          style={[
            styles.card,
            { backgroundColor: C.card, borderColor: C.border },
          ]}
        >
          <Text style={[styles.sectionLabel, { color: C.accent }]}>
            SUBCATEGORY
          </Text>
          <CustomScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {subcategories.map((sub) => {
                const active = sub.id === selectedSubId;
                return (
                  <TouchableOpacity
                    key={sub.id}
                    style={[
                      styles.chip,
                      { borderColor: active ? C.text : C.border },
                      active && { backgroundColor: C.text },
                    ]}
                    onPress={() => {
                      setSelectedSubId(sub.id);
                      setPage(1);
                      setSearch("");
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? C.background : C.textMuted },
                      ]}
                    >
                      {sub.subcategoryName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </CustomScrollView>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: C.card, borderColor: C.border },
          ]}
        >
          <View
            style={[
              styles.searchWrap,
              { backgroundColor: C.background, borderColor: C.border },
            ]}
          >
            <Search size={14} color={C.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: C.text }]}
              placeholder="Search by ID, name, supplier…"
              placeholderTextColor={C.textMuted}
              value={search}
              onChangeText={(v) => {
                setSearch(v);
                setPage(1);
              }}
            />
          </View>
          <View style={styles.filterRow}>
            {filterLabels.map((f) => {
              const active = stockFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    styles.filterPill,
                    { borderColor: C.border },
                    active && { backgroundColor: C.text, borderColor: C.text },
                  ]}
                  onPress={() => {
                    setStockFilter(f.key);
                    setPage(1);
                  }}
                >
                  <Text
                    style={[
                      styles.filterText,
                      { color: active ? C.background : C.textMuted },
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.resultCount, { color: C.textMuted }]}>
            {filtered.length} component{filtered.length !== 1 ? "s" : ""}
          </Text>
        </View>

        {compsLoading ? (
          <ActivityIndicator size="large" style={{ marginTop: 20 }} />
        ) : paginated.length === 0 ? (
          <Text style={[styles.emptyText, { color: C.textMuted }]}>
            No components match your filters.
          </Text>
        ) : (
          paginated.map((comp) => (
            <ComponentCard
              key={comp.id}
              component={comp}
              onEdit={setEditTarget}
              onDelete={(id, name) => setDeleteTarget({ id, name })}
            />
          ))
        )}

        {totalPages > 1 && (
          <View style={styles.pagination}>
            <Text style={[styles.pageInfo, { color: C.textMuted }]}>
              Page {page} / {totalPages}
            </Text>
            <View style={styles.pageButtons}>
              <TouchableOpacity
                style={[
                  styles.pageBtn,
                  { borderColor: C.border, opacity: page === 1 ? 0.4 : 1 },
                ]}
                disabled={page === 1}
                onPress={() => setPage((p) => p - 1)}
              >
                <Text style={[styles.pageBtnText, { color: C.textMuted }]}>
                  PREV
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.pageBtn,
                  {
                    borderColor: C.border,
                    opacity: page === totalPages ? 0.4 : 1,
                  },
                ]}
                disabled={page === totalPages}
                onPress={() => setPage((p) => p + 1)}
              >
                <Text style={[styles.pageBtnText, { color: C.textMuted }]}>
                  NEXT
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        <View style={{ height: 40 }} />
      </CustomScrollView>

      {editTarget && (
        <EditComponentModal
          component={editTarget}
          visible={!!editTarget}
          onClose={() => setEditTarget(null)}
          onSave={(updated) => {
            handleUpdateComponent(updated);
            setEditTarget(null);
          }}
        />
      )}

      <DeleteConfirmModal
        visible={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            handleDeleteComponent(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </NonTabScreen>
  );
}

const styles = StyleSheet.create({
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: { marginRight: 8 },
  navCenter: { flex: 1 },
  navTitle: { fontSize: 15, fontWeight: "700", letterSpacing: 1 },
  navSub: { fontSize: 11, letterSpacing: 0.5, marginTop: 1 },
  tagBlue: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#0a1a2e",
  },
  tagText: { fontSize: 10, fontWeight: "700" },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 5 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 13 },
  filterRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  filterPill: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 7,
    alignItems: "center",
  },
  filterText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  resultCount: { fontSize: 11 },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  pageInfo: { fontSize: 11 },
  pageButtons: { flexDirection: "row", gap: 8 },
  pageBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pageBtnText: { fontSize: 11, fontWeight: "700" },
  emptyText: { textAlign: "center", padding: 32, fontSize: 13 },
});
