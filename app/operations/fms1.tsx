import { NonTabScreen } from "@/components/ui/non-tab-screen";
import { ThemedText } from "@/components/ui/screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useTheme } from "@/src/contexts/theme-context";
import {
    AlertCircle,
    ArrowLeft,
    Car,
    Check,
    ChevronRight,
    ClipboardList,
    Pencil,
    Plus,
    Save,
    Search,
    X,
} from "lucide-react-native";
import { useState } from "react";
import {
    Modal,
    Platform,
    StatusBar,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

// ========== TYPES ==========
interface Fleet {
  id: string;
  fleetNumber: string;
  vehicleReg: string;
  vehicleMake: string;
  vehicleModel: string;
  currentDriver: string;
  transmitionType: string;
  ownershipStatus: string;
  currentkm: number;
  servicePlanStatus: boolean;
  fleetIndex: string;
  vehicleVin: string;
  lastServicedate: string | null;
  lastServicekm: number | null;
  lastRotationdate: string | null;
  lastRotationkm: number | null;
  servicePlan: string | null;
  codeRequirement: string;
  pdpRequirement: boolean;
  serviceplankm: number | null;
  breakandLuxExpirey: string | null;
  liscenseDiscExpirey: string | null;
}

interface Inspection {
  id: string;
  inspectionNo: number;
  inspectionDate: string;
  inspectorOrDriver: string;
  odometerStart: number;
  oilAndCoolant: boolean;
  fuelLevel: boolean;
  lights: boolean;
  tyreCondition: boolean;
  seatbeltDoorsMirrors: boolean;
  handbrake: boolean;
  spareTyre: boolean;
  numberPlate: boolean;
  licenseDisc: boolean;
  leaks: boolean;
  defrosterAircon: boolean;
  emergencyKit: boolean;
  clean: boolean;
  warnings: boolean;
  windscreenWipers: boolean;
  serviceBook: boolean;
  siteKit: boolean;
  history: string;
}

type InspectionsMap = Record<string, Inspection[]>;

// ========== DUMMY DATA ==========
const DUMMY_FLEETS: Fleet[] = [
  {
    id: "1",
    fleetNumber: "FLT-001",
    vehicleReg: "GP 123-456",
    vehicleMake: "Toyota",
    vehicleModel: "Hilux",
    currentDriver: "John Mokoena",
    transmitionType: "Manual",
    ownershipStatus: "Owned",
    currentkm: 87420,
    servicePlanStatus: true,
    fleetIndex: "A",
    vehicleVin: "JTEBP3FJ20K123456",
    lastServicedate: "2024-09-15",
    lastServicekm: 85000,
    lastRotationdate: "2024-08-01",
    lastRotationkm: 80000,
    servicePlan: "Full Cover",
    codeRequirement: "Code 10",
    pdpRequirement: true,
    serviceplankm: 90000,
    breakandLuxExpirey: "2025-06-30",
    liscenseDiscExpirey: "2025-03-31",
  },
  {
    id: "2",
    fleetNumber: "FLT-002",
    vehicleReg: "GP 789-012",
    vehicleMake: "Ford",
    vehicleModel: "Ranger",
    currentDriver: "Sipho Dlamini",
    transmitionType: "Automatic",
    ownershipStatus: "Leased",
    currentkm: 43210,
    servicePlanStatus: true,
    fleetIndex: "B",
    vehicleVin: "WF0NXXGCNNTB12345",
    lastServicedate: "2024-10-20",
    lastServicekm: 40000,
    lastRotationdate: "2024-09-10",
    lastRotationkm: 38000,
    servicePlan: "Partial",
    codeRequirement: "Code 8",
    pdpRequirement: false,
    serviceplankm: 50000,
    breakandLuxExpirey: "2025-04-15",
    liscenseDiscExpirey: "2025-07-31",
  },
  {
    id: "3",
    fleetNumber: "FLT-003",
    vehicleReg: "GP 345-678",
    vehicleMake: "Isuzu",
    vehicleModel: "D-Max",
    currentDriver: "Thabo Nkosi",
    transmitionType: "Manual",
    ownershipStatus: "Owned",
    currentkm: 120980,
    servicePlanStatus: false,
    fleetIndex: "A",
    vehicleVin: "JADCB58E9J7098765",
    lastServicedate: "2024-06-01",
    lastServicekm: 115000,
    lastRotationdate: "2024-05-15",
    lastRotationkm: 112000,
    servicePlan: null,
    codeRequirement: "Code 10",
    pdpRequirement: true,
    serviceplankm: null,
    breakandLuxExpirey: "2024-12-01",
    liscenseDiscExpirey: "2024-11-30",
  },
  {
    id: "4",
    fleetNumber: "FLT-004",
    vehicleReg: "GP 901-234",
    vehicleMake: "Volkswagen",
    vehicleModel: "Transporter",
    currentDriver: "Lerato Sithole",
    transmitionType: "Automatic",
    ownershipStatus: "Rented",
    currentkm: 29500,
    servicePlanStatus: true,
    fleetIndex: "C",
    vehicleVin: "WV1ZZZ7HZ3H098765",
    lastServicedate: "2024-11-01",
    lastServicekm: 28000,
    lastRotationdate: "2024-10-05",
    lastRotationkm: 25000,
    servicePlan: "Full Cover",
    codeRequirement: "Code 8",
    pdpRequirement: false,
    serviceplankm: 35000,
    breakandLuxExpirey: "2025-08-20",
    liscenseDiscExpirey: "2025-09-30",
  },
  {
    id: "5",
    fleetNumber: "FLT-005",
    vehicleReg: "GP 567-890",
    vehicleMake: "Mercedes-Benz",
    vehicleModel: "Sprinter",
    currentDriver: "Nandi Zulu",
    transmitionType: "Automatic",
    ownershipStatus: "Leased",
    currentkm: 65300,
    servicePlanStatus: false,
    fleetIndex: "B",
    vehicleVin: "WDB9066351S123456",
    lastServicedate: "2024-07-22",
    lastServicekm: 60000,
    lastRotationdate: "2024-07-01",
    lastRotationkm: 58000,
    servicePlan: null,
    codeRequirement: "Code 10",
    pdpRequirement: true,
    serviceplankm: null,
    breakandLuxExpirey: "2025-01-15",
    liscenseDiscExpirey: "2025-02-28",
  },
];

const DUMMY_INSPECTIONS: InspectionsMap = {
  "1": [
    {
      id: "i1",
      inspectionNo: 12,
      inspectionDate: "2024-11-15",
      inspectorOrDriver: "John Mokoena",
      odometerStart: 87200,
      oilAndCoolant: true,
      fuelLevel: true,
      lights: true,
      tyreCondition: true,
      seatbeltDoorsMirrors: true,
      handbrake: true,
      spareTyre: true,
      numberPlate: true,
      licenseDisc: true,
      leaks: false,
      defrosterAircon: true,
      emergencyKit: true,
      clean: true,
      warnings: false,
      windscreenWipers: true,
      serviceBook: true,
      siteKit: true,
      history: "All checks passed. Minor oil top-up done.",
    },
    {
      id: "i2",
      inspectionNo: 11,
      inspectionDate: "2024-10-28",
      inspectorOrDriver: "John Mokoena",
      odometerStart: 86100,
      oilAndCoolant: true,
      fuelLevel: false,
      lights: true,
      tyreCondition: true,
      seatbeltDoorsMirrors: true,
      handbrake: true,
      spareTyre: false,
      numberPlate: true,
      licenseDisc: true,
      leaks: false,
      defrosterAircon: false,
      emergencyKit: true,
      clean: false,
      warnings: false,
      windscreenWipers: true,
      serviceBook: true,
      siteKit: false,
      history: "Fuel level low. Spare tyre deflated.",
    },
    {
      id: "i3",
      inspectionNo: 10,
      inspectionDate: "2024-10-01",
      inspectorOrDriver: "Sipho Dlamini",
      odometerStart: 85000,
      oilAndCoolant: true,
      fuelLevel: true,
      lights: false,
      tyreCondition: true,
      seatbeltDoorsMirrors: true,
      handbrake: true,
      spareTyre: true,
      numberPlate: true,
      licenseDisc: true,
      leaks: false,
      defrosterAircon: true,
      emergencyKit: false,
      clean: true,
      warnings: true,
      windscreenWipers: false,
      serviceBook: true,
      siteKit: true,
      history: "Left rear light out. Emergency kit incomplete.",
    },
  ],
  "2": [
    {
      id: "i4",
      inspectionNo: 7,
      inspectionDate: "2024-11-10",
      inspectorOrDriver: "Sipho Dlamini",
      odometerStart: 43100,
      oilAndCoolant: true,
      fuelLevel: true,
      lights: true,
      tyreCondition: true,
      seatbeltDoorsMirrors: true,
      handbrake: true,
      spareTyre: true,
      numberPlate: true,
      licenseDisc: true,
      leaks: false,
      defrosterAircon: true,
      emergencyKit: true,
      clean: true,
      warnings: false,
      windscreenWipers: true,
      serviceBook: true,
      siteKit: true,
      history: "Full pass.",
    },
  ],
  "3": [],
  "4": [
    {
      id: "i5",
      inspectionNo: 4,
      inspectionDate: "2024-11-05",
      inspectorOrDriver: "Lerato Sithole",
      odometerStart: 29400,
      oilAndCoolant: true,
      fuelLevel: true,
      lights: true,
      tyreCondition: false,
      seatbeltDoorsMirrors: true,
      handbrake: true,
      spareTyre: true,
      numberPlate: true,
      licenseDisc: true,
      leaks: false,
      defrosterAircon: true,
      emergencyKit: true,
      clean: true,
      warnings: false,
      windscreenWipers: true,
      serviceBook: true,
      siteKit: true,
      history: "Front left tyre worn. Replacement recommended.",
    },
  ],
  "5": [],
};

// ========== HELPERS ==========
const isExpired = (dateStr: string | null | undefined): boolean => {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
};

const kmUntilService = (
  current: number | null | undefined,
  serviceKm: number | null | undefined,
): number | null => {
  if (!serviceKm || current === undefined || current === null) return null;
  return serviceKm - current;
};

const passCount = (insp: Inspection): number => {
  const keys: (keyof Inspection)[] = [
    "oilAndCoolant",
    "fuelLevel",
    "lights",
    "tyreCondition",
    "seatbeltDoorsMirrors",
    "handbrake",
    "spareTyre",
    "numberPlate",
    "licenseDisc",
    "leaks",
    "defrosterAircon",
    "emergencyKit",
    "clean",
    "warnings",
    "windscreenWipers",
    "serviceBook",
    "siteKit",
  ];
  return keys.filter((k) => insp[k] === true).length;
};

const CHECKLIST_ITEMS: { key: keyof Inspection; label: string }[] = [
  { key: "oilAndCoolant", label: "Oil & Coolant" },
  { key: "fuelLevel", label: "Fuel Level" },
  { key: "seatbeltDoorsMirrors", label: "Seatbelts/Doors/Mirrors" },
  { key: "handbrake", label: "Handbrake" },
  { key: "tyreCondition", label: "Tyre Condition" },
  { key: "spareTyre", label: "Spare Tyre" },
  { key: "numberPlate", label: "Number Plate" },
  { key: "licenseDisc", label: "License Disc" },
  { key: "leaks", label: "No Leaks" },
  { key: "lights", label: "Lights" },
  { key: "defrosterAircon", label: "Defroster/Aircon" },
  { key: "emergencyKit", label: "Emergency Kit" },
  { key: "clean", label: "Clean" },
  { key: "warnings", label: "No Warnings" },
  { key: "windscreenWipers", label: "Wipers" },
  { key: "serviceBook", label: "Service Book" },
  { key: "siteKit", label: "Site Kit" },
];

// ========== STYLES (using ONLY your theme colors) ==========
const getStyles = (colors: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    navbar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: Platform.OS === "ios" ? 50 : 40,
      paddingBottom: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    navTitle: { fontSize: 18, fontWeight: "700", color: colors.ThemedText },
    navBadge: {
      backgroundColor: colors.primary + "20",
      color: colors.primary,
      fontSize: 11,
      fontWeight: "700",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 99,
      overflow: "hidden",
    },
    content: { padding: 16, flex: 1 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      overflow: "hidden",
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cardTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textMuted,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    cardBody: { padding: 12 },
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
    fleetReg: { fontSize: 15, fontWeight: "700", color: colors.ThemedText },
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
    badgeBlue: {
      backgroundColor: colors.primary + "20",
      color: colors.primary,
    },
    btnPrimary: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 20,
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    btnPrimaryText: {
      color: colors.primaryText,
      fontSize: 13,
      fontWeight: "700",
    },
    btnSecondary: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: 16,
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    btnSecondaryText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    btnGhost: { padding: 8 },
    btnGreen: {
      backgroundColor: colors.success + "20",
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 20,
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    btnGreenText: { color: colors.success, fontSize: 13, fontWeight: "700" },
    searchBar: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      paddingLeft: 38,
      fontSize: 14,
      color: colors.ThemedText,
    },
    searchWrap: { position: "relative", marginBottom: 14 },
    searchIcon: { position: "absolute", left: 12, top: 12, zIndex: 1 },
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
    sheetTitle: { fontSize: 17, fontWeight: "700", color: colors.ThemedText },
    sheetBody: { padding: 20 },
    formGroup: { marginBottom: 14 },
    formLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    formInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 10,
      fontSize: 14,
      color: colors.ThemedText,
    },
    formGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    statGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: "45%",
    },
    statLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    statValue: { fontSize: 16, fontWeight: "700", color: colors.ThemedText },
    inspRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 8,
    },
    inspNo: { fontSize: 14, fontWeight: "700", color: colors.ThemedText },
    inspDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    inspDriver: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
    checkGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    checkItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 8,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      width: "48%",
    },
    checkLabel: { fontSize: 12, color: colors.textMuted },
    empty: { alignItems: "center", padding: 40 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    rowBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    rowGap6: { gap: 6 },
    rowGap8: { gap: 8 },
  });

