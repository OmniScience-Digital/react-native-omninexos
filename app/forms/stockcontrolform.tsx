import ComponentItem, {
  Category,
  Component,
} from "@/components/stockcontrolComponents/componentitem";
import ComponentLoading from "@/components/stockcontrolComponents/Componentloading";
import ResponseModal from "@/components/stockcontrolComponents/responsemodal";
import { NonTabScreen } from "@/components/ui/non-tab-screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useTheme } from "@/src/contexts/theme-context";
import { Minus, Plus, PlusCircle } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

// ── Mock data for UI preview ──────────────────────────────────────────────
const MOCK_CATEGORIES: Category[] = [
  { id: "1", categoryName: "Electrical" },
  { id: "2", categoryName: "Mechanical" },
  { id: "3", categoryName: "Safety Equipment" },
];

const MOCK_SUBCATEGORIES = [
  { id: "s1", subcategoryName: "Cables", categoryId: "1" },
  { id: "s2", subcategoryName: "Fuses", categoryId: "1" },
  { id: "s3", subcategoryName: "Bearings", categoryId: "2" },
];

const MOCK_COMPONENTS = [
  { componentId: "Cable 6mm", subcategoryId: "s1" },
  { componentId: "Cable 10mm", subcategoryId: "s1" },
  { componentId: "Fuse 15A", subcategoryId: "s2" },
  { componentId: "Bearing 6205", subcategoryId: "s3" },
];

function makeEmptyComponent(): Component {
  const id = Date.now().toString();
  return {
    id,
    componentId: "",
    componentName: "",
    subcategoryId: "",
    subComponents: [{ id: `${id}-1`, key: "", value: "", componentId: id }],
  };
}

