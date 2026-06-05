// src/screens/FleetListScreen.tsx
import { ThemedText } from "@/components/screens/screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useTheme } from "@/src/contexts/theme-context";
import {
  useCreateFleetMutation,
  useDeleteFleetMutation,
  useListFleetsQuery,
  useUpdateFleetMutation,
} from "@/src/state/api";
import {
  Car,
  ChevronRight,
  Pencil,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ---------- Helpers ----------
const isExpired = (dateStr: string | null | undefined): boolean => {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
};

// ---------- Styles (exactly your original design) ----------
const getStyles = (colors: any) =>
  StyleSheet.create({
    content: { padding: 16, flex: 1 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      overflow: "hidden",
    },
    tabRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
    tab: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      alignItems: "center",
    },
    tabActive: { backgroundColor: colors.primary },
    tabInactive: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabTextActive: {
      color: colors.primaryText,
      fontSize: 12,
      fontWeight: "700",
    },
    tabTextInactive: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    searchWrap: { position: "relative", marginBottom: 14 },
    searchIcon: { position: "absolute", left: 12, top: 12, zIndex: 1 },
    searchBar: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      paddingLeft: 38,
      fontSize: 14,
      color: colors.text,
    },
    btnGreen: {
      backgroundColor: colors.success + "20",
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
      marginBottom: 16,
    },
    btnGreenText: { color: colors.success, fontSize: 13, fontWeight: "700" },
    fleetRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
      padding: 14,
      gap: 12,
    },
    fleetIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primary + "20",
      justifyContent: "center",
      alignItems: "center",
    },
    fleetInfo: { flex: 1 },
    fleetReg: { fontSize: 15, fontWeight: "700", color: colors.text },
    fleetSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    fleetDriver: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    badge: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 99,
      fontSize: 11,
      fontWeight: "700",
      overflow: "hidden",
    },
    badgeGreen: {
      backgroundColor: colors.success + "20",
      color: colors.success,
    },
    badgeRed: { backgroundColor: colors.warning + "20", color: colors.warning },
    btnGhost: { padding: 8 },
    empty: { alignItems: "center", padding: 40 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    // Modal styles
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    bottomSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 32,
      maxHeight: "90%",
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginTop: 12,
    },
    sheetHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sheetTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
    formInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 10,
      fontSize: 14,
      color: colors.text,
      marginBottom: 14,
    },
    btnPrimary: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: "center",
    },
    btnPrimaryText: { color: colors.primaryText, fontWeight: "700" },
    btnSecondary: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: "center",
    },
    btnSecondaryText: { color: colors.textMuted },
    btnDanger: {
      marginTop: 12,
      backgroundColor: colors.warning + "20",
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: "center",
    },
    btnDangerText: { color: colors.warning },
  });

// ---------- Badge Component ----------
const Badge = ({ status }: { status: boolean }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme.colors);
  const badgeStyle = status ? styles.badgeGreen : styles.badgeRed;
  return (
    <ThemedText style={[styles.badge, badgeStyle]}>
      {status ? "Active" : "Inactive"}
    </ThemedText>
  );
};