// ========== COMPONENTS ==========
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

const InspBadge = ({ insp }: { insp: Inspection }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme.colors);
  const total = CHECKLIST_ITEMS.length;
  const passed = passCount(insp);
  const pct = Math.round((passed / total) * 100);
  const ok = pct >= 80;
  const badgeStyle = ok ? styles.badgeGreen : styles.badgeRed;
  return (
    <ThemedText style={[styles.badge, badgeStyle]}>
      {ok ? "Pass" : "Fail"} {pct}%
    </ThemedText>
  );
};

const AddVehicleModal = ({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (fleet: Fleet) => void;
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
  });
  const set = (k: keyof Fleet, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const handleSubmit = () => {
    if (!form.vehicleReg || !form.fleetNumber) return;
    onAdd({
      id: Date.now().toString(),
      fleetNumber: form.fleetNumber!,
      vehicleReg: form.vehicleReg!,
      vehicleMake: form.vehicleMake || "",
      vehicleModel: form.vehicleModel || "",
      currentDriver: form.currentDriver || "",
      transmitionType: form.transmitionType || "Manual",
      ownershipStatus: form.ownershipStatus || "Owned",
      servicePlanStatus: false,
      currentkm: 0,
      fleetIndex: "A",
      vehicleVin: "",
      lastServicedate: null,
      lastServicekm: null,
      lastRotationdate: null,
      lastRotationkm: null,
      servicePlan: null,
      codeRequirement: "Code 8",
      pdpRequirement: false,
      serviceplankm: null,
      breakandLuxExpirey: null,
      liscenseDiscExpirey: null,
    });
    onClose();
  };
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
            <ThemedText style={styles.sheetTitle}>Add New Vehicle</ThemedText>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
          <CustomScrollView>
            <View style={styles.formGrid}>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fleet Number *</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="FLT-006"
                  value={form.fleetNumber}
                  onChangeText={(v) => set("fleetNumber", v)}
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Registration *</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="GP 000-000"
                  value={form.vehicleReg}
                  onChangeText={(v) => set("vehicleReg", v)}
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Make</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Toyota"
                  value={form.vehicleMake}
                  onChangeText={(v) => set("vehicleMake", v)}
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Model</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Hilux"
                  value={form.vehicleModel}
                  onChangeText={(v) => set("vehicleModel", v)}
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>
            </View>
            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Current Driver</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Driver name"
                value={form.currentDriver}
                onChangeText={(v) => set("currentDriver", v)}
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>
            <View style={styles.formGrid}>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Transmission</ThemedText>
                <TextInput
                  style={styles.formInput}
                  value={form.transmitionType}
                  onChangeText={(v) => set("transmitionType", v)}
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Ownership</ThemedText>
                <TextInput
                  style={styles.formInput}
                  value={form.ownershipStatus}
                  onChangeText={(v) => set("ownershipStatus", v)}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.btnPrimary,
                {
                  width: "100%",
                  justifyContent: "center",
                  marginTop: 8,
                  paddingVertical: 13,
                  borderRadius: 14,
                },
              ]}
              onPress={handleSubmit}
            >
              <Plus size={16} color={theme.colors.primaryText} />
              <ThemedText style={styles.btnPrimaryText}>Add Vehicle</ThemedText>
            </TouchableOpacity>
          </CustomScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const EditVehicleModal = ({
  fleet,
  onClose,
  onSave,
}: {
  fleet: Fleet;
  onClose: () => void;
  onSave: (updated: Fleet) => void;
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme.colors);
  const [form, setForm] = useState<Fleet>({ ...fleet });
  const set = (k: keyof Fleet, v: any) => setForm((f) => ({ ...f, [k]: v }));
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
          <CustomScrollView style={styles.sheetBody}>
            <View style={styles.formGrid}>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fleet Number</ThemedText>
                <TextInput
                  style={styles.formInput}
                  value={form.fleetNumber || ""}
                  onChangeText={(v) => set("fleetNumber", v)}
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Registration</ThemedText>
                <TextInput
                  style={styles.formInput}
                  value={form.vehicleReg || ""}
                  onChangeText={(v) => set("vehicleReg", v)}
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Make</ThemedText>
                <TextInput
                  style={styles.formInput}
                  value={form.vehicleMake || ""}
                  onChangeText={(v) => set("vehicleMake", v)}
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Model</ThemedText>
                <TextInput
                  style={styles.formInput}
                  value={form.vehicleModel || ""}
                  onChangeText={(v) => set("vehicleModel", v)}
                />
              </View>
            </View>
            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Current Driver</ThemedText>
              <TextInput
                style={styles.formInput}
                value={form.currentDriver || ""}
                onChangeText={(v) => set("currentDriver", v)}
              />
            </View>
            <View style={styles.formGrid}>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Current KM</ThemedText>
                <TextInput
                  style={styles.formInput}
                  keyboardType="numeric"
                  value={String(form.currentkm || "")}
                  onChangeText={(v) => set("currentkm", parseInt(v) || 0)}
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>
                  Service Plan KM
                </ThemedText>
                <TextInput
                  style={styles.formInput}
                  keyboardType="numeric"
                  value={String(form.serviceplankm || "")}
                  onChangeText={(v) => set("serviceplankm", parseInt(v) || 0)}
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>
                  Last Service Date
                </ThemedText>
                <TextInput
                  style={styles.formInput}
                  value={form.lastServicedate || ""}
                  onChangeText={(v) => set("lastServicedate", v)}
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>
                  Lic. Disc Expiry
                </ThemedText>
                <TextInput
                  style={styles.formInput}
                  value={form.liscenseDiscExpirey || ""}
                  onChangeText={(v) => set("liscenseDiscExpirey", v)}
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Transmission</ThemedText>
                <TextInput
                  style={styles.formInput}
                  value={form.transmitionType || ""}
                  onChangeText={(v) => set("transmitionType", v)}
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Service Plan</ThemedText>
                <TextInput
                  style={styles.formInput}
                  value={form.servicePlanStatus ? "Active" : "Inactive"}
                  onChangeText={(v) => set("servicePlanStatus", v === "Active")}
                />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={[
                  styles.btnPrimary,
                  {
                    flex: 1,
                    justifyContent: "center",
                    paddingVertical: 13,
                    borderRadius: 14,
                  },
                ]}
                onPress={() => {
                  onSave(form);
                  onClose();
                }}
              >
                <Save size={16} color={theme.colors.primaryText} />
                <ThemedText style={styles.btnPrimaryText}>Save</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.btnSecondary,
                  {
                    paddingVertical: 13,
                    paddingHorizontal: 20,
                    borderRadius: 14,
                  },
                ]}
                onPress={onClose}
              >
                <ThemedText style={styles.btnSecondaryText}>Cancel</ThemedText>
              </TouchableOpacity>
            </View>
          </CustomScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const FleetListScreen = ({
  fleets,
  onSelectFleet,
  onAddFleet,
  onEditFleet,
}: {
  fleets: Fleet[];
  onSelectFleet: (fleet: Fleet) => void;
  onAddFleet: (fleet: Fleet) => void;
  onEditFleet: (fleet: Fleet) => void;
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme.colors);
  const [search, setSearch] = useState("");
  const [searchType, setSearchType] = useState<"reg" | "driver">("reg");
  const [showAdd, setShowAdd] = useState(false);
  const filtered = fleets.filter((f) =>
    searchType === "reg"
      ? f.vehicleReg?.toLowerCase().includes(search.toLowerCase())
      : f.currentDriver?.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <CustomScrollView style={styles.content}>
        <View style={[styles.card, { marginBottom: 14 }]}>
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
        <TouchableOpacity
          style={[
            styles.btnGreen,
            {
              width: "100%",
              justifyContent: "center",
              marginBottom: 16,
              paddingVertical: 13,
              borderRadius: 14,
            },
          ]}
          onPress={() => setShowAdd(true)}
        >
          <Plus size={16} color={theme.colors.success} />
          <ThemedText style={styles.btnGreenText}>Add Vehicle</ThemedText>
        </TouchableOpacity>
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
                        ? theme.colors.primary
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
                        onEditFleet(fleet);
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
      {showAdd && (
        <AddVehicleModal onClose={() => setShowAdd(false)} onAdd={onAddFleet} />
      )}
    </>
  );
};

