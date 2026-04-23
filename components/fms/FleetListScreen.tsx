// src/screens/FleetListScreen.tsx
import { ThemedText } from "@/components/ui/screen";
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
    ScrollView,
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

// ---------- AddVehicleModal (styled with getStyles) ----------
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
  const styles = getStyles(theme.colors);
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
    <Modal transparent visible={visible} onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <ThemedText style={styles.sheetTitle}>Add New Vehicle</ThemedText>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            <TextInput
              style={styles.formInput}
              placeholder="Fleet Number *"
              value={form.fleetNumber ?? ""}
              onChangeText={(v) => setForm({ ...form, fleetNumber: v })}
              placeholderTextColor={theme.colors.textMuted}
            />
            <TextInput
              style={styles.formInput}
              placeholder="Registration *"
              value={form.vehicleReg ?? ""}
              onChangeText={(v) => setForm({ ...form, vehicleReg: v })}
              placeholderTextColor={theme.colors.textMuted}
            />
            <TextInput
              style={styles.formInput}
              placeholder="Make"
              value={form.vehicleMake ?? ""}
              onChangeText={(v) => setForm({ ...form, vehicleMake: v })}
              placeholderTextColor={theme.colors.textMuted}
            />
            <TextInput
              style={styles.formInput}
              placeholder="Model"
              value={form.vehicleModel ?? ""}
              onChangeText={(v) => setForm({ ...form, vehicleModel: v })}
              placeholderTextColor={theme.colors.textMuted}
            />
            <TextInput
              style={styles.formInput}
              placeholder="Current Driver"
              value={form.currentDriver ?? ""}
              onChangeText={(v) => setForm({ ...form, currentDriver: v })}
              placeholderTextColor={theme.colors.textMuted}
            />
            <TouchableOpacity style={styles.btnPrimary} onPress={handleSubmit}>
              <ThemedText style={styles.btnPrimaryText}>Add Vehicle</ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// ---------- EditVehicleModal (styled with getStyles) ----------
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
  const styles = getStyles(theme.colors);
  const [form, setForm] = useState<Fleet>({ ...fleet });

  return (
    <Modal transparent visible onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <ThemedText style={styles.sheetTitle}>
              Edit {fleet.vehicleReg}
            </ThemedText>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            <TextInput
              style={styles.formInput}
              value={form.fleetNumber ?? ""}
              onChangeText={(v) => setForm({ ...form, fleetNumber: v })}
              placeholder="Fleet Number"
            />
            <TextInput
              style={styles.formInput}
              value={form.vehicleReg ?? ""}
              onChangeText={(v) => setForm({ ...form, vehicleReg: v })}
              placeholder="Registration"
            />
            <TextInput
              style={styles.formInput}
              value={form.vehicleMake ?? ""}
              onChangeText={(v) => setForm({ ...form, vehicleMake: v })}
              placeholder="Make"
            />
            <TextInput
              style={styles.formInput}
              value={form.vehicleModel ?? ""}
              onChangeText={(v) => setForm({ ...form, vehicleModel: v })}
              placeholder="Model"
            />
            <TextInput
              style={styles.formInput}
              value={form.currentDriver ?? ""}
              onChangeText={(v) => setForm({ ...form, currentDriver: v })}
              placeholder="Current Driver"
            />
            <TextInput
              style={styles.formInput}
              keyboardType="numeric"
              value={String(form.currentkm ?? "")}
              onChangeText={(v) =>
                setForm({ ...form, currentkm: parseInt(v) || 0 })
              }
              placeholder="Current KM"
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => {
                  onSave(form);
                  onClose();
                }}
              >
                <Save size={16} color={theme.colors.primaryText} />
                <ThemedText style={styles.btnPrimaryText}>Save</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSecondary} onPress={onClose}>
                <ThemedText style={styles.btnSecondaryText}>Cancel</ThemedText>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.btnDanger}
              onPress={() => onDelete(fleet.id)}
            >
              <ThemedText style={styles.btnDangerText}>
                Delete Vehicle
              </ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};
