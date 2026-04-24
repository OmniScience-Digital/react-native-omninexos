import { NonTabScreen } from "@/components/ui/non-tab-screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useTheme } from "@/src/contexts/theme-context";
import {
    AlertTriangle,
    ArrowLeft,
    ChevronRight,
    Edit2,
    Package,
    Save,
    Search,
    Trash2,
    Warehouse,
    X,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
    Modal,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

// ─── Dummy Data ───────────────────────────────────────────────────────────────
interface Component {
  id: string;
  componentId: string;
  componentName: string | null;
  description: string | null;
  primarySupplier: string | null;
  primarySupplierItemCode: string | null;
  secondarySupplier: string | null;
  secondarySupplierItemCode: string | null;
  qtyExStock: number | null;
  currentStock: number;
  minimumStock: number;
  notes: string | null;
  subcategoryId: string;
}

interface SubCategory {
  id: string;
  subcategoryName: string;
  categoryId: string;
  components: Component[];
}

interface Category {
  id: string;
  categoryName: string;
  subcategories: SubCategory[];
}

const DUMMY_CATEGORIES: Category[] = [
  {
    id: "cat-1",
    categoryName: "Electrical",
    subcategories: [
      {
        id: "sub-1-1",
        subcategoryName: "Switches & Relays",
        categoryId: "cat-1",
        components: [
          {
            id: "c1",
            componentId: "EL-SW-001",
            componentName: "Toggle Switch 12V",
            description: "Heavy duty 12V toggle switch for panel mounting",
            primarySupplier: "RS Components",
            primarySupplierItemCode: "RS-12V-TS",
            secondarySupplier: "Farnell",
            secondarySupplierItemCode: "F-TS-12",
            qtyExStock: 50,
            currentStock: 23,
            minimumStock: 10,
            notes: null,
            subcategoryId: "sub-1-1",
          },
          {
            id: "c2",
            componentId: "EL-SW-002",
            componentName: "Push Button Switch",
            description: "Momentary push button, panel mount, IP65 rated",
            primarySupplier: "RS Components",
            primarySupplierItemCode: "RS-PB-01",
            secondarySupplier: null,
            secondarySupplierItemCode: null,
            qtyExStock: 30,
            currentStock: 5,
            minimumStock: 8,
            notes: "Low stock — reorder soon.",
            subcategoryId: "sub-1-1",
          },
          {
            id: "c3",
            componentId: "EL-RL-001",
            componentName: "24V DC Relay",
            description: "5-pin automotive relay, 30A",
            primarySupplier: "AutoElect",
            primarySupplierItemCode: "AE-24R-30",
            secondarySupplier: "EBay Wholesale",
            secondarySupplierItemCode: null,
            qtyExStock: 100,
            currentStock: 67,
            minimumStock: 20,
            notes: null,
            subcategoryId: "sub-1-1",
          },
        ],
      },
      {
        id: "sub-1-2",
        subcategoryName: "Wiring & Connectors",
        categoryId: "cat-1",
        components: [
          {
            id: "c4",
            componentId: "EL-WR-001",
            componentName: "2.5mm² Red Cable (per m)",
            description: "Single core PVC insulated, 2.5mm² copper",
            primarySupplier: "Cable Corp SA",
            primarySupplierItemCode: "CC-2R5-R",
            secondarySupplier: "ElectroBuild",
            secondarySupplierItemCode: "EB-25R",
            qtyExStock: 500,
            currentStock: 320,
            minimumStock: 100,
            notes: "Sold per meter.",
            subcategoryId: "sub-1-2",
          },
          {
            id: "c5",
            componentId: "EL-CN-001",
            componentName: "Deutsch DT 2-Pin Connector",
            description: "Waterproof 2-pin connector, Deutsch DT series",
            primarySupplier: "TE Connectivity",
            primarySupplierItemCode: "TE-DT2P",
            secondarySupplier: null,
            secondarySupplierItemCode: null,
            qtyExStock: 200,
            currentStock: 0,
            minimumStock: 30,
            notes: "OUT OF STOCK — order immediately.",
            subcategoryId: "sub-1-2",
          },
        ],
      },
    ],
  },
  {
    id: "cat-2",
    categoryName: "Hydraulics",
    subcategories: [
      {
        id: "sub-2-1",
        subcategoryName: "Pumps",
        categoryId: "cat-2",
        components: [
          {
            id: "c6",
            componentId: "HY-PMP-001",
            componentName: "Gear Pump 10cc/rev",
            description: "Fixed displacement gear pump, 250 bar, SAE mount",
            primarySupplier: "Parker Hannifin",
            primarySupplierItemCode: "PH-GP10",
            secondarySupplier: "Bosch Rexroth",
            secondarySupplierItemCode: "BR-FD10",
            qtyExStock: 10,
            currentStock: 4,
            minimumStock: 2,
            notes: "Lead time 6 weeks.",
            subcategoryId: "sub-2-1",
          },
          {
            id: "c7",
            componentId: "HY-PMP-002",
            componentName: "Vane Pump 20cc/rev",
            description: "Variable displacement vane pump, 180 bar",
            primarySupplier: "Parker Hannifin",
            primarySupplierItemCode: "PH-VP20",
            secondarySupplier: null,
            secondarySupplierItemCode: null,
            qtyExStock: 5,
            currentStock: 2,
            minimumStock: 1,
            notes: null,
            subcategoryId: "sub-2-1",
          },
        ],
      },
      {
        id: "sub-2-2",
        subcategoryName: "Cylinders",
        categoryId: "cat-2",
        components: [
          {
            id: "c8",
            componentId: "HY-CYL-001",
            componentName: "50mm Bore × 300mm Stroke",
            description: "Double acting hydraulic cylinder, chrome rod",
            primarySupplier: "Hydraforce SA",
            primarySupplierItemCode: "HF-50-300",
            secondarySupplier: "Hytec",
            secondarySupplierItemCode: "HT-50300",
            qtyExStock: 8,
            currentStock: 3,
            minimumStock: 2,
            notes: "Check seals before dispatch.",
            subcategoryId: "sub-2-2",
          },
        ],
      },
    ],
  },
  {
    id: "cat-3",
    categoryName: "Safety & PPE",
    subcategories: [
      {
        id: "sub-3-1",
        subcategoryName: "Head Protection",
        categoryId: "cat-3",
        components: [
          {
            id: "c9",
            componentId: "SF-HP-001",
            componentName: "Hard Hat (White)",
            description: "SABS approved, class E, white ABS shell",
            primarySupplier: "Safety First SA",
            primarySupplierItemCode: "SF-HH-W",
            secondarySupplier: "Industrial PPE",
            secondarySupplierItemCode: "IP-HHW",
            qtyExStock: 50,
            currentStock: 18,
            minimumStock: 10,
            notes: null,
            subcategoryId: "sub-3-1",
          },
          {
            id: "c10",
            componentId: "SF-HP-002",
            componentName: "Hard Hat (Yellow)",
            description: "SABS approved, class E, high-vis yellow",
            primarySupplier: "Safety First SA",
            primarySupplierItemCode: "SF-HH-Y",
            secondarySupplier: "Industrial PPE",
            secondarySupplierItemCode: "IP-HHY",
            qtyExStock: 50,
            currentStock: 7,
            minimumStock: 10,
            notes: "Stock critically low.",
            subcategoryId: "sub-3-1",
          },
        ],
      },
      {
        id: "sub-3-2",
        subcategoryName: "Eye Protection",
        categoryId: "cat-3",
        components: [
          {
            id: "c11",
            componentId: "SF-EP-001",
            componentName: "Safety Glasses Clear",
            description: "Anti-scratch, anti-fog polycarbonate lens",
            primarySupplier: "3M SA",
            primarySupplierItemCode: "3M-SG-C",
            secondarySupplier: null,
            secondarySupplierItemCode: null,
            qtyExStock: 100,
            currentStock: 45,
            minimumStock: 20,
            notes: null,
            subcategoryId: "sub-3-2",
          },
        ],
      },
    ],
  },
  {
    id: "cat-4",
    categoryName: "Fasteners",
    subcategories: [
      {
        id: "sub-4-1",
        subcategoryName: "Bolts & Nuts",
        categoryId: "cat-4",
        components: [
          {
            id: "c12",
            componentId: "FT-BN-001",
            componentName: "M10 × 40 HEX Bolt (Gr 8.8)",
            description: "Zinc-plated hex head bolt, M10×40, grade 8.8",
            primarySupplier: "Bolt & Nut SA",
            primarySupplierItemCode: "BN-M10-40",
            secondarySupplier: "Würth SA",
            secondarySupplierItemCode: "W-M1040G8",
            qtyExStock: 1000,
            currentStock: 643,
            minimumStock: 200,
            notes: null,
            subcategoryId: "sub-4-1",
          },
          {
            id: "c13",
            componentId: "FT-BN-002",
            componentName: "M10 Hex Nut (Gr 8)",
            description: "Zinc-plated hex nut, M10, grade 8",
            primarySupplier: "Bolt & Nut SA",
            primarySupplierItemCode: "BN-M10-N",
            secondarySupplier: "Würth SA",
            secondarySupplierItemCode: "W-M10NG8",
            qtyExStock: 1000,
            currentStock: 580,
            minimumStock: 200,
            notes: null,
            subcategoryId: "sub-4-1",
          },
        ],
      },
    ],
  },
];

// ─── Stock helpers ─────────────────────────────────────────────────────────────
type StockStatus = "ok" | "low" | "out";

const getStockStatus = (current: number, minimum: number): StockStatus => {
  if (current === 0) return "out";
  if (current < minimum) return "low";
  return "ok";
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StockPillProps {
  current: number;
  minimum: number;
}

const StockPill: React.FC<StockPillProps> = ({ current, minimum }) => {
  const { theme } = useTheme();
  const status = getStockStatus(current, minimum);

  const config: Record<
    StockStatus,
    { bg: string; color: string; label: string }
  > = {
    ok: { bg: "#0f2e1e", color: theme.colors.success, label: "OK" },
    low: { bg: "#2e1f00", color: theme.colors.warning, label: "LOW" },
    out: { bg: "#200a0a", color: "#f87171", label: "OUT" },
  };
  const { bg, color, label } = config[status];

  return (
    <View
      style={[
        styles.stockPill,
        { backgroundColor: bg, borderColor: color + "40" },
      ]}
    >
      <Warehouse size={10} color={color} />
      <Text style={[styles.stockPillText, { color }]}>
        {current} / {minimum} {label}
      </Text>
    </View>
  );
};

// ─── EditComponentModal ───────────────────────────────────────────────────────

interface EditModalProps {
  component: Component;
  visible: boolean;
  onClose: () => void;
  onSave: (updated: Component) => void;
}

const EditComponentModal: React.FC<EditModalProps> = ({
  component,
  visible,
  onClose,
  onSave,
}) => {
  const { theme } = useTheme();
  const C = theme.colors;
  const [form, setForm] = useState<Component>({ ...component });

  const set = (k: keyof Component, v: string | number | null) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: C.card, borderColor: C.border },
          ]}
        >
          {/* Handle */}
          <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />

          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: C.border }]}>
            <Text style={[styles.sheetTitle, { color: C.text }]}>
              Edit · {component.componentId}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={C.textMuted} />
            </TouchableOpacity>
          </View>

          <CustomScrollView>
            {/* Row: ID + Name */}
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={[styles.formLabel, { color: C.accent }]}>
                  COMPONENT ID *
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: C.background,
                      borderColor: C.border,
                      color: C.text,
                    },
                  ]}
                  value={form.componentId}
                  onChangeText={(v) => set("componentId", v)}
                  placeholderTextColor={C.textMuted}
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={[styles.formLabel, { color: C.accent }]}>
                  NAME
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: C.background,
                      borderColor: C.border,
                      color: C.text,
                    },
                  ]}
                  value={form.componentName ?? ""}
                  onChangeText={(v) => set("componentName", v)}
                  placeholderTextColor={C.textMuted}
                />
              </View>
            </View>

            {/* Row: Suppliers */}
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={[styles.formLabel, { color: C.accent }]}>
                  PRIMARY SUPPLIER
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: C.background,
                      borderColor: C.border,
                      color: C.text,
                    },
                  ]}
                  value={form.primarySupplier ?? ""}
                  onChangeText={(v) => set("primarySupplier", v)}
                  placeholderTextColor={C.textMuted}
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={[styles.formLabel, { color: C.accent }]}>
                  PRIMARY CODE
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: C.background,
                      borderColor: C.border,
                      color: C.text,
                    },
                  ]}
                  value={form.primarySupplierItemCode ?? ""}
                  onChangeText={(v) => set("primarySupplierItemCode", v)}
                  placeholderTextColor={C.textMuted}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={[styles.formLabel, { color: C.accent }]}>
                  SECONDARY SUPPLIER
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: C.background,
                      borderColor: C.border,
                      color: C.text,
                    },
                  ]}
                  value={form.secondarySupplier ?? ""}
                  onChangeText={(v) => set("secondarySupplier", v)}
                  placeholderTextColor={C.textMuted}
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={[styles.formLabel, { color: C.accent }]}>
                  SECONDARY CODE
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: C.background,
                      borderColor: C.border,
                      color: C.text,
                    },
                  ]}
                  value={form.secondarySupplierItemCode ?? ""}
                  onChangeText={(v) => set("secondarySupplierItemCode", v)}
                  placeholderTextColor={C.textMuted}
                />
              </View>
            </View>

            {/* Row: Stock */}
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={[styles.formLabel, { color: C.accent }]}>
                  MIN STOCK
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: C.background,
                      borderColor: C.border,
                      color: C.text,
                    },
                  ]}
                  value={String(form.minimumStock)}
                  onChangeText={(v) => set("minimumStock", parseInt(v) || 0)}
                  keyboardType="numeric"
                  placeholderTextColor={C.textMuted}
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={[styles.formLabel, { color: C.accent }]}>
                  CURRENT STOCK
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: C.background,
                      borderColor: C.border,
                      color: C.text,
                    },
                  ]}
                  value={String(form.currentStock)}
                  onChangeText={(v) => set("currentStock", parseInt(v) || 0)}
                  keyboardType="numeric"
                  placeholderTextColor={C.textMuted}
                />
              </View>
            </View>

            {/* Description */}
            <Text style={[styles.formLabel, { color: C.accent, marginTop: 4 }]}>
              DESCRIPTION
            </Text>
            <TextInput
              style={[
                styles.formTextarea,
                {
                  backgroundColor: C.background,
                  borderColor: C.border,
                  color: C.text,
                },
              ]}
              value={form.description ?? ""}
              onChangeText={(v) => set("description", v)}
              multiline
              numberOfLines={3}
              placeholderTextColor={C.textMuted}
              placeholder="Component description…"
            />

            {/* Notes */}
            <Text
              style={[styles.formLabel, { color: C.accent, marginTop: 10 }]}
            >
              NOTES
            </Text>
            <TextInput
              style={[
                styles.formTextarea,
                {
                  backgroundColor: C.background,
                  borderColor: C.border,
                  color: C.text,
                },
              ]}
              value={form.notes ?? ""}
              onChangeText={(v) => set("notes", v)}
              multiline
              numberOfLines={3}
              placeholderTextColor={C.textMuted}
              placeholder="Additional notes…"
            />

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btnSave, { backgroundColor: C.text }]}
                onPress={() => {
                  onSave(form);
                  onClose();
                }}
              >
                <Save size={13} color={C.background} />
                <Text style={[styles.btnSaveText, { color: C.background }]}>
                  SAVE CHANGES
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnCancel, { borderColor: C.border }]}
                onPress={onClose}
              >
                <Text style={[styles.btnCancelText, { color: C.textMuted }]}>
                  CANCEL
                </Text>
              </TouchableOpacity>
            </View>
          </CustomScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ─── DeleteConfirmModal ───────────────────────────────────────────────────────