const FleetDetailScreen = ({
  fleet,
  inspections,
  onBack,
  onEditFleet,
  onSelectInspection,
}: {
  fleet: Fleet;
  inspections: Inspection[];
  onBack: () => void;
  onEditFleet: (fleet: Fleet) => void;
  onSelectInspection: (inspection: Inspection) => void;
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme.colors);
  const expiredLic = isExpired(fleet.liscenseDiscExpirey);
  const expiredBlx = isExpired(fleet.breakandLuxExpirey);
  const kmToService = kmUntilService(fleet.currentkm, fleet.serviceplankm);
  return (
    <>
      <View style={styles.navbar}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity style={styles.btnGhost} onPress={onBack}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Car size={18} color={theme.colors.primary} />
          <ThemedText style={[styles.navTitle, { fontSize: 16 }]}>
            {fleet.vehicleReg}
          </ThemedText>
        </View>
        <TouchableOpacity
          style={styles.btnGhost}
          onPress={() => onEditFleet(fleet)}
        >
          <Pencil size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>
      <CustomScrollView style={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardBody}>
            <View style={styles.rowBetween}>
              <View>
                <ThemedText
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: theme.colors.text,
                  }}
                >
                  {fleet.vehicleReg}
                </ThemedText>
                <ThemedText
                  style={{ fontSize: 14, color: theme.colors.textMuted }}
                >
                  {fleet.fleetNumber} · {fleet.vehicleMake} {fleet.vehicleModel}
                </ThemedText>
                <ThemedText
                  style={{
                    fontSize: 12,
                    color: theme.colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  {fleet.transmitionType} · {fleet.ownershipStatus}
                </ThemedText>
              </View>
              <Badge status={fleet.servicePlanStatus} />
            </View>
            <View style={styles.statGrid}>
              <View style={styles.statCard}>
                <ThemedText style={styles.statLabel}>Current KM</ThemedText>
                <ThemedText style={styles.statValue}>
                  {fleet.currentkm?.toLocaleString()} km
                </ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statLabel}>Driver</ThemedText>
                <ThemedText style={[styles.statValue, { fontSize: 13 }]}>
                  {fleet.currentDriver || "—"}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.statCard,
                  {
                    borderColor: expiredLic
                      ? theme.colors.warning
                      : theme.colors.border,
                  },
                ]}
              >
                <ThemedText style={styles.statLabel}>
                  Lic. Disc Expiry
                </ThemedText>
                <ThemedText
                  style={[
                    styles.statValue,
                    {
                      fontSize: 13,
                      color: expiredLic
                        ? theme.colors.warning
                        : theme.colors.text,
                    },
                  ]}
                >
                  {fleet.liscenseDiscExpirey || "—"}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.statCard,
                  {
                    borderColor: expiredBlx
                      ? theme.colors.warning
                      : theme.colors.border,
                  },
                ]}
              >
                <ThemedText style={styles.statLabel}>
                  Brake & Lux Exp.
                </ThemedText>
                <ThemedText
                  style={[
                    styles.statValue,
                    {
                      fontSize: 13,
                      color: expiredBlx
                        ? theme.colors.warning
                        : theme.colors.text,
                    },
                  ]}
                >
                  {fleet.breakandLuxExpirey || "—"}
                </ThemedText>
              </View>
              {kmToService !== null && (
                <View
                  style={[
                    styles.statCard,
                    {
                      borderColor:
                        kmToService < 2000
                          ? theme.colors.warning
                          : theme.colors.border,
                      width: "100%",
                    },
                  ]}
                >
                  <ThemedText style={styles.statLabel}>
                    KM Until Next Service
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.statValue,
                      {
                        color:
                          kmToService < 2000
                            ? theme.colors.warning
                            : theme.colors.success,
                      },
                    ]}
                  >
                    {kmToService.toLocaleString()} km remaining
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        </View>
        {(expiredLic || expiredBlx) && (
          <View
            style={[
              styles.card,
              { borderColor: theme.colors.warning, marginBottom: 12 },
            ]}
          >
            <View
              style={[
                styles.cardBody,
                { flexDirection: "row", gap: 10, alignItems: "flex-start" },
              ]}
            >
              <AlertCircle size={20} color={theme.colors.warning} />
              <View>
                <ThemedText
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: theme.colors.warning,
                  }}
                >
                  Compliance Alerts
                </ThemedText>
                {expiredLic && (
                  <ThemedText
                    style={{
                      fontSize: 12,
                      color: theme.colors.textMuted,
                      marginTop: 3,
                    }}
                  >
                    • License disc has expired
                  </ThemedText>
                )}
                {expiredBlx && (
                  <ThemedText
                    style={{
                      fontSize: 12,
                      color: theme.colors.textMuted,
                      marginTop: 2,
                    }}
                  >
                    • Brake & Lux test has expired
                  </ThemedText>
                )}
              </View>
            </View>
          </View>
        )}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Inspections</ThemedText>
            <ThemedText style={[styles.badge, styles.badgeBlue]}>
              {inspections.length}
            </ThemedText>
          </View>
          <View style={styles.cardBody}>
            {inspections.length === 0 ? (
              <View style={[styles.empty, { padding: 20 }]}>
                <ThemedText style={{ color: theme.colors.textMuted }}>
                  No inspections recorded
                </ThemedText>
              </View>
            ) : (
              inspections.map((insp) => (
                <TouchableOpacity
                  key={insp.id}
                  style={styles.inspRow}
                  onPress={() => onSelectInspection(insp)}
                >
                  <View>
                    <ThemedText style={styles.inspNo}>
                      Inspection #{insp.inspectionNo}
                    </ThemedText>
                    <ThemedText style={styles.inspDate}>
                      {insp.inspectionDate}
                    </ThemedText>
                    <ThemedText style={styles.inspDriver}>
                      {insp.inspectorOrDriver}
                    </ThemedText>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <InspBadge insp={insp} />
                    <ChevronRight size={16} color={theme.colors.textMuted} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </CustomScrollView>
    </>
  );
};

const InspectionDetailScreen = ({
  inspection,
  fleetReg,
  onBack,
}: {
  inspection: Inspection;
  fleetReg: string | undefined;
  onBack: () => void;
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme.colors);
  const total = CHECKLIST_ITEMS.length;
  const passed = passCount(inspection);
  return (
    <>
      <View style={styles.navbar}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity style={styles.btnGhost} onPress={onBack}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <ClipboardList size={18} color={theme.colors.primary} />
          <ThemedText style={[styles.navTitle, { fontSize: 16 }]}>
            Inspection #{inspection.inspectionNo}
          </ThemedText>
        </View>
        <InspBadge insp={inspection} />
      </View>
      <CustomScrollView style={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardBody}>
            <View style={styles.statGrid}>
              <View style={styles.statCard}>
                <ThemedText style={styles.statLabel}>Vehicle</ThemedText>
                <ThemedText style={[styles.statValue, { fontSize: 14 }]}>
                  {fleetReg}
                </ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statLabel}>Date</ThemedText>
                <ThemedText style={[styles.statValue, { fontSize: 14 }]}>
                  {inspection.inspectionDate}
                </ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statLabel}>Inspector</ThemedText>
                <ThemedText style={[styles.statValue, { fontSize: 13 }]}>
                  {inspection.inspectorOrDriver}
                </ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statLabel}>Odometer</ThemedText>
                <ThemedText style={[styles.statValue, { fontSize: 14 }]}>
                  {inspection.odometerStart?.toLocaleString()} km
                </ThemedText>
              </View>
            </View>
            <View style={{ marginTop: 12 }}>
              <View style={styles.rowBetween}>
                <ThemedText
                  style={{
                    fontSize: 12,
                    color: theme.colors.textMuted,
                    fontWeight: "700",
                  }}
                >
                  CHECKLIST SCORE
                </ThemedText>
                <ThemedText
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color:
                      passed / total >= 0.8
                        ? theme.colors.success
                        : theme.colors.warning,
                  }}
                >
                  {passed}/{total}
                </ThemedText>
              </View>
              <View
                style={{
                  backgroundColor: theme.colors.card,
                  borderRadius: 99,
                  height: 6,
                  overflow: "hidden",
                  marginTop: 6,
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${(passed / total) * 100}%`,
                    backgroundColor:
                      passed / total >= 0.8
                        ? theme.colors.success
                        : theme.colors.warning,
                    borderRadius: 99,
                  }}
                />
              </View>
            </View>
          </View>
        </View>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Checklist Items</ThemedText>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.checkGrid}>
              {CHECKLIST_ITEMS.map((item) => {
                const val = inspection[item.key];
                return (
                  <View
                    key={item.key}
                    style={[
                      styles.checkItem,
                      {
                        borderLeftWidth: 3,
                        borderLeftColor: val
                          ? theme.colors.success
                          : theme.colors.warning,
                      },
                    ]}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 99,
                        backgroundColor: val
                          ? theme.colors.success + "20"
                          : theme.colors.warning + "20",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {val ? (
                        <Check size={10} color={theme.colors.success} />
                      ) : (
                        <X size={10} color={theme.colors.warning} />
                      )}
                    </View>
                    <ThemedText
                      style={[
                        styles.checkLabel,
                        {
                          color: val
                            ? theme.colors.textMuted
                            : theme.colors.warning,
                        },
                      ]}
                    >
                      {item.label}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
        {inspection.history && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>Notes</ThemedText>
            </View>
            <View style={styles.cardBody}>
              <ThemedText
                style={{
                  fontSize: 13,
                  color: theme.colors.textMuted,
                  lineHeight: 20,
                }}
              >
                {inspection.history}
              </ThemedText>
            </View>
          </View>
        )}
      </CustomScrollView>
    </>
  );
};

// ========== MAIN APP (NO CUSTOM TAB BAR) ==========
export default function App() {
  const [fleets, setFleets] = useState<Fleet[]>(DUMMY_FLEETS);
  const [inspections] = useState<InspectionsMap>(DUMMY_INSPECTIONS);
  const [screen, setScreen] = useState<"list" | "detail" | "inspection">(
    "list",
  );
  const [selectedFleet, setSelectedFleet] = useState<Fleet | null>(null);
  const [selectedInspection, setSelectedInspection] =
    useState<Inspection | null>(null);
  const [editingFleet, setEditingFleet] = useState<Fleet | null>(null);
  const { theme } = useTheme();
  const styles = getStyles(theme.colors);

  const handleAddFleet = (fleet: Fleet) => setFleets((f) => [fleet, ...f]);
  const handleSaveFleet = (updated: Fleet) => {
    setFleets((f) => f.map((fl) => (fl.id === updated.id ? updated : fl)));
    if (selectedFleet?.id === updated.id) setSelectedFleet(updated);
  };

  return (
    <NonTabScreen
      title="Fleet Management"
      subtitle="Manage your fleet"
      showBack
      scrollable
    >
      <StatusBar
        barStyle={theme.name === "dark" ? "light-content" : "dark-content"}
        backgroundColor={theme.colors.background}
      />
      {screen === "list" && (
        <FleetListScreen
          fleets={fleets}
          onSelectFleet={(fleet) => {
            setSelectedFleet(fleet);
            setScreen("detail");
          }}
          onAddFleet={handleAddFleet}
          onEditFleet={(fleet) => setEditingFleet(fleet)}
        />
      )}
      {screen === "detail" && selectedFleet && (
        <FleetDetailScreen
          fleet={selectedFleet}
          inspections={inspections[selectedFleet.id] || []}
          onBack={() => setScreen("list")}
          onEditFleet={(fleet) => setEditingFleet(fleet)}
          onSelectInspection={(insp) => {
            setSelectedInspection(insp);
            setScreen("inspection");
          }}
        />
      )}
      {screen === "inspection" && selectedInspection && (
        <InspectionDetailScreen
          inspection={selectedInspection}
          fleetReg={selectedFleet?.vehicleReg}
          onBack={() => setScreen("detail")}
        />
      )}
      {editingFleet && (
        <EditVehicleModal
          fleet={editingFleet}
          onClose={() => setEditingFleet(null)}
          onSave={(updated) => {
            handleSaveFleet(updated);
            setEditingFleet(null);
          }}
        />
      )}
    </NonTabScreen>
  );
}
