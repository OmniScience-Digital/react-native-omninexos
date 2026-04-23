// src/screens/FleetDetailScreen.tsx
import { ThemedText } from "@/components/ui/screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useTheme } from "@/src/contexts/theme-context";
import { useListInspectionsByFleetQuery } from "@/src/state/api";

import {
    AlertCircle,
    ArrowLeft,
    Car,
    ChevronRight,
    Pencil,
} from "lucide-react-native";
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";

// ========== Helpers ==========
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
  { key: "windscreenWipers", label: "Windscreen & Wipers" },
  { key: "serviceBook", label: "Service Book" },
  { key: "siteKit", label: "Site Kit" },
];

// ========== Local Badge Components ==========
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

// ========== Styles ==========
const getStyles = (colors: any) =>
  StyleSheet.create({
    navbar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingTop: Platform.OS === "ios" ? 20 : 10,
      paddingBottom: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    navTitle: { fontSize: 18, fontWeight: "700", color: colors.ThemedText },
    content: { padding: 5, flex: 1 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      overflow: "hidden",
    },
    cardBody: { padding: 12 },
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
    rowBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    statGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 5,
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
    empty: { alignItems: "center", padding: 40 },
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
    btnGhost: { padding: 8 },
  });

// ========== Main Component (onEditFleet optional) ==========
export default function FleetDetailScreen({
  fleet,
  onBack,
  onEditFleet,
  onSelectInspection,
}: {
  fleet: Fleet;
  onBack: () => void;
  onEditFleet?: (fleet: Fleet) => void; // made optional
  onSelectInspection: (inspection: Inspection) => void;
}) {
  const { theme } = useTheme();
  const styles = getStyles(theme.colors);
  const { data: inspections = [], isLoading } = useListInspectionsByFleetQuery({
    fleetId: fleet.id,
  });

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
        {onEditFleet && (
          <TouchableOpacity
            style={styles.btnGhost}
            onPress={() => onEditFleet(fleet)}
          >
            <Pencil size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <CustomScrollView style={styles.content}>
        {/* Main Info Card */}
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
                <ThemedText style={[styles.statValue, { fontSize: 12 }]}>
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
                      fontSize: 12,
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
                      fontSize: 12,
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

        {/* Compliance Alerts */}
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

        {/* Inspections Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Inspections</ThemedText>
            <ThemedText style={[styles.badge, styles.badgeBlue]}>
              {inspections.length}
            </ThemedText>
          </View>
          <View style={styles.cardBody}>
            {isLoading ? (
              <ActivityIndicator />
            ) : inspections.length === 0 ? (
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
}