// ---------- Main Component ----------
export default function FleetListScreen({
  onSelectFleet,
}: {
  onSelectFleet: (fleet: Fleet) => void;
}) {
  const { theme } = useTheme();
  const styles = getStyles(theme.colors);
  const { data: fleets = [], isLoading } = useListFleetsQuery();
  const [createFleet] = useCreateFleetMutation();
  const [updateFleet] = useUpdateFleetMutation();
  const [deleteFleet] = useDeleteFleetMutation();

  const [search, setSearch] = useState("");
  const [searchType, setSearchType] = useState<"reg" | "driver">("reg");
  const [showAdd, setShowAdd] = useState(false);
  const [editingFleet, setEditingFleet] = useState<Fleet | null>(null);

  const filtered = fleets.filter((f) =>
    searchType === "reg"
      ? f.vehicleReg?.toLowerCase().includes(search.toLowerCase())
      : f.currentDriver?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleAdd = async (newFleet: Omit<Fleet, "id">) => {
    try {
      await createFleet(newFleet).unwrap();
      setShowAdd(false);
      Alert.alert("Success", "Vehicle added");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to add vehicle");
    }
  };

  const handleUpdate = async (updated: Fleet) => {
    try {
      await updateFleet(updated).unwrap();
      setEditingFleet(null);
      Alert.alert("Success", "Vehicle updated");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Delete", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteFleet(id).unwrap();
            Alert.alert("Deleted");
          } catch (err: any) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  };

  if (isLoading)
    return <ActivityIndicator size="large" style={{ marginTop: 50 }} />;

  return (
    <>
      <CustomScrollView style={styles.content}>
        {/* Search Card */}
        <View style={styles.card}>
          <View style={{ padding: 14 }}>
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  searchType === "reg" ? styles.tabActive : styles.tabInactive,
                ]}
                onPress={() => setSearchType("reg")}
              >
                <ThemedText
                  style={
                    searchType === "reg"
                      ? styles.tabTextActive
                      : styles.tabTextInactive
                  }
                >
                  Registration
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  searchType === "driver"
                    ? styles.tabActive
                    : styles.tabInactive,
                ]}
                onPress={() => setSearchType("driver")}
              >
                <ThemedText
                  style={
                    searchType === "driver"
                      ? styles.tabTextActive
                      : styles.tabTextInactive
                  }
                >
                  Driver
                </ThemedText>
              </TouchableOpacity>
            </View>
            <View style={styles.searchWrap}>
              <View style={styles.searchIcon}>
                <Search size={16} color={theme.colors.textMuted} />
              </View>
              <TextInput
                style={styles.searchBar}
                placeholder={
                  searchType === "reg"
                    ? "Search registration…"
                    : "Search driver…"
                }
                value={search}
                onChangeText={setSearch}
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>
            {search !== "" && (
              <ThemedText
                style={{
                  fontSize: 12,
                  color: theme.colors.textMuted,
                  marginTop: 4,
                }}
              >
                {filtered.length} of {fleets.length} vehicles
              </ThemedText>
            )}
          </View>
        </View>

        {/* Add Button */}
        <TouchableOpacity
          style={styles.btnGreen}
          onPress={() => setShowAdd(true)}
        >
          <Plus size={16} color={theme.colors.success} />
          <ThemedText style={styles.btnGreenText}>Add Vehicle</ThemedText>
        </TouchableOpacity>

        {/* Fleet List */}
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <ThemedText style={styles.emptyIcon}>🚗</ThemedText>
            <ThemedText style={{ color: theme.colors.textMuted }}>
              No vehicles found
            </ThemedText>
          </View>
        ) : (
          filtered.map((fleet) => {
            const expiredLic = isExpired(fleet.liscenseDiscExpirey);
            const expiredBlx = isExpired(fleet.breakandLuxExpirey);
            return (
              <TouchableOpacity
                key={fleet.id}
                style={[
                  styles.fleetRow,
                  {
                    borderColor:
                      expiredLic || expiredBlx
                        ? theme.colors.warning
                        : theme.colors.border,
                  },
                ]}
                onPress={() => onSelectFleet(fleet)}
              >
                <View
                  style={[
                    styles.fleetIcon,
                    {
                      backgroundColor: fleet.servicePlanStatus
                        ? theme.colors.primary + "20"
                        : theme.colors.warning + "20",
                    },
                  ]}
                >
                  <Car
                    size={22}
                    color={
                      fleet.servicePlanStatus
                        ? theme.colors.text
                        : theme.colors.warning
                    }
                  />
                </View>
                <View style={styles.fleetInfo}>
                  <ThemedText style={styles.fleetReg}>
                    {fleet.vehicleReg}
                  </ThemedText>
                  <ThemedText style={styles.fleetSub}>
                    {fleet.fleetNumber} · {fleet.vehicleMake}{" "}
                    {fleet.vehicleModel}
                  </ThemedText>
                  <ThemedText style={styles.fleetDriver}>
                    {fleet.currentDriver || "No driver assigned"}
                  </ThemedText>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Badge status={fleet.servicePlanStatus} />
                  {(expiredLic || expiredBlx) && (
                    <ThemedText
                      style={[styles.badge, styles.badgeRed, { fontSize: 10 }]}
                    >
                      ⚠ Expired
                    </ThemedText>
                  )}
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    <TouchableOpacity
                      style={styles.btnGhost}
                      onPress={(e) => {
                        e.stopPropagation();
                        setEditingFleet(fleet);
                      }}
                    >
                      <Pencil size={16} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                    <ChevronRight size={16} color={theme.colors.textMuted} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </CustomScrollView>

      {/* Add Modal */}
      <AddVehicleModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={handleAdd}
      />

      {/* Edit Modal */}
      {editingFleet && (
        <EditVehicleModal
          fleet={editingFleet}
          onClose={() => setEditingFleet(null)}
          onSave={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}

const modalStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "92%",
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginTop: 12,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      paddingTop: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 17, fontWeight: "600", color: colors.text },
    subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.border + "60",
      alignItems: "center",
      justifyContent: "center",
    },
    body: { paddingHorizontal: 16, paddingTop: 18 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textMuted,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 8,
      marginLeft: 2,
    },
    fieldGroup: {
      backgroundColor: colors.background ?? colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      marginBottom: 18,
    },
    fieldDivider: { height: 1, backgroundColor: colors.border, marginLeft: 52 },
    fieldInput: {
      fontSize: 14,
      color: colors.text,
      textAlign: "right",
      minWidth: 80,
    },
    chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
    chipActive: { backgroundColor: colors.success + "20" },
    chipInactive: { backgroundColor: colors.warning + "20" },
    chipText: { fontSize: 11, fontWeight: "700" },
    btnRow: { flexDirection: "row", gap: 10 },
    btnPrimary: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    btnPrimaryText: {
      color: colors.primaryText,
      fontSize: 15,
      fontWeight: "600",
    },
    btnSecondary: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    btnSecondaryText: { color: colors.textMuted, fontSize: 15 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
    btnDanger: {
      backgroundColor: colors.warning + "18",
      borderWidth: 1,
      borderColor: colors.warning + "40",
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: "center",
    },
    btnDangerText: { color: colors.warning, fontSize: 14, fontWeight: "600" },
  });

const FieldRow = ({
  icon,
  iconBg,
  label,
  required,
  children,
}: {
  icon: string;
  iconBg: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 11,
      gap: 10,
    }}
  >
    <View
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: iconBg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ThemedText style={{ fontSize: 13 }}>{icon}</ThemedText>
    </View>
    <ThemedText style={{ fontSize: 12, color: "gray", minWidth: 68 }}>
      {label}
      {required && <ThemedText style={{ color: "#E24B4A" }}> *</ThemedText>}
    </ThemedText>
    <View style={{ flex: 1, alignItems: "flex-end" }}>{children}</View>
  </View>
);

const ToggleRow = ({
  colors,
  label,
  subtitle,
  value,
  onToggle,
}: {
  colors: any;
  label: string;
  subtitle: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) => (
  <TouchableOpacity
    style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 16,
    }}
    onPress={() => onToggle(!value)}
    activeOpacity={0.8}
  >
    <View>
      <ThemedText
        style={{ fontSize: 14, fontWeight: "500", color: colors.text }}
      >
        {label}
      </ThemedText>
      <ThemedText
        style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}
      >
        {subtitle}
      </ThemedText>
    </View>
    <View
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        backgroundColor: value ? colors.success : colors.border,
        justifyContent: "center",
        paddingHorizontal: 3,
        alignItems: value ? "flex-end" : "flex-start",
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: "#fff",
        }}
      />
    </View>
  </TouchableOpacity>
);

