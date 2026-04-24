// src/screens/IMSCategoryListScreen.tsx
import { NonTabScreen } from "@/components/ui/non-tab-screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useTheme } from "@/src/contexts/theme-context";
import { useListCategoriesQuery } from "@/src/state/api";
import { ChevronRight, Package } from "lucide-react-native";
import {
    ActivityIndicator,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface Props {
  onSelectCategory: (cat: Category) => void;
}

export default function IMSCategoryListScreen({ onSelectCategory }: Props) {
  const { theme } = useTheme();
  const C = theme.colors;
  const { data: categories = [], isLoading } = useListCategoriesQuery();

  // Dummy summary stats – you can replace with real calculations if you fetch subcategories
  const totalCategories = categories.length;
  const totalComponents = 0; // Placeholder – you'd need to fetch components count
  const totalLow = 0; // Placeholder

  const summaryItems = [
    { label: "CATEGORIES", val: totalCategories, warn: false },
    { label: "COMPONENTS", val: totalComponents, warn: false },
    { label: "LOW STOCK", val: totalLow, warn: totalLow > 0 },
  ];

  if (isLoading)
    return <ActivityIndicator size="large" style={{ marginTop: 50 }} />;

  return (
    <NonTabScreen
      title="Fleet Management"
      subtitle="Complete all sections"
      showBack
      scrollable
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
        {categories.map((cat) => {
          // Placeholder counts – you may want to fetch real counts
          const subcount = 0;
          const compCount = 0;
          const lowComps = 0;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.catRow,
                {
                  backgroundColor: C.card,
                  borderColor: lowComps > 0 ? C.warning + "40" : C.border,
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
                  {subcount} subcategories · {compCount} components
                </Text>
              </View>
              <View style={styles.catRight}>
                {lowComps > 0 && (
                  <View
                    style={[
                      styles.tagWarning,
                      { borderColor: C.warning + "40" },
                    ]}
                  >
                    <Text style={[styles.tagText, { color: C.warning }]}>
                      {lowComps} low
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