interface DeleteModalProps {
  visible: boolean;
  name: string;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmModal: React.FC<DeleteModalProps> = ({
  visible,
  name,
  onClose,
  onConfirm,
}) => {
  const { theme } = useTheme();
  const C = theme.colors;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.confirmOverlay}>
        <View
          style={[
            styles.confirmBox,
            { backgroundColor: C.card, borderColor: "#3d0a0a" },
          ]}
        >
          <Text style={styles.confirmTitle}>Delete Component?</Text>
          <Text style={[styles.confirmBody, { color: C.textMuted }]}>
            This will permanently remove{" "}
            <Text style={{ color: C.text, fontWeight: "700" }}>{name}</Text>.{" "}
            This cannot be undone.
          </Text>
          <View style={styles.confirmActions}>
            <TouchableOpacity style={styles.btnDelete} onPress={onConfirm}>
              <Text style={styles.btnDeleteText}>DELETE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnCancel, { borderColor: C.border }]}
              onPress={onClose}
            >
              <Text style={[styles.btnCancelText, { color: C.textMuted }]}>
                CANCEL
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── ComponentCard ────────────────────────────────────────────────────────────

interface ComponentCardProps {
  component: Component;
  onEdit: (c: Component) => void;
  onDelete: (id: string, name: string) => void;
}