export default function StockControlForm() {
  const { theme } = useTheme();
  const { colors, radius, spacing, typography } = theme;

  const [loading] = useState(false);
  const [loadingBtn, setLoadingBtn] = useState(false);
  const [transactionType, setTransactionType] = useState<boolean>(false); // false = Intake, true = Withdrawal
  const [components, setComponents] = useState<Component[]>([
    makeEmptyComponent(),
  ]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<
    Record<string, string>
  >({});
  const [show, setShow] = useState(false);
  const [successful, setSuccessful] = useState(false);
  const [message, setMessage] = useState("");

  const addComponent = () => {
    setComponents((prev) => [makeEmptyComponent(), ...prev]);
  };

  const updateComponent = (id: string, updated: Component) => {
    setComponents((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const removeComponent = (id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  };

  const updateCategoryId = (componentId: string, categoryId: string) => {
    setSelectedCategoryIds((prev) => ({ ...prev, [componentId]: categoryId }));
  };

  const getUsedKeys = () =>
    components.flatMap((c) =>
      c.subComponents.map((s) => s.key).filter(Boolean),
    );

  const getUsedSubcategoryIds = (excludeId: string) =>
    components
      .filter((c) => c.id !== excludeId && c.subcategoryId)
      .map((c) => c.subcategoryId);

  // UI-only submit
  const handleSubmit = () => {
    setLoadingBtn(true);
    setTimeout(() => {
      setLoadingBtn(false);
      setSuccessful(true);
      setMessage("Successfully published to ClickUp");
      setShow(true);
    }, 1400);
  };

  return (
    <NonTabScreen
      title="Stock Control"
      subtitle="Complete all sections"
      showBack={true}
      scrollable={true}
      footerText="Omninexos Fleet Management © 2026"
    >
      {loading ? (
        <View style={s.centeredLoader}>
          <ComponentLoading />
        </View>
      ) : (
        <CustomScrollView>
          {/* Card */}
          <View
            style={[
              s.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radius.xl,
              },
            ]}
          >
            {/* Card header */}
            <View style={[s.cardHeader, { borderBottomColor: colors.border }]}>
              <Text
                style={[
                  s.cardTitle,
                  { color: colors.text, fontSize: typography.h2 },
                ]}
              >
                Stock Control Form
              </Text>
            </View>

            <View style={[s.cardBody, { gap: spacing.md }]}>
              {/* Transaction type toggle */}
              <View
                style={[
                  s.toggleRow,
                  {
                    backgroundColor: colors.background,
                    borderRadius: radius.md,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[s.toggleLabel, { color: colors.text }]}>
                  Transaction Type:
                </Text>
                <View style={s.toggleBtns}>
                  <TouchableOpacity
                    style={[
                      s.toggleBtn,
                      { borderRadius: radius.md, borderColor: colors.border },
                      !transactionType && {
                        backgroundColor: colors.success,
                        borderColor: colors.success,
                      },
                    ]}
                    onPress={() => setTransactionType(false)}
                    activeOpacity={0.7}
                  >
                    <Plus
                      size={13}
                      color={!transactionType ? "#fff" : colors.textMuted}
                    />
                    <Text
                      style={[
                        s.toggleBtnText,
                        { color: !transactionType ? "#fff" : colors.textMuted },
                      ]}
                    >
                      Intake
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      s.toggleBtn,
                      { borderRadius: radius.md, borderColor: colors.border },
                      transactionType && {
                        backgroundColor: "#ef4444",
                        borderColor: "#ef4444",
                      },
                    ]}
                    onPress={() => setTransactionType(true)}
                    activeOpacity={0.7}
                  >
                    <Minus
                      size={13}
                      color={transactionType ? "#fff" : colors.textMuted}
                    />
                    <Text
                      style={[
                        s.toggleBtnText,
                        { color: transactionType ? "#fff" : colors.textMuted },
                      ]}
                    >
                      Withdrawal
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Add Category button */}
              <View style={{ alignItems: "flex-end" }}>
                <TouchableOpacity
                  style={[
                    s.addCatBtn,
                    { borderColor: colors.border, borderRadius: radius.md },
                  ]}
                  onPress={addComponent}
                  activeOpacity={0.7}
                >
                  <PlusCircle size={15} color={colors.textMuted} />
                  <Text style={[s.addCatText, { color: colors.textMuted }]}>
                    Add Category
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Component list */}
              {components.map((comp) => (
                <ComponentItem
                  key={comp.id}
                  component={comp}
                  selectedCategoryId={selectedCategoryIds[comp.id] ?? ""}
                  onCategoryChange={(id) => updateCategoryId(comp.id, id)}
                  categories={MOCK_CATEGORIES}
                  onUpdate={(updated) => updateComponent(comp.id, updated)}
                  onRemove={() => removeComponent(comp.id)}
                  isRemovable={true}
                  usedKeys={getUsedKeys()}
                  usedSubcategoryIds={getUsedSubcategoryIds(comp.id)}
                  availableSubcategories={MOCK_SUBCATEGORIES.filter(
                    (s) =>
                      s.categoryId === (selectedCategoryIds[comp.id] ?? ""),
                  )}
                  availableComponents={MOCK_COMPONENTS}
                />
              ))}

              {/* Submit */}
              {components.length > 0 && (
                <TouchableOpacity
                  style={[
                    s.submitBtn,
                    {
                      backgroundColor: loadingBtn
                        ? colors.textMuted
                        : colors.accent,
                      borderRadius: radius.md,
                    },
                  ]}
                  onPress={handleSubmit}
                  disabled={loadingBtn}
                  activeOpacity={0.8}
                >
                  {loadingBtn ? (
                    <View style={s.submitInner}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={s.submitText}>Submitting…</Text>
                    </View>
                  ) : (
                    <Text style={s.submitText}>Submit</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </CustomScrollView>
      )}

      <ResponseModal
        visible={show}
        successful={successful}
        message={message}
        onClose={() => setShow(false)}
      />
    </NonTabScreen>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
  headerSub: { fontSize: 12 },
  centeredLoader: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16 },
  card: { borderWidth: 0.5, overflow: "hidden" },
  cardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  cardTitle: { fontWeight: "600" },
  cardBody: { padding: 16 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    padding: 12,
    borderWidth: 0.5,
  },
  toggleLabel: { fontSize: 13, fontWeight: "600" },
  toggleBtns: { flexDirection: "row", gap: 8 },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  toggleBtnText: { fontSize: 13, fontWeight: "500" },
  addCatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
  },
  addCatText: { fontSize: 13 },
  submitBtn: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  submitInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  footer: {
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: 0.5,
  },
  footerText: { fontSize: 12 },
});