const AddVehicleModal = ({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (fleet: Omit<Fleet, "id">) => void;
}) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const s = modalStyles(colors);
  const [form, setForm] = useState<Partial<Fleet>>({
    fleetNumber: "",
    vehicleReg: "",
    vehicleMake: "",
    vehicleModel: "",
    currentDriver: "",
    transmitionType: "Manual",
    ownershipStatus: "Owned",
    currentkm: 0,
    servicePlanStatus: false,
  });

  const handleSubmit = () => {
    if (!form.vehicleReg || !form.fleetNumber) {
      Alert.alert("Error", "Registration and Fleet Number are required");
      return;
    }
    onAdd(form as Omit<Fleet, "id">);
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          style={s.sheet}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={s.handle} />
          <View style={s.header}>
            <View>
              <ThemedText style={s.title}>Add vehicle</ThemedText>
              <ThemedText style={s.subtitle}>
                Fill in the details below
              </ThemedText>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <CustomScrollView
            className="p-2"
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <ThemedText style={s.sectionLabel}>Identity</ThemedText>
            <View style={s.fieldGroup}>
              <FieldRow
                icon="🚗"
                iconBg={colors.primary + "18"}
                label="Fleet no."
                required
              >
                <TextInput
                  style={s.fieldInput}
                  placeholder="e.g. F-042"
                  value={form.fleetNumber ?? ""}
                  onChangeText={(v) => setForm({ ...form, fleetNumber: v })}
                  placeholderTextColor={colors.textMuted}
                />
              </FieldRow>
              <View style={s.fieldDivider} />
              <FieldRow
                icon="🔢"
                iconBg={colors.primary + "18"}
                label="Reg."
                required
              >
                <TextInput
                  style={s.fieldInput}
                  placeholder="e.g. ABC 123 GP"
                  value={form.vehicleReg ?? ""}
                  onChangeText={(v) => setForm({ ...form, vehicleReg: v })}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                />
              </FieldRow>
            </View>

            <ThemedText style={s.sectionLabel}>Vehicle</ThemedText>
            <View style={s.fieldGroup}>
              <FieldRow icon="🏷" iconBg={colors.primary + "10"} label="Make">
                <TextInput
                  style={s.fieldInput}
                  placeholder="e.g. Toyota"
                  value={form.vehicleMake ?? ""}
                  onChangeText={(v) => setForm({ ...form, vehicleMake: v })}
                  placeholderTextColor={colors.textMuted}
                />
              </FieldRow>
              <View style={s.fieldDivider} />
              <FieldRow icon="📋" iconBg={colors.primary + "10"} label="Model">
                <TextInput
                  style={s.fieldInput}
                  placeholder="e.g. Hilux"
                  value={form.vehicleModel ?? ""}
                  onChangeText={(v) => setForm({ ...form, vehicleModel: v })}
                  placeholderTextColor={colors.textMuted}
                />
              </FieldRow>
              <View style={s.fieldDivider} />
              <FieldRow icon="📍" iconBg={colors.success + "15"} label="KM">
                <TextInput
                  style={[s.fieldInput, { width: 90 }]}
                  placeholder="0"
                  keyboardType="numeric"
                  value={form.currentkm ? String(form.currentkm) : ""}
                  onChangeText={(v) =>
                    setForm({ ...form, currentkm: parseInt(v) || 0 })
                  }
                  placeholderTextColor={colors.textMuted}
                />
              </FieldRow>
            </View>

            <ThemedText style={s.sectionLabel}>Assignment</ThemedText>
            <View style={s.fieldGroup}>
              <FieldRow icon="👤" iconBg={colors.success + "15"} label="Driver">
                <TextInput
                  style={s.fieldInput}
                  placeholder="Assign later"
                  value={form.currentDriver ?? ""}
                  onChangeText={(v) => setForm({ ...form, currentDriver: v })}
                  placeholderTextColor={colors.textMuted}
                />
              </FieldRow>
            </View>

            <ToggleRow
              colors={colors}
              label="Service plan active"
              subtitle="Is this vehicle on a plan?"
              value={!!form.servicePlanStatus}
              onToggle={(v) => setForm({ ...form, servicePlanStatus: v })}
            />
          </CustomScrollView>

          {/* Pinned submit button — always visible */}
          <View style={{ padding: 16, paddingBottom: 32 }}>
            <TouchableOpacity style={s.btnPrimary} onPress={handleSubmit}>
              <Plus size={16} color="#fff" />
              <ThemedText style={s.btnPrimaryText}>Add vehicle</ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const EditVehicleModal = ({
  fleet,
  onClose,
  onSave,
  onDelete,
}: {
  fleet: Fleet;
  onClose: () => void;
  onSave: (fleet: Fleet) => void;
  onDelete: (id: string) => void;
}) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const s = modalStyles(colors);
  const [form, setForm] = useState<Fleet>({ ...fleet });

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          style={s.sheet}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={s.handle} />
          <View style={s.header}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <ThemedText style={s.title}>{fleet.vehicleReg}</ThemedText>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 3,
                }}
              >
                <ThemedText style={s.subtitle}>
                  {fleet.fleetNumber} · {fleet.vehicleMake} {fleet.vehicleModel}
                </ThemedText>
                <View
                  style={[
                    s.chip,
                    fleet.servicePlanStatus ? s.chipActive : s.chipInactive,
                  ]}
                >
                  <ThemedText
                    style={[
                      s.chipText,
                      {
                        color: fleet.servicePlanStatus
                          ? colors.success
                          : colors.warning,
                      },
                    ]}
                  >
                    {fleet.servicePlanStatus ? "Active" : "Inactive"}
                  </ThemedText>
                </View>
              </View>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <CustomScrollView
            className="p-2"
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <ThemedText style={s.sectionLabel}>Identity</ThemedText>
            <View style={s.fieldGroup}>
              <FieldRow
                icon="🚗"
                iconBg={colors.primary + "18"}
                label="Fleet no."
              >
                <TextInput
                  style={s.fieldInput}
                  value={form.fleetNumber ?? ""}
                  onChangeText={(v) => setForm({ ...form, fleetNumber: v })}
                  placeholderTextColor={colors.textMuted}
                />
              </FieldRow>
              <View style={s.fieldDivider} />
              <FieldRow icon="🔢" iconBg={colors.primary + "18"} label="Reg.">
                <TextInput
                  style={s.fieldInput}
                  value={form.vehicleReg ?? ""}
                  onChangeText={(v) => setForm({ ...form, vehicleReg: v })}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                />
              </FieldRow>
            </View>

            <ThemedText style={s.sectionLabel}>Vehicle</ThemedText>
            <View style={s.fieldGroup}>
              <FieldRow icon="🏷" iconBg={colors.primary + "10"} label="Make">
                <TextInput
                  style={s.fieldInput}
                  value={form.vehicleMake ?? ""}
                  onChangeText={(v) => setForm({ ...form, vehicleMake: v })}
                  placeholderTextColor={colors.textMuted}
                />
              </FieldRow>
              <View style={s.fieldDivider} />
              <FieldRow icon="📋" iconBg={colors.primary + "10"} label="Model">
                <TextInput
                  style={s.fieldInput}
                  value={form.vehicleModel ?? ""}
                  onChangeText={(v) => setForm({ ...form, vehicleModel: v })}
                  placeholderTextColor={colors.textMuted}
                />
              </FieldRow>
              <View style={s.fieldDivider} />
              <FieldRow icon="📍" iconBg={colors.success + "15"} label="KM">
                <TextInput
                  style={[s.fieldInput, { width: 100 }]}
                  keyboardType="numeric"
                  value={String(form.currentkm ?? "")}
                  onChangeText={(v) =>
                    setForm({ ...form, currentkm: parseInt(v) || 0 })
                  }
                  placeholderTextColor={colors.textMuted}
                />
              </FieldRow>
            </View>

            <ThemedText style={s.sectionLabel}>Assignment</ThemedText>
            <View style={s.fieldGroup}>
              <FieldRow icon="👤" iconBg={colors.success + "15"} label="Driver">
                <TextInput
                  style={s.fieldInput}
                  value={form.currentDriver ?? ""}
                  onChangeText={(v) => setForm({ ...form, currentDriver: v })}
                  placeholderTextColor={colors.textMuted}
                />
              </FieldRow>
            </View>

            <ToggleRow
              colors={colors}
              label="Service plan active"
              subtitle="Currently on a plan"
              value={!!form.servicePlanStatus}
              onToggle={(v) => setForm({ ...form, servicePlanStatus: v })}
            />
          </CustomScrollView>

          {/* Pinned footer buttons — always visible */}
          <View style={{ padding: 16, paddingBottom: 32, gap: 10 }}>
            <View style={s.btnRow}>
              <TouchableOpacity
                style={s.btnPrimary}
                onPress={() => {
                  onSave(form);
                  onClose();
                }}
              >
                <Save size={15} color="#fff" />
                <ThemedText style={s.btnPrimaryText}>Save changes</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSecondary} onPress={onClose}>
                <ThemedText style={s.btnSecondaryText}>Cancel</ThemedText>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={s.btnDanger}
              onPress={() => onDelete(fleet.id)}
            >
              <ThemedText style={s.btnDangerText}>Remove vehicle</ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};
