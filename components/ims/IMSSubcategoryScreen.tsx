// src/screens/IMSSubcategoryScreen.tsx (updated)
import { NonTabScreen } from "@/components/ui/non-tab-screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { usePaginatedComponents } from "@/hooks/usePaginatedComponents";
import { useTheme } from "@/src/contexts/theme-context";
import {
  useDeleteComponentMutation,
  useListSubcategoriesByCategoryQuery,
  useUpdateComponentMutation,
} from "@/src/state/api";
import { ArrowLeft, Search } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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

  // Use the paginated hook instead of the old one
  const {
    items: components,
    loading: compsLoading,
    fetchingMore,
    loadMore,
    hasMore,
    refresh,
  } = usePaginatedComponents(selectedSubId, 20);

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

  // Filter locally (client‑side) – works on already loaded items
  const filtered = components.filter((c) => {
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

  const filterLabels = [
    { key: "all", label: "ALL" },
    { key: "in-stock", label: "IN STOCK" },
    { key: "out-of-stock", label: "OUT" },
  ] as const;

  const handleUpdateComponent = async (updated: Component) => {
    // Optimistic update (client‑side)
    try {
      await updateComponent(updated).unwrap();
      refresh(); // reload first page to sync
    } catch (err) {
      refresh();
    }
  };

  const handleDeleteComponent = async (compId: string) => {
    try {
      await deleteComponent(compId).unwrap();
      refresh(); // reload after deletion
    } catch (err) {
      refresh();
    }
  };

  if (subsLoading) {
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

  const selectedSub = subcategories.find((s) => s.id === selectedSubId);

  // Header component for FlatList (subcategory chips + search/filter)
  const ListHeader = () => (
    <>
      {/* Subcategory chips */}
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

      {/* Search & filter card */}
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
            onChangeText={setSearch}
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
                onPress={() => setStockFilter(f.key)}
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
    </>
  );

  // Footer loading indicator
  const ListFooter = () =>
    fetchingMore ? <ActivityIndicator style={{ margin: 20 }} /> : null;

  return (
    <NonTabScreen
      title="Inventory Management"
      subtitle="Track your inventory"
      showBack
      scrollable={false}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.background} />
      {/* Navbar */}
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
            {components.length} items
          </Text>
        </View>
      </View>

      {/* Main list with infinite scroll */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ComponentCard
            component={item}
            onEdit={setEditTarget}
            onDelete={(id, name) => setDeleteTarget({ id, name })}
          />
        )}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshing={compsLoading && components.length === 0}
        onRefresh={refresh}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}
      />

      {/* Modals */}
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

// Styles – keep exactly as you had them (no changes needed)
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
