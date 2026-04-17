import { useTheme } from "@/src/contexts/theme-context";
import {
    ChevronDown,
    Plus,
    PlusCircle,
    Search,
    Trash2,
    X,
} from "lucide-react-native";
import { useState } from "react";
import {
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import ComponentLoading from "./Componentloading";
import ResponseModal from "./responsemodal";

export interface SubComponent {
  id: string;
  key: string;
  value: string;
  componentId: string;
}

export interface Component {
  id: string;
  componentId: string;
  componentName: string;
  subcategoryId: string;
  categoryName?: string;
  subcategoryName?: string;
  subComponents: SubComponent[];
}

export interface Category {
  id: string;
  categoryName: string;
}

interface ComponentItemProps {
  component: Component;
  selectedCategoryId: string;
  onCategoryChange: (id: string) => void;
  categories: Category[];
  onUpdate: (c: Component) => void;
  onRemove: () => void;
  isRemovable: boolean;
  usedKeys: string[];
  usedSubcategoryIds?: string[];
  onAddNewKey?: (key: string) => void;
  categoriesLoading?: boolean;
  // For UI preview — pass available subcategories and components
  availableSubcategories?: { id: string; subcategoryName: string }[];
  availableComponents?: { componentId: string; subcategoryId: string }[];
}

// ── Small reusable inline "add new" input row ──────────────────────────────
function AddNewInput({
  value,
  onChange,
  onConfirm,
  onCancel,
  placeholder,
  confirmDisabled,
  colors,
  radius,
}: {
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  placeholder: string;
  confirmDisabled?: boolean;
  colors: any;
  radius: any;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      <TextInput
        style={[
          addStyles.input,
          {
            flex: 1,
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
        activeOpacity={0.7}
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
        activeOpacity={0.7}
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
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ── Searchable dropdown modal ──────────────────────────────────────────────
function DropdownModal<T>({
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
}: {
  visible: boolean;
  onClose: () => void;
  items: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  getLabel: (item: T) => string;
  getId: (item: T) => string;
  isDisabled?: (item: T) => boolean;
  disabledLabel?: string;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  loading?: boolean;
  emptyText?: string;
  addNewLabel?: string;
  onAddNew?: () => void;
  colors: any;
  radius: any;
}) {
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
          {/* Search */}
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
              keyExtractor={(item) => getId(item)}
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
                    activeOpacity={disabled ? 1 : 0.7}
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
                    activeOpacity={0.7}
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

// ── Trigger button (looks like a select) ───────────────────────────────────
function SelectTrigger({
  label,
  placeholder,
  onPress,
  disabled,
  colors,
  radius,
}: {
  label?: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
  colors: any;
  radius: any;
}) {
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
      activeOpacity={0.7}
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

// ── Main ComponentItem ─────────────────────────────────────────────────────
export default function ComponentItem({
  component,
  selectedCategoryId,
  onCategoryChange,
  categories,
  onUpdate,
  onRemove,
  isRemovable,
  usedKeys,
  usedSubcategoryIds = [],
  onAddNewKey,
  categoriesLoading = false,
  availableSubcategories = [],
  availableComponents = [],
}: ComponentItemProps) {
  const { theme } = useTheme();
  const { colors, radius, spacing } = theme;

  // Dropdown open states
  const [catOpen, setCatOpen] = useState(false);
  const [subcatOpen, setSubcatOpen] = useState(false);

  // Search terms
  const [catSearch, setCatSearch] = useState("");
  const [subcatSearch, setSubcatSearch] = useState("");

  // "Add new" inline input states
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [addingSubcat, setAddingSubcat] = useState(false);
  const [newSubcatInput, setNewSubcatInput] = useState("");

  // Per-subcomponent dropdown & add-new state
  const [keyOpenFor, setKeyOpenFor] = useState<string | null>(null);
  const [keySearch, setKeySearch] = useState("");
  const [addingKeyFor, setAddingKeyFor] = useState<string | null>(null);
  const [newKeyInput, setNewKeyInput] = useState("");

  // Permission error modal
  const [show, setShow] = useState(false);
  const [permMsg, setPermMsg] = useState("");

  const filteredCats = categories.filter((c) =>
    c.categoryName.toLowerCase().includes(catSearch.toLowerCase()),
  );

  const filteredSubcats = availableSubcategories.filter((s) =>
    s.subcategoryName.toLowerCase().includes(subcatSearch.toLowerCase()),
  );

  const availableKeys = availableComponents
    .filter((c) => c.subcategoryId === component.subcategoryId)
    .map((c) => c.componentId);

  const filteredKeys = availableKeys.filter((k) =>
    k.toLowerCase().includes(keySearch.toLowerCase()),
  );

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const selectedSubcat = availableSubcategories.find(
    (s) => s.id === component.subcategoryId,
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCategorySelect = (id: string) => {
    onCategoryChange(id);
    onUpdate({
      ...component,
      componentName: "",
      subcategoryId: "",
      subcategoryName: "",
    });
  };

  const confirmNewCategory = () => {
    if (!newCategoryInput.trim()) return;
    const id = `new-cat-${Date.now()}`;
    // In real app: add to state and call onCategoryChange
    onCategoryChange(id);
    onUpdate({
      ...component,
      categoryName: newCategoryInput.trim(),
      componentName: "",
      subcategoryId: "",
    });
    setAddingCategory(false);
    setNewCategoryInput("");
  };

  const handleSubcatSelect = (id: string) => {
    const sub = availableSubcategories.find((s) => s.id === id);
    if (!sub) return;
    onUpdate({
      ...component,
      componentName: sub.subcategoryName,
      subcategoryId: sub.id,
      subcategoryName: sub.subcategoryName,
    });
  };

  const confirmNewSubcat = () => {
    if (!newSubcatInput.trim()) return;
    const id = `temp-sub-${Date.now()}`;
    onUpdate({
      ...component,
      componentName: newSubcatInput.trim(),
      subcategoryId: id,
      subcategoryName: newSubcatInput.trim(),
    });
    setAddingSubcat(false);
    setNewSubcatInput("");
  };

  const handleKeySelect = (subId: string, key: string) => {
    onUpdate({
      ...component,
      subComponents: component.subComponents.map((s) =>
        s.id === subId ? { ...s, key } : s,
      ),
    });
    setKeyOpenFor(null);
    setKeySearch("");
  };

  const confirmNewKey = (subId: string) => {
    if (!newKeyInput.trim()) return;
    onAddNewKey?.(newKeyInput.trim());
    onUpdate({
      ...component,
      subComponents: component.subComponents.map((s) =>
        s.id === subId ? { ...s, key: newKeyInput.trim() } : s,
      ),
    });
    setAddingKeyFor(null);
    setNewKeyInput("");
  };

  const updateValue = (subId: string, value: string) => {
    onUpdate({
      ...component,
      subComponents: component.subComponents.map((s) =>
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
      subComponents: component.subComponents.filter((s) => s.id !== subId),
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: radius.md,
        },
      ]}
    >
      {/* ── Category row ── */}
      <View style={s.row}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={[s.label, { color: colors.text }]}>Category</Text>

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
            s.trashBtn,
            {
              borderColor: colors.border,
              borderRadius: radius.md,
              opacity: isRemovable ? 1 : 0.35,
            },
          ]}
          onPress={onRemove}
          disabled={!isRemovable}
          activeOpacity={0.7}
        >
          <Trash2 size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ── Subcategory ── */}
      <View style={{ gap: 5 }}>
        <Text style={[s.label, { color: colors.text }]}>Subcategory</Text>

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

      {/* ── Subcomponents ── */}
      <View style={[s.subSection, { borderLeftColor: colors.info + "60" }]}>
        <View style={s.subHeader}>
          <Text style={[s.subTitle, { color: colors.textMuted }]}>
            Subcomponents
          </Text>
          <View
            style={[
              s.countBadge,
              { backgroundColor: colors.background, borderRadius: radius.md },
            ]}
          >
            <Text style={[s.countText, { color: colors.textMuted }]}>
              {component.subComponents.length}
            </Text>
          </View>
        </View>

        {component.subComponents.map((sub) => (
          <View
            key={sub.id}
            style={[
              s.subRow,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderRadius: radius.md,
              },
            ]}
          >
            {/* Key select */}
            <View style={{ flex: 1 }}>
              {addingKeyFor === sub.id ? (
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
              )}
            </View>

            {/* Value input */}
            <TextInput
              style={[
                s.valueInput,
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
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />

            {/* Remove subcomponent */}
            <TouchableOpacity
              style={[
                s.trashBtnSm,
                {
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  opacity: component.subComponents.length === 1 ? 0.3 : 1,
                },
              ]}
              onPress={() => removeSubComponent(sub.id)}
              disabled={component.subComponents.length === 1}
              activeOpacity={0.7}
            >
              <Trash2 size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ))}

        {/* Add subcomponent */}
        <TouchableOpacity
          style={[
            s.addSubBtn,
            { borderColor: colors.border, borderRadius: radius.md },
          ]}
          onPress={addSubComponent}
          activeOpacity={0.7}
        >
          <PlusCircle size={15} color={colors.textMuted} />
          <Text style={[s.addSubText, { color: colors.textMuted }]}>
            Add Subcomponent
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Dropdowns ── */}
      <DropdownModal
        visible={catOpen}
        onClose={() => {
          setCatOpen(false);
          setCatSearch("");
        }}
        items={filteredCats}
        selectedId={selectedCategoryId}
        onSelect={handleCategorySelect}
        getLabel={(c) => c.categoryName}
        getId={(c) => c.id}
        searchTerm={catSearch}
        onSearchChange={setCatSearch}
        searchPlaceholder="Search categories…"
        loading={categoriesLoading}
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
        getLabel={(s) => s.subcategoryName}
        getId={(s) => s.id}
        isDisabled={(s) =>
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
            component.subComponents.find((s) => s.id === keyOpenFor)?.key ?? ""
          }
          onSelect={(key) => handleKeySelect(keyOpenFor, key)}
          getLabel={(item) => item.label}
          getId={(item) => item.id}
          isDisabled={(item) =>
            usedKeys.includes(item.id) &&
            item.id !==
              component.subComponents.find((s) => s.id === keyOpenFor)?.key
          }
          disabledLabel="already used"
          searchTerm={keySearch}
          onSearchChange={setKeySearch}
          searchPlaceholder="Search subcomponents…"
          emptyText="No subcomponents available"
          addNewLabel="Add New Subcomponent…"
          onAddNew={() => {
            const id = keyOpenFor;
            setKeyOpenFor(null);
            setAddingKeyFor(id);
            setNewKeyInput("");
          }}
          colors={colors}
          radius={radius}
        />
      )}

      {/* Permission error */}
      <ResponseModal
        visible={show}
        successful={false}
        message={permMsg}
        onClose={() => setShow(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
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
