// components/stockcontrolComponents/componentitem.tsx
import { useTheme } from "@/src/contexts/theme-context";
import {
  useListComponentsBySubcategoryQuery,
  useListSubcategoriesByCategoryQuery,
} from "@/src/state/api";
import { RootState, useAppDispatch, useAppSelector } from "@/src/state/redux";
import {
  addTempCategory,
  addTempComponent,
  addTempSubcategory,
} from "@/src/state/stockSlice";
import { createSelector } from "@reduxjs/toolkit";
import {
  ChevronDown,
  Edit3,
  Plus,
  PlusCircle,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ResponseModal from "../responsemodal";
import { ThemedText } from "../ui/screen";
import ComponentLoading from "./Componentloading";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ------------------------------------------------------------------------
// AddNewInput
// ------------------------------------------------------------------------
function AddNewInput({
  value,
  onChange,
  onConfirm,
  onCancel,
  placeholder,
  confirmDisabled,
  colors,
  radius,
}: any) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      <TextInput
        style={[
          addStyles.input,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.background,
            borderRadius: radius.md,
          },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoFocus
      />
      <TouchableOpacity
        style={[
          addStyles.iconBtn,
          { borderColor: colors.border, borderRadius: radius.md },
        ]}
        onPress={onCancel}
      >
        <X size={15} color={colors.textMuted} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          addStyles.iconBtn,
          {
            borderColor: confirmDisabled ? colors.border : colors.accent,
            backgroundColor: confirmDisabled ? "transparent" : colors.accent,
            borderRadius: radius.md,
          },
        ]}
        onPress={onConfirm}
        disabled={confirmDisabled}
      >
        <Plus size={15} color={confirmDisabled ? colors.textMuted : "#fff"} />
      </TouchableOpacity>
    </View>
  );
}

