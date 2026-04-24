// components/stockcontrol/ComponentItem.tsx
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
  Plus,
  PlusCircle,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ResponseModal from "../responsemodal";
import { ThemedText } from "../ui/screen";
import ComponentLoading from "./Componentloading";

// ------------------------------------------------------------------------
// Helper components (same as in your RN version)
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
// Main ComponentItem
// ------------------------------------------------------------------------
export interface ComponentItemProps {
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
  const { colors, radius } = theme;
  const dispatch = useAppDispatch();
  const [newSubcompModalVisible, setNewSubcompModalVisible] = useState(false);
  const [newSubcompName, setNewSubcompName] = useState("");
  const [addingKeyForSubId, setAddingKeyForSubId] = useState<string | null>(
    null,
  );

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
  const [keyOpenFor, setKeyOpenFor] = useState<string | null>(null);
  const [keySearch, setKeySearch] = useState("");
  const [addingKeyFor, setAddingKeyFor] = useState<string | null>(null);
  const [newKeyInput, setNewKeyInput] = useState("");
  const [permMsg, setPermMsg] = useState("");
  const [showPerm, setShowPerm] = useState(false);

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
  const availableKeys = allComponents
    .map((c) => c.componentId || c.componentName)
    .filter(Boolean);
  const filteredKeys = availableKeys.filter((k) =>
    k.toLowerCase().includes(keySearch.toLowerCase()),
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

  const confirmNewKey = (subId: string) => {
    if (!newKeyInput.trim()) return;
    const tempId = `temp-comp-${Date.now()}`;
    dispatch(
      addTempComponent({
        id: tempId,
        componentId: newKeyInput.trim(),
        componentName: newKeyInput.trim(),
        subcategoryId: component.subcategoryId,
      }),
    );
    onUpdate({
      ...component,
      subComponents: component.subComponents.map((s: any) =>
        s.id === subId ? { ...s, key: newKeyInput.trim() } : s,
      ),
    });
    setAddingKeyFor(null);
    setNewKeyInput("");
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
      {/* Category row */}
      <View style={sCard.row}>
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

      {/* Subcomponents section */}
      <View style={[sCard.subSection, { borderLeftColor: colors.info + "60" }]}>
        <View style={sCard.subHeader}>
          <Text style={[sCard.subTitle, { color: colors.textMuted }]}>
            Subcomponents
          </Text>
          <View
            style={[
              sCard.countBadge,
              { backgroundColor: colors.background, borderRadius: radius.md },
            ]}
          >
            <Text style={[sCard.countText, { color: colors.textMuted }]}>
              {component.subComponents.length}
            </Text>
          </View>
        </View>

        {component.subComponents.map((sub: any) => (
          <View
            key={sub.id}
            style={[
              sCard.subRow,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderRadius: radius.md,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              {/* {addingKeyFor === sub.id ? (
                <AddNewInput
                  value={newKeyInput}
                  onChange={setNewKeyInput}
                  onConfirm={() => confirmNewKey(sub.id)}
                  onCancel={() => {
                    setAddingKeyFor(null);
                    setNewKeyInput("");
                  }}
                  placeholder="New subcomponent name…"
                  confirmDisabled={!newKeyInput.trim()}
                  colors={colors}
                  radius={radius}
                />
              ) : (
                <SelectTrigger
                  label={sub.key}
                  placeholder="Select subcomponent"
                  onPress={() => {
                    setKeyOpenFor(sub.id);
                    setKeySearch("");
                  }}
                  colors={colors}
                  radius={radius}
                />
              )} */}

              <SelectTrigger
                label={sub.key}
                placeholder="Select subcomponent"
                onPress={() => {
                  setKeyOpenFor(sub.id);
                  setKeySearch("");
                }}
                colors={colors}
                radius={radius}
              />
            </View>
            <TextInput
              style={[
                sCard.valueInput,
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
            />
            <TouchableOpacity
              style={[
                sCard.trashBtnSm,
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
        ))}

        <TouchableOpacity
          style={[
            sCard.addSubBtn,
            { borderColor: colors.border, borderRadius: radius.md },
          ]}
          onPress={addSubComponent}
        >
          <PlusCircle size={15} color={colors.textMuted} />
          <Text style={[sCard.addSubText, { color: colors.textMuted }]}>
            Add Subcomponent
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown modals */}
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
        addNewLabel="Add New Category…"
        onAddNew={() => {
          setCatOpen(false);
          setAddingCategory(true);
        }}
        colors={colors}
        radius={radius}
      />

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
        addNewLabel="Add New Subcategory…"
        onAddNew={() => {
          setSubcatOpen(false);
          setAddingSubcat(true);
        }}
        colors={colors}
        radius={radius}
      />

      {keyOpenFor && (
        <DropdownModal
          visible={!!keyOpenFor}
          onClose={() => {
            setKeyOpenFor(null);
            setKeySearch("");
          }}
          items={filteredKeys.map((k) => ({ id: k, label: k }))}
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
          addNewLabel="Add New Subcomponent…"
          // onAddNew={() => {
          //   setKeyOpenFor(null);
          //   setAddingKeyFor(keyOpenFor);
          //   setNewKeyInput("");
          // }}
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
              New Subcomponent
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
                style={[modalStyles.button]}
                onPress={() => setNewSubcompModalVisible(false)}
              >
                <ThemedText style={[modalStyles.buttonText]}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  modalStyles.button,
                  { backgroundColor: colors.accent, borderRadius: radius.md },
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
                    // Update the specific subcomponent's key
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
                <ThemedText style={[modalStyles.buttonText]}>Add</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  card: { borderWidth: 0.5, padding: 16, gap: 16 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  label: { fontSize: 13, fontWeight: "500" },
  trashBtn: {
    width: 42,
    height: 42,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  subSection: { borderLeftWidth: 2, paddingLeft: 12, gap: 10 },
  subHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subTitle: { fontSize: 13, fontWeight: "500" },
  countBadge: { paddingHorizontal: 8, paddingVertical: 3 },
  countText: { fontSize: 12 },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderWidth: 0.5,
  },
  valueInput: {
    width: 90,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
  },
  trashBtnSm: {
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
  },
  addSubText: { fontSize: 13 },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "80%",
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "500",
    borderRadius: 18,
  },
});
