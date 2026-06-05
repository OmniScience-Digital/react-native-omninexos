//forms/StockControlForm.tsx
import ResponseModal from "@/components/responsemodal";
import { NonTabScreen } from "@/components/screens/non-tab-screen";
import ComponentItem from "@/components/stockcontrolComponents/componentitem";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useSeedCategoryCache } from "@/hooks/useCategoryCache";
import { SCF_clickUpService } from "@/services/scf.clickUp.service";
import { enqueue } from "@/services/submissionQueue";
import { useAuth } from "@/src/contexts/auth-context";
import { useTheme } from "@/src/contexts/theme-context";
import { hideResponseModal, showResponseModal } from "@/src/state";
import { useListCategoriesQuery } from "@/src/state/api";
import { useAppDispatch, useAppSelector } from "@/src/state/redux";
import {
  addComponent,
  removeComponent,
  resetStockForm,
  setSelectedCategory,
  setTransactionType,
  updateComponent,
} from "@/src/state/stockSlice";
import NetInfo from "@react-native-community/netinfo";
import { Minus, Plus, PlusCircle, RotateCcw } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function StockControlForm() {
  const { theme } = useTheme();
  const { colors, radius, spacing, typography } = theme;
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const { refetch: refetchCategories } = useListCategoriesQuery();

  const [clearDialogVisible, setClearDialogVisible] = useState(false);

  // Seed category cache when online so dropdowns work offline
  useSeedCategoryCache();

  // ─── Track network reactively ─────────────────────────────
  useEffect(() => {
    NetInfo.fetch().then((state) => {
      setIsOnline(!!(state.isConnected && state.isInternetReachable !== false));
    });
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(!!(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsub();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchCategories();
    setRefreshing(false);
  };

  const dispatch = useAppDispatch();
  const { user } = useAuth();

  const transactionType = useAppSelector(
    (state) => state.stock.transactionType,
  );
  const components = useAppSelector((state) => state.stock.components);
  const selectedCategoryIds = useAppSelector(
    (state) => state.stock.selectedCategoryIds,
  );
  const responseModal = useAppSelector((state) => state.global.responseModal);

  const { data: categories = [], isLoading: categoriesLoading } =
    useListCategoriesQuery();
  const [submitting, setSubmitting] = useState(false);

  const getUsedKeys = () =>
    components.flatMap((c) =>
      c.subComponents.map((s) => s.key).filter(Boolean),
    );

  const getUsedSubcategoryIds = (excludeId: string) =>
    components
      .filter((c) => c.id !== excludeId && c.subcategoryId)
      .map((c) => c.subcategoryId);

  const handleClearForm = () => setClearDialogVisible(true);
  // ─── Build result payload ─────────────────────────────────
  const buildResult = () => {
    const result: Record<string, any> = {};
    for (const comp of components) {
      if (!comp.componentName.trim() || !comp.categoryName) continue;
      const subAcc: Record<string, { value: string }> = {};
      for (const sub of comp.subComponents) {
        if (sub.key.trim()) subAcc[sub.key] = { value: sub.value };
      }
      if (Object.keys(subAcc).length === 0) continue;
      if (!result[comp.categoryName]) result[comp.categoryName] = {};
      const subKey = comp.subcategoryName || comp.componentName;
      result[comp.categoryName][subKey] = {
        isWithdrawal: transactionType,
        subComponents: subAcc,
      };
    }
    return result;
  };

  const isAllValuesEmpty = (obj: any): boolean => {
    const values = JSON.stringify(obj).match(/"value":"(.*?)"/g);
    return !values || values.every((v) => v === '"value":""');
  };

  // ─── handleSubmit ─────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = buildResult();

      if (isAllValuesEmpty(result)) {
        dispatch(
          showResponseModal({
            successful: false,
            message: "Nothing to submit!",
          }),
        );
        return;
      }

      const net = await NetInfo.fetch();
      const online = !!(net.isConnected && net.isInternetReachable);

      if (online) {
        // ── Online: submit to ClickUp now ──
        const response = await SCF_clickUpService.createTask(
          user?.preferred_username,
          result,
        );
        dispatch(
          showResponseModal({
            successful: true,
            message: response.message || "Submitted successfully!",
          }),
        );
      } else {
        // ── Offline: save to SQLite queue ──
        await enqueue("stock", { username: user?.preferred_username, result });
        dispatch(
          showResponseModal({
            successful: true,
            message:
              "No network — saved offline. Will submit automatically when back online.",
          }),
        );
      }

      dispatch(resetStockForm());
    } catch (error: any) {
      dispatch(
        showResponseModal({
          successful: false,
          message: error.message || "Submission failed",
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (categoriesLoading)
    return (
      <NonTabScreen
        title="Stock Control"
        subtitle="Complete all sections"
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

  return (
    <NonTabScreen
      title="Stock Control"
      subtitle="Complete all sections"
      showBack
      scrollable
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <CustomScrollView>
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
          {/* Header */}
          <View style={[s.cardHeader, { borderBottomColor: colors.border }]}>
            <Text
              style={[
                s.cardTitle,
                { color: colors.text, fontSize: typography.h2 },
              ]}
            >
              Stock Control Form
            </Text>
            <TouchableOpacity
              style={[
                s.clearBtn,
                { borderColor: colors.border, borderRadius: radius.md },
              ]}
              onPress={handleClearForm}
            >
              <RotateCcw size={13} color={colors.textMuted} />
              <Text style={[s.clearBtnText, { color: colors.textMuted }]}>
                Clear
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[s.cardBody, { gap: spacing.md }]}>
            {/* Offline indicator */}
            {!isOnline && (
              <View
                style={[
                  s.offlineBadge,
                  {
                    backgroundColor: colors.warning + "20",
                    borderColor: colors.warning + "40",
                    borderRadius: radius.md,
                  },
                ]}
              >
                <Text style={[s.offlineBadgeText, { color: colors.warning }]}>
                  ⚡ Offline — form will be saved and submitted when back online
                </Text>
              </View>
            )}

            {/* Transaction toggle */}
            <View
              style={[
                s.toggleRow,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderRadius: radius.md,
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
                  onPress={() => dispatch(setTransactionType(false))}
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
                  onPress={() => dispatch(setTransactionType(true))}
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

            {/* Add Category */}
            <View style={{ alignItems: "flex-end" }}>
              <TouchableOpacity
                style={[
                  s.addCatBtn,
                  { borderColor: colors.border, borderRadius: radius.md },
                ]}
                onPress={() => dispatch(addComponent())}
              >
                <PlusCircle size={15} color={colors.textMuted} />
                <Text style={[s.addCatText, { color: colors.textMuted }]}>
                  Add Category
                </Text>
              </TouchableOpacity>
            </View>

            {/* Component items */}
            {components.map((comp) => (
              <ComponentItem
                key={comp.id}
                component={comp}
                selectedCategoryId={selectedCategoryIds[comp.id] ?? ""}
                onCategoryChange={(categoryId: string, categoryName: string) =>
                  dispatch(
                    setSelectedCategory({
                      componentId: comp.id,
                      categoryId,
                      categoryName,
                    }),
                  )
                }
                onUpdate={(updated: any) => dispatch(updateComponent(updated))}
                onRemove={() => dispatch(removeComponent(comp.id))}
                isRemovable={components.length > 1}
                usedKeys={getUsedKeys()}
                usedSubcategoryIds={getUsedSubcategoryIds(comp.id)}
                categories={categories}
              />
            ))}

            {/* Submit */}
            {components.length > 0 && (
              <TouchableOpacity
                style={[
                  s.submitBtn,
                  {
                    backgroundColor: submitting
                      ? colors.textMuted
                      : colors.accent,
                    borderRadius: radius.md,
                  },
                ]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <View style={s.submitInner}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={s.submitText}>Submitting…</Text>
                  </View>
                ) : (
                  <Text style={s.submitText}>
                    {isOnline ? "Submit" : "Save Offline"}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </CustomScrollView>
      <ConfirmDialog
        visible={clearDialogVisible}
        title="Clear form?"
        message="This will clear all categories, subcategories and subcomponents. This cannot be undone."
        confirmText="Clear form"
        cancelText="Cancel"
        variant="danger"
        icon={RotateCcw}
        onConfirm={() => dispatch(resetStockForm())}
        onCancel={() => setClearDialogVisible(false)}
      />

      <ResponseModal
        visible={responseModal.visible}
        successful={responseModal.successful}
        message={responseModal.message}
        onClose={() => dispatch(hideResponseModal())}
      />
    </NonTabScreen>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 0.5,
    overflow: "hidden",
    marginHorizontal: 16,
    marginVertical: 12,
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: { fontWeight: "600" },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  clearBtnText: { fontSize: 12 },
  cardBody: { padding: 16 },
  offlineBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 0.5,
  },
  offlineBadgeText: { fontSize: 12, fontWeight: "500", textAlign: "center" },
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
  submitBtn: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  submitInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