const addStyles = StyleSheet.create({
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    flex: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ------------------------------------------------------------------------
// DropdownModal
// ------------------------------------------------------------------------
function DropdownModal({
  visible,
  onClose,
  items,
  selectedId,
  onSelect,
  getLabel,
  getId,
  isDisabled,
  disabledLabel,
  searchTerm,
  onSearchChange,
  searchPlaceholder,
  loading,
  emptyText,
  addNewLabel,
  onAddNew,
  colors,
  radius,
}: any) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={dmStyles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            dmStyles.sheet,
            { backgroundColor: colors.card, borderRadius: radius.xl },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View
            style={[dmStyles.searchRow, { borderBottomColor: colors.border }]}
          >
            <Search size={15} color={colors.textMuted} />
            <TextInput
              style={[dmStyles.searchInput, { color: colors.text }]}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={searchTerm}
              onChangeText={onSearchChange}
              autoFocus
            />
            {searchTerm ? (
              <TouchableOpacity onPress={() => onSearchChange("")}>
                <X size={14} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          {loading ? (
            <ComponentLoading />
          ) : (
            <FlatList
              data={items}
              keyExtractor={getId}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => {
                const disabled = isDisabled?.(item) ?? false;
                const active = getId(item) === selectedId;
                return (
                  <TouchableOpacity
                    style={[
                      dmStyles.item,
                      { borderBottomColor: colors.border },
                      active && { backgroundColor: colors.accent + "18" },
                    ]}
                    onPress={() => {
                      if (!disabled) {
                        onSelect(getId(item));
                        onClose();
                        onSearchChange("");
                      }
                    }}
                  >
                    <Text
                      style={[
                        dmStyles.itemText,
                        { color: disabled ? colors.textMuted : colors.text },
                        active && { color: colors.accent, fontWeight: "600" },
                      ]}
                    >
                      {getLabel(item)}
                    </Text>
                    {disabled && disabledLabel && (
                      <Text
                        style={[
                          dmStyles.disabledTag,
                          { color: colors.warning },
                        ]}
                      >
                        {disabledLabel}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[dmStyles.empty, { color: colors.textMuted }]}>
                  {emptyText ?? "No options"}
                </Text>
              }
              ListFooterComponent={
                addNewLabel && onAddNew ? (
                  <TouchableOpacity
                    style={[dmStyles.addNew, { borderTopColor: colors.border }]}
                    onPress={() => {
                      onAddNew();
                      onClose();
                      onSearchChange("");
                    }}
                  >
                    <PlusCircle size={15} color={colors.info} />
                    <Text style={[dmStyles.addNewText, { color: colors.info }]}>
                      {addNewLabel}
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const dmStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: { overflow: "hidden" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderBottomWidth: 0.5,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 0.5,
  },
  itemText: { fontSize: 14 },
  disabledTag: { fontSize: 11 },
  empty: { padding: 16, textAlign: "center", fontSize: 13 },
  addNew: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderTopWidth: 0.5,
  },
  addNewText: { fontSize: 14, fontWeight: "500" },
});

// ------------------------------------------------------------------------
// SelectTrigger
// ------------------------------------------------------------------------
function SelectTrigger({
  label,
  placeholder,
  onPress,
  disabled,
  colors,
  radius,
}: any) {
  return (
    <TouchableOpacity
      style={[
        stStyles.trigger,
        {
          borderColor: colors.border,
          backgroundColor: disabled ? colors.background : colors.card,
          borderRadius: radius.md,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          stStyles.triggerText,
          { color: label ? colors.text : colors.textMuted },
        ]}
        numberOfLines={1}
      >
        {label || placeholder}
      </Text>
      <ChevronDown size={15} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const stStyles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  triggerText: { flex: 1, fontSize: 14, marginRight: 6 },
});

// ------------------------------------------------------------------------
// SubcomponentsBottomSheet
// ------------------------------------------------------------------------
function SubcomponentsBottomSheet({
  visible,
  onClose,
  component,
  onUpdate,
  allComponents,
  usedKeys,
  dispatch,
  colors,
  radius,
  spacing,
}: any) {
  const [keyOpenFor, setKeyOpenFor] = useState<string | null>(null);
  const [keySearch, setKeySearch] = useState("");
  const [addingKeyForSubId, setAddingKeyForSubId] = useState<string | null>(
    null,
  );
  const [newSubcompName, setNewSubcompName] = useState("");
  const [newSubcompModalVisible, setNewSubcompModalVisible] = useState(false);

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          onClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  // Animate in/out
  useMemo(() => {
    if (visible) {
      translateY.setValue(SCREEN_HEIGHT);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    }
  }, [visible]);

  const availableKeys = allComponents
    .map((c: any) => c.componentId || c.componentName)
    .filter(Boolean);
  const filteredKeys = availableKeys.filter((k: string) =>
    k.toLowerCase().includes(keySearch.toLowerCase()),
  );

  const handleKeySelect = (subId: string, key: string) => {
    onUpdate({
      ...component,
      subComponents: component.subComponents.map((s: any) =>
        s.id === subId ? { ...s, key } : s,
      ),
    });
    setKeyOpenFor(null);
    setKeySearch("");
  };

  const updateValue = (subId: string, value: string) => {
    onUpdate({
      ...component,
      subComponents: component.subComponents.map((s: any) =>
        s.id === subId ? { ...s, value } : s,
      ),
    });
  };

  const addSubComponent = () => {
    onUpdate({
      ...component,
      subComponents: [
        ...component.subComponents,
        {
          id: `${component.id}-${Date.now()}`,
          key: "",
          value: "",
          componentId: component.id,
        },
      ],
    });
  };

  const removeSubComponent = (subId: string) => {
    if (component.subComponents.length <= 1) return;
    onUpdate({
      ...component,
      subComponents: component.subComponents.filter((s: any) => s.id !== subId),
    });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      {/* Backdrop */}
      <TouchableOpacity
        style={bsStyles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Sheet */}
      <Animated.View
        style={[
          bsStyles.sheet,
          {
            backgroundColor: colors.card,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={bsStyles.handleArea}>
          <View style={[bsStyles.handle, { backgroundColor: colors.border }]} />
        </View>

        {/* Header */}
        <View
          style={[bsStyles.sheetHeader, { borderBottomColor: colors.border }]}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={[bsStyles.sheetTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {component.subcategoryName ||
                component.componentName ||
                "Subcomponents"}
            </Text>
            <Text style={[bsStyles.sheetSubtitle, { color: colors.textMuted }]}>
              {component.categoryName
                ? `${component.categoryName} · Edit subcomponents`
                : "Edit subcomponents"}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              bsStyles.closeBtn,
              {
                borderColor: colors.border,
                borderRadius: radius.md,
                backgroundColor: colors.background,
              },
            ]}
            onPress={onClose}
          >
            <X size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Subcomponent rows */}
        <FlatList
          data={component.subComponents}
          keyExtractor={(sub: any) => sub.id}
          style={{ maxHeight: SCREEN_HEIGHT * 0.45 }}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item: sub }: any) => (
            <View
              style={[
                bsStyles.subRow,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  bsStyles.keySelect,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    borderRadius: radius.md,
                  },
                ]}
                onPress={() => {
                  setKeyOpenFor(sub.id);
                  setKeySearch("");
                }}
              >
                <Text
                  style={[
                    bsStyles.keyText,
                    { color: sub.key ? colors.text : colors.textMuted },
                  ]}
                  numberOfLines={1}
                >
                  {sub.key || "Select subcomponent"}
                </Text>
                <ChevronDown size={13} color={colors.textMuted} />
              </TouchableOpacity>

              <TextInput
                style={[
                  bsStyles.valueInput,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    borderRadius: radius.md,
                  },
                ]}
                value={sub.value}
                onChangeText={(v) => updateValue(sub.id, v)}
                placeholder="Value"
                keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
              />

              <TouchableOpacity
                style={[
                  bsStyles.trashBtn,
                  {
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    opacity: component.subComponents.length === 1 ? 0.3 : 1,
                  },
                ]}
                onPress={() => removeSubComponent(sub.id)}
                disabled={component.subComponents.length === 1}
              >
                <Trash2 size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}
          ListFooterComponent={
            <TouchableOpacity
              style={[
                bsStyles.addSubBtn,
                { borderColor: colors.border, borderRadius: radius.md },
              ]}
              onPress={addSubComponent}
            >
              <PlusCircle size={15} color={colors.textMuted} />
              <Text style={[bsStyles.addSubText, { color: colors.textMuted }]}>
                Add subcomponent
              </Text>
            </TouchableOpacity>
          }
        />

        {/* Done button */}
        <View
          style={[
            bsStyles.doneArea,
            { borderTopColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <TouchableOpacity
            style={[
              bsStyles.doneBtn,
              { backgroundColor: colors.accent, borderRadius: radius.md },
            ]}
            onPress={onClose}
          >
            <Text style={bsStyles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Key dropdown */}
      {keyOpenFor && (
        <DropdownModal
          visible={!!keyOpenFor}
          onClose={() => {
            setKeyOpenFor(null);
            setKeySearch("");
          }}
          items={filteredKeys.map((k: string) => ({ id: k, label: k }))}
          selectedId={
            component.subComponents.find((s: any) => s.id === keyOpenFor)
              ?.key ?? ""
          }
          onSelect={(key: string) => handleKeySelect(keyOpenFor, key)}
          getLabel={(item: any) => item.label}
          getId={(item: any) => item.id}
          isDisabled={(item: any) =>
            usedKeys.includes(item.id) &&
            item.id !==
              component.subComponents.find((s: any) => s.id === keyOpenFor)?.key
          }
          disabledLabel="already used"
          searchTerm={keySearch}
          onSearchChange={setKeySearch}
          searchPlaceholder="Search subcomponents…"
          emptyText="No subcomponents available"
          addNewLabel="Add new subcomponent…"
          onAddNew={() => {
            setKeyOpenFor(null);
            setAddingKeyForSubId(keyOpenFor);
            setNewSubcompName("");
            setNewSubcompModalVisible(true);
          }}
          colors={colors}
          radius={radius}
        />
      )}

      {/* New subcomponent name modal */}
      <Modal
        visible={newSubcompModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNewSubcompModalVisible(false)}
      >
        <View style={modalStyles.overlay}>
          <View
            style={[
              modalStyles.container,
              { backgroundColor: colors.card, borderRadius: radius.xl },
            ]}
          >
            <Text style={[modalStyles.title, { color: colors.text }]}>
              New subcomponent
            </Text>
            <TextInput
              style={[
                modalStyles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  borderRadius: radius.md,
                },
              ]}
              placeholder="Enter subcomponent name"
              placeholderTextColor={colors.textMuted}
              value={newSubcompName}
              onChangeText={setNewSubcompName}
              autoFocus
            />
            <View style={modalStyles.buttons}>
              <TouchableOpacity
                style={[
                  modalStyles.button,
                  {
                    borderColor: colors.border,
                    borderRadius: radius.md,
                  },
                ]}
                onPress={() => setNewSubcompModalVisible(false)}
              >
                <ThemedText style={modalStyles.buttonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  modalStyles.button,
                  {
                    backgroundColor: colors.accent,
                    borderRadius: radius.md,
                    borderColor: colors.accent,
                  },
                ]}
                onPress={() => {
                  if (addingKeyForSubId && newSubcompName.trim()) {
                    const tempId = `temp-comp-${Date.now()}`;
                    dispatch(
                      addTempComponent({
                        id: tempId,
                        componentId: newSubcompName.trim(),
                        componentName: newSubcompName.trim(),
                        subcategoryId: component.subcategoryId,
                      }),
                    );
                    onUpdate({
                      ...component,
                      subComponents: component.subComponents.map((s: any) =>
                        s.id === addingKeyForSubId
                          ? { ...s, key: newSubcompName.trim() }
                          : s,
                      ),
                    });
                    setNewSubcompModalVisible(false);
                    setAddingKeyForSubId(null);
                    setNewSubcompName("");
                  }
                }}
                disabled={!newSubcompName.trim()}
              >
                <ThemedText style={[modalStyles.buttonText, { color: "#fff" }]}>
                  Add
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const bsStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  handleArea: {
    alignItems: "center",
    paddingVertical: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  sheetTitle: { fontSize: 16, fontWeight: "600" },
  sheetSubtitle: { fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderWidth: 0.5,
  },
  keySelect: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  keyText: { flex: 1, fontSize: 13, marginRight: 4 },
  valueInput: {
    width: 80,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    textAlign: "center",
  },
  trashBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addSubBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    paddingVertical: 11,
    marginTop: 4,
  },
  addSubText: { fontSize: 13 },
  doneArea: {
    padding: 16,
    borderTopWidth: 0.5,
  },
  doneBtn: {
    paddingVertical: 13,
    alignItems: "center",
  },
  doneBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: { width: "80%", padding: 20, gap: 16 },
  title: { fontSize: 18, fontWeight: "600", textAlign: "center" },
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  buttons: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  button: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  buttonText: { fontSize: 16, fontWeight: "500" },
});

// ------------------------------------------------------------------------
// Main ComponentItem
// ------------------------------------------------------------------------
interface ComponentItemProps {
  component: any;
  selectedCategoryId: string;
  onCategoryChange: (categoryId: string, categoryName: string) => void;
  categories: any[];
  onUpdate: (comp: any) => void;
  onRemove: () => void;
  isRemovable: boolean;
  usedKeys: string[];
  usedSubcategoryIds: string[];
}

export default function ComponentItem({
  component,
  selectedCategoryId,
  onCategoryChange,
  categories,
  onUpdate,
  onRemove,
  isRemovable,
  usedKeys,
  usedSubcategoryIds,
}: ComponentItemProps) {
  const { theme } = useTheme();
  const { colors, radius, spacing } = theme;
  const dispatch = useAppDispatch();

  const [sheetVisible, setSheetVisible] = useState(false);

  // Fetch real data
  const { data: subcategories = [], isLoading: subcatsLoading } =
    useListSubcategoriesByCategoryQuery(selectedCategoryId, {
      skip: !selectedCategoryId,
    });
  const { data: realComponents = [], isLoading: compsLoading } =
    useListComponentsBySubcategoryQuery(component.subcategoryId, {
      skip: !component.subcategoryId,
    });

  const tempCategories = useAppSelector((state) => state.stock.tempCategories);

  const tempSubcategories = useAppSelector(
    useMemo(
      () =>
        createSelector(
          (state: RootState) => state.stock.tempSubcategories,
          (tempSubcategories) =>
            tempSubcategories.filter(
              (s) => s.categoryId === selectedCategoryId,
            ),
        ),
      [selectedCategoryId],
    ),
  );

  const tempComponents = useAppSelector(
    useMemo(
      () =>
        createSelector(
          (state: RootState) => state.stock.tempComponents,
          (tempComponents) =>
            tempComponents.filter(
              (c) => c.subcategoryId === component.subcategoryId,
            ),
        ),
      [component.subcategoryId],
    ),
  );

  const allCategories = [...categories, ...tempCategories];
  const allSubcategories = [...subcategories, ...tempSubcategories];
  const allComponents = [...realComponents, ...tempComponents];

  // Dropdown states
  const [catOpen, setCatOpen] = useState(false);
  const [subcatOpen, setSubcatOpen] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [subcatSearch, setSubcatSearch] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [addingSubcat, setAddingSubcat] = useState(false);
  const [newSubcatInput, setNewSubcatInput] = useState("");
  const [showPerm, setShowPerm] = useState(false);
  const [permMsg, setPermMsg] = useState("");

  const selectedCategory = allCategories.find(
    (c) => c.id === selectedCategoryId,
  );
  const selectedSubcat = allSubcategories.find(
    (s) => s.id === component.subcategoryId,
  );

  const filteredCats = allCategories.filter((c) =>
    c.categoryName.toLowerCase().includes(catSearch.toLowerCase()),
  );
  const filteredSubcats = allSubcategories.filter((s) =>
    s.subcategoryName.toLowerCase().includes(subcatSearch.toLowerCase()),
  );

  const handleCategorySelect = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    onCategoryChange(id, cat?.categoryName || "");
  };

  const confirmNewCategory = () => {
    if (!newCategoryInput.trim()) return;
    const tempId = `temp-cat-${Date.now()}`;
    dispatch(
      addTempCategory({ id: tempId, categoryName: newCategoryInput.trim() }),
    );
    onCategoryChange(tempId, newCategoryInput.trim());
    setAddingCategory(false);
    setNewCategoryInput("");
  };

  const handleSubcatSelect = (id: string) => {
    const sub = allSubcategories.find((s) => s.id === id);
    if (sub) {
      onUpdate({
        ...component,
        componentName: sub.subcategoryName,
        subcategoryId: sub.id,
        subcategoryName: sub.subcategoryName,
      });
    }
  };

  const confirmNewSubcat = () => {
    if (!newSubcatInput.trim()) return;
    const tempId = `temp-sub-${Date.now()}`;
    dispatch(
      addTempSubcategory({
        id: tempId,
        subcategoryName: newSubcatInput.trim(),
        categoryId: selectedCategoryId,
      }),
    );
    onUpdate({
      ...component,
      componentName: newSubcatInput.trim(),
      subcategoryId: tempId,
      subcategoryName: newSubcatInput.trim(),
    });
    setAddingSubcat(false);
    setNewSubcatInput("");
  };

  // Count of filled subcomponents
  const filledCount = component.subComponents.filter((s: any) =>
    s.key.trim(),
  ).length;
  const totalCount = component.subComponents.length;

  return (
    <View
      style={[
        sCard.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: radius.md,
        },
      ]}
    >
      {/* Top row: category + trash */}
      <View style={sCard.topRow}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={[sCard.label, { color: colors.text }]}>Category</Text>
          {addingCategory ? (
            <AddNewInput
              value={newCategoryInput}
              onChange={setNewCategoryInput}
              onConfirm={confirmNewCategory}
              onCancel={() => {
                setAddingCategory(false);
                setNewCategoryInput("");
              }}
              placeholder="New category name…"
              confirmDisabled={!newCategoryInput.trim()}
              colors={colors}
              radius={radius}
            />
          ) : (
            <SelectTrigger
              label={selectedCategory?.categoryName}
              placeholder="Select category"
              onPress={() => setCatOpen(true)}
              colors={colors}
              radius={radius}
            />
          )}
        </View>
        <TouchableOpacity
          style={[
            sCard.trashBtn,
            {
              borderColor: colors.border,
              borderRadius: radius.md,
              opacity: isRemovable ? 1 : 0.35,
            },
          ]}
          onPress={onRemove}
          disabled={!isRemovable}
        >
          <Trash2 size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Subcategory */}
      <View style={{ gap: 5 }}>
        <Text style={[sCard.label, { color: colors.text }]}>Subcategory</Text>
        {addingSubcat ? (
          <AddNewInput
            value={newSubcatInput}
            onChange={setNewSubcatInput}
            onConfirm={confirmNewSubcat}
            onCancel={() => {
              setAddingSubcat(false);
              setNewSubcatInput("");
            }}
            placeholder="New subcategory name…"
            confirmDisabled={!newSubcatInput.trim() || !selectedCategoryId}
            colors={colors}
            radius={radius}
          />
        ) : (
          <SelectTrigger
            label={selectedSubcat?.subcategoryName || component.componentName}
            placeholder="Select subcategory"
            onPress={() => selectedCategoryId && setSubcatOpen(true)}
            disabled={!selectedCategoryId}
            colors={colors}
            radius={radius}
          />
        )}
      </View>

      {/* Subcomponents summary row */}
      <TouchableOpacity
        style={[
          sCard.subSummaryRow,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            borderRadius: radius.md,
          },
        ]}
        onPress={() => setSheetVisible(true)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={[sCard.subSummaryLabel, { color: colors.text }]}>
            Subcomponents
          </Text>
          {/* Preview of filled keys */}
          {filledCount > 0 ? (
            <View style={sCard.previewRow}>
              {component.subComponents
                .filter((s: any) => s.key.trim())
                .slice(0, 3)
                .map((s: any) => (
                  <View
                    key={s.id}
                    style={[
                      sCard.previewChip,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        sCard.previewChipKey,
                        { color: colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {s.key}
                    </Text>
                    {s.value ? (
                      <Text
                        style={[sCard.previewChipValue, { color: colors.text }]}
                      >
                        {s.value}
                      </Text>
                    ) : null}
                  </View>
                ))}
              {filledCount > 3 && (
                <Text style={[sCard.moreText, { color: colors.textMuted }]}>
                  +{filledCount - 3} more
                </Text>
              )}
            </View>
          ) : (
            <Text style={[sCard.subSummaryHint, { color: colors.textMuted }]}>
              Tap to add subcomponents
            </Text>
          )}
        </View>

        <View style={{ alignItems: "flex-end", gap: 6 }}>
          {/* Count badge */}
          <View
            style={[
              sCard.countBadge,
              {
                backgroundColor:
                  filledCount > 0 ? colors.accent + "20" : colors.background,
                borderRadius: radius.md,
                borderColor:
                  filledCount > 0 ? colors.accent + "40" : colors.border,
              },
            ]}
          >
            <Text
              style={[
                sCard.countText,
                {
                  color: filledCount > 0 ? colors.accent : colors.textMuted,
                },
              ]}
            >
              {filledCount}/{totalCount}
            </Text>
          </View>
          {/* Edit icon */}
          <Edit3 size={15} color={colors.textMuted} />
        </View>
      </TouchableOpacity>

      {/* Category dropdown */}
      <DropdownModal
        visible={catOpen}
        onClose={() => {
          setCatOpen(false);
          setCatSearch("");
        }}
        items={filteredCats}
        selectedId={selectedCategoryId}
        onSelect={handleCategorySelect}
        getLabel={(c: any) => c.categoryName}
        getId={(c: any) => c.id}
        searchTerm={catSearch}
        onSearchChange={setCatSearch}
        searchPlaceholder="Search categories…"
        emptyText="No categories found"
        addNewLabel="Add new category…"
        onAddNew={() => {
          setCatOpen(false);
          setAddingCategory(true);
        }}
        colors={colors}
        radius={radius}
      />

      {/* Subcategory dropdown */}
      <DropdownModal
        visible={subcatOpen}
        onClose={() => {
          setSubcatOpen(false);
          setSubcatSearch("");
        }}
        items={filteredSubcats}
        selectedId={component.subcategoryId}
        onSelect={handleSubcatSelect}
        getLabel={(s: any) => s.subcategoryName}
        getId={(s: any) => s.id}
        isDisabled={(s: any) =>
          usedSubcategoryIds.includes(s.id) && s.id !== component.subcategoryId
        }
        disabledLabel="already used"
        searchTerm={subcatSearch}
        onSearchChange={setSubcatSearch}
        searchPlaceholder="Search subcategories…"
        emptyText={
          selectedCategoryId
            ? "No subcategories available"
            : "Select a category first"
        }
        addNewLabel="Add new subcategory…"
        onAddNew={() => {
          setSubcatOpen(false);
          setAddingSubcat(true);
        }}
        colors={colors}
        radius={radius}
      />

      {/* Subcomponents bottom sheet */}
      <SubcomponentsBottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        component={component}
        onUpdate={onUpdate}
        allComponents={allComponents}
        usedKeys={usedKeys}
        dispatch={dispatch}
        colors={colors}
        radius={radius}
        spacing={spacing}
      />

      <ResponseModal
        visible={showPerm}
        successful={false}
        message={permMsg}
        onClose={() => setShowPerm(false)}
      />
    </View>
  );
}

const sCard = StyleSheet.create({
  card: { borderWidth: 0.5, padding: 16, gap: 14 },
  topRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  label: { fontSize: 13, fontWeight: "500" },
  trashBtn: {
    width: 42,
    height: 42,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  subSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    padding: 12,
    gap: 12,
  },
  subSummaryLabel: { fontSize: 13, fontWeight: "500", marginBottom: 5 },
  subSummaryHint: { fontSize: 12 },
  previewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  previewChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  previewChipKey: { fontSize: 11, maxWidth: 80 },
  previewChipValue: { fontSize: 11, fontWeight: "600" },
  moreText: { fontSize: 11, alignSelf: "center" },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 0.5,
  },
  countText: { fontSize: 12, fontWeight: "500" },
});