const ComponentCard: React.FC<ComponentCardProps> = ({
  component,
  onEdit,
  onDelete,
}) => {
  const { theme } = useTheme();
  const C = theme.colors;

  return (
    <View
      style={[
        styles.compCard,
        { backgroundColor: C.background, borderColor: C.border },
      ]}
    >
      <Text style={[styles.compId, { color: C.accent }]}>
        {component.componentId}
      </Text>
      <Text style={[styles.compName, { color: C.text }]}>
        {component.componentName ?? "Unnamed Component"}
      </Text>
      {!!component.description && (
        <Text
          style={[styles.compDesc, { color: C.textMuted }]}
          numberOfLines={2}
        >
          {component.description}
        </Text>
      )}

      {/* Stock + Supplier row */}
      <View style={styles.compMeta}>
        <StockPill
          current={component.currentStock}
          minimum={component.minimumStock}
        />
        {!!component.primarySupplier && (
          <View
            style={[
              styles.supplierChip,
              { backgroundColor: C.card, borderColor: C.border },
            ]}
          >
            <Text style={[styles.supplierText, { color: C.textMuted }]}>
              {component.primarySupplier}
            </Text>
          </View>
        )}
      </View>

      {/* Notes warning */}
      {!!component.notes && (
        <View style={styles.notesRow}>
          <AlertTriangle size={11} color={C.warning} />
          <Text style={[styles.notesText, { color: C.warning }]}>
            {component.notes}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.btnEdit, { borderColor: C.border }]}
          onPress={() => onEdit(component)}
        >
          <Edit2 size={11} color={C.textMuted} />
          <Text style={[styles.btnEditText, { color: C.textMuted }]}>EDIT</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnDeleteSmall}
          onPress={() =>
            onDelete(
              component.id,
              component.componentName ?? component.componentId,
            )
          }
        >
          <Trash2 size={11} color="#f87171" />
          <Text style={styles.btnDeleteSmallText}>DELETE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── SubcategoryScreen ────────────────────────────────────────────────────────

interface SubcategoryScreenProps {
  category: Category;
  onBack: () => void;
  compOverrides: Record<string, Component[]>;
  onUpdateComponent: (subId: string, updated: Component) => void;
  onDeleteComponent: (subId: string, compId: string) => void;
}

const SubcategoryScreen: React.FC<SubcategoryScreenProps> = ({
  category,
  onBack,
  compOverrides,
  onUpdateComponent,
  onDeleteComponent,
}) => {
  const { theme } = useTheme();
  const C = theme.colors;

  const [selectedSubId, setSelectedSubId] = useState<string>(
    category.subcategories[0]?.id ?? "",
  );
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

  const selectedSub = category.subcategories.find(
    (s) => s.id === selectedSubId,
  );

  const allComponents: Component[] = useMemo(() => {
    if (!selectedSub) return [];
    return compOverrides[selectedSub.id] ?? selectedSub.components;
  }, [selectedSub, compOverrides]);

  const filtered: Component[] = useMemo(() => {
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

  const filterLabels: {
    key: "all" | "in-stock" | "out-of-stock";
    label: string;
  }[] = [
    { key: "all", label: "ALL" },
    { key: "in-stock", label: "IN STOCK" },
    { key: "out-of-stock", label: "OUT" },
  ];

  return (
    <NonTabScreen
      title="Inventory Management"
      subtitle="Track your inventory"
      showBack
      scrollable
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
            {category.subcategories.length} subcategories
          </Text>
        </View>
        <View style={[styles.tagBlue, { borderColor: C.info + "30" }]}>
          <Text style={[styles.tagText, { color: C.info }]}>
            {allComponents.length} items
          </Text>
        </View>
      </View>

      <CustomScrollView>
        {/* Subcategory chips */}
        <View
          className="mt-3"
          style={[
            styles.card,
            { backgroundColor: C.card, borderColor: C.border },
          ]}
        >
          <Text style={[styles.sectionLabel, { color: C.accent }]}>
            SUBCATEGORY
          </Text>
          <CustomScrollView>
            <View style={styles.chipRow}>
              {category.subcategories.map((sub) => {
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

        {/* Search + Filter */}
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

        {/* Components */}
        {paginated.length === 0 ? (
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

        {/* Pagination */}
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

      {/* Edit Modal */}
      {editTarget && (
        <EditComponentModal
          component={editTarget}
          visible={!!editTarget}
          onClose={() => setEditTarget(null)}
          onSave={(updated) => {
            if (selectedSub) onUpdateComponent(selectedSub.id, updated);
          }}
        />
      )}

      {/* Delete Modal */}
      <DeleteConfirmModal
        visible={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget && selectedSub) {
            onDeleteComponent(selectedSub.id, deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </NonTabScreen>
  );
};

// ─── CategoryListScreen ───────────────────────────────────────────────────────

interface CategoryListScreenProps {
  categories: Category[];
  onSelect: (cat: Category) => void;
}

const CategoryListScreen: React.FC<CategoryListScreenProps> = ({
  categories,
  onSelect,
}) => {
  const { theme } = useTheme();
  const C = theme.colors;

  const totalComponents = categories.reduce(
    (sum, cat) =>
      sum + cat.subcategories.reduce((s, sub) => s + sub.components.length, 0),
    0,
  );
  const totalLow = categories.reduce(
    (sum, cat) =>
      sum +
      cat.subcategories.reduce(
        (s, sub) =>
          s +
          sub.components.filter((c) => c.currentStock < c.minimumStock).length,
        0,
      ),
    0,
  );

  const summaryItems = [
    { label: "CATEGORIES", val: categories.length, warn: false },
    { label: "COMPONENTS", val: totalComponents, warn: false },
    { label: "LOW STOCK", val: totalLow, warn: totalLow > 0 },
  ];

  return (
    <NonTabScreen
      title="Fleet Management"
      subtitle="Complete all sections"
      showBack
      scrollable
    >
      <StatusBar barStyle="light-content" backgroundColor={C.background} />

      {/* Summary strip */}
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

      {/* Section label */}
      <Text
        style={[
          styles.sectionLabel,
          { color: C.accent, marginBottom: 10, marginHorizontal: 2 },
        ]}
      >
        CATEGORY SELECTION
      </Text>

      {/* Category rows */}
      {categories.map((cat) => {
        const totalComps = cat.subcategories.reduce(
          (s, sub) => s + sub.components.length,
          0,
        );
        const lowComps = cat.subcategories.reduce(
          (s, sub) =>
            s +
            sub.components.filter((c) => c.currentStock < c.minimumStock)
              .length,
          0,
        );

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
            onPress={() => onSelect(cat)}
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
                {cat.subcategories.length} subcategories · {totalComps}{" "}
                components
              </Text>
            </View>
            <View style={styles.catRight}>
              {lowComps > 0 && (
                <View
                  style={[styles.tagWarning, { borderColor: C.warning + "40" }]}
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
    </NonTabScreen>
  );
};

// ─── Root Screen ──────────────────────────────────────────────────────────────

export default function IMSScreen() {
  const [categories, setCategories] = useState<Category[]>(DUMMY_CATEGORIES);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [compOverrides, setCompOverrides] = useState<
    Record<string, Component[]>
  >({});

  const handleUpdateComponent = (subId: string, updated: Component) => {
    setCompOverrides((prev) => {
      const base =
        prev[subId] ??
        selectedCat?.subcategories.find((s) => s.id === subId)?.components ??
        [];
      return {
        ...prev,
        [subId]: base.map((c) => (c.id === updated.id ? updated : c)),
      };
    });
  };

  const handleDeleteComponent = (subId: string, compId: string) => {
    setCompOverrides((prev) => {
      const base =
        prev[subId] ??
        selectedCat?.subcategories.find((s) => s.id === subId)?.components ??
        [];
      return { ...prev, [subId]: base.filter((c) => c.id !== compId) };
    });
  };

  if (selectedCat) {
    return (
      <SubcategoryScreen
        category={selectedCat}
        onBack={() => setSelectedCat(null)}
        compOverrides={compOverrides}
        onUpdateComponent={handleUpdateComponent}
        onDeleteComponent={handleDeleteComponent}
      />
    );
  }

  return (
    <CategoryListScreen
      categories={categories}
      onSelect={(cat) => setSelectedCat(cat)}
    />
  );
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 32 },

  // Navbar
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

  // Summary
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

  // Category row
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

  // Card
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 5 },

  // Chips
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "600" },

  // Search
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

  // Filters
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

  // Component card
  compCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
    marginBottom: 8,
  },
  compId: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  compName: { fontSize: 14, fontWeight: "700" },
  compDesc: { fontSize: 12, marginTop: 4, lineHeight: 18 },
  compMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },

  // Stock pill
  stockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  stockPillText: { fontSize: 11, fontWeight: "700" },

  // Supplier chip
  supplierChip: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  supplierText: { fontSize: 11 },

  // Notes
  notesRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 8,
    padding: 7,
    backgroundColor: "#1a1200",
    borderRadius: 6,
  },
  notesText: { fontSize: 11, flex: 1, lineHeight: 16 },

  // Card actions
  cardActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  btnEdit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  btnEditText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  btnDeleteSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#3d0a0a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  btnDeleteSmallText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#f87171",
    letterSpacing: 0.5,
  },

  // Pagination
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

  // Tags
  tagBlue: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#0a1a2e",
  },
  tagWarning: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#2e1f00",
  },
  tagText: { fontSize: 10, fontWeight: "700" },

  // Modal overlay
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalSheet: {
    width: "100%",
    maxHeight: "90%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 15, fontWeight: "700" },
  sheetBody: { padding: 18 },

  // Form
  formRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  formHalf: { flex: 1 },
  formLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  formInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 12,
  },
  formTextarea: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 12,
    minHeight: 72,
    textAlignVertical: "top",
    marginBottom: 4,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    marginBottom: 8,
  },
  btnSave: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 13,
  },
  btnSaveText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  btnCancel: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  btnCancelText: { fontSize: 12, fontWeight: "700" },

  // Confirm dialog
  confirmOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  confirmBox: { width: "85%", borderRadius: 16, borderWidth: 1, padding: 20 },
  confirmTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f87171",
    marginBottom: 8,
  },
  confirmBody: { fontSize: 12, lineHeight: 18, marginBottom: 20 },
  confirmActions: { flexDirection: "row", gap: 10 },
  btnDelete: {
    flex: 1,
    backgroundColor: "#200a0a",
    borderWidth: 1,
    borderColor: "#3d0a0a",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnDeleteText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#f87171",
    letterSpacing: 0.5,
  },

  emptyText: { textAlign: "center", padding: 32, fontSize: 13 },
});
