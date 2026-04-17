// components/viFComponents/VifForm.tsx
import { useTheme } from "@/src/contexts/theme-context";
import { ChevronDown, Search, X } from "lucide-react-native";
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
import BooleanQuestion from "./BooleanQuestion";
import PhotoUpload, { PhotoState } from "./PhotoUpload";

export const booleanQuestions = [
  {
    question: "Are the engine oil and Coolant Level Acceptable?",
    value: null as boolean | null,
  },
  { question: "Is there a full tank of Fuel prior to start?", value: null },
  {
    question: "Are the Seatbelts, Doors and Mirrors Functioning Correctly?",
    value: null,
  },
  { question: "Is the handbrake Tested and Functional?", value: null },
  {
    question: "Are all the Tyres wear, Tread, and Pressure Acceptable?",
    value: null,
  },
  {
    question:
      "Is there a Spare tyre, jack, Spanner on the vehicle and in good condition?",
    value: null,
  },
  {
    question:
      "Is there a valid number plate on the Front and Back of the vehicle?",
    value: null,
  },
  {
    question: "Is the License Disc Clearly Visible in the windscreen?",
    value: null,
  },
  {
    question: "Is there any signs of leaks under the vehicle prior to start?",
    value: null,
  },
  {
    question:
      "Are the headlights, Taillights, Fog Lights, indicators and hazards functioning correctly?",
    value: null,
  },
  {
    question: "Are the defrosters, heaters and air conditioners functional?",
    value: null,
  },
  {
    question:
      "Is the Emergency Kit within the Vehicle (First Aid Kit, Fire extinguisher, Warning Triangle)?",
    value: null,
  },
  { question: "Is the car interior and Exterior Clean?", value: null },
  {
    question: "Are there any warning Lights present on the Dash at start up?",
    value: null,
  },
  { question: "Are the Windscreen Wipers in working condition?", value: null },
  { question: "Is the Service book within the vehicle?", value: null },
  {
    question:
      "Is there Reflectors, Buggy Whip, Strobe Light and Stop Blocks within the Vehicle?",
    value: null,
  },
];

interface Vehicle {
  id: string;
  vehicleReg: string;
  vehicleVin: string;
}

interface VifFormProps {
  vehicles: Vehicle[];
  formState: {
    selectedVehicleId: string;
    selectedVehicleReg: string;
    odometerValue: string;
    booleanQuestions: typeof booleanQuestions;
    photos: PhotoState[];
  };
  inspectionNumber: number | null;
  recentInspection?: any;
  onVehicleChange: (id: string, reg: string, vin: string) => void;
  onOdometerChange: (value: string) => void;
  onBooleanChange: (index: number, value: boolean) => void;
  // NEW: only onPhotosChange is required; others are optional for backward compat
  onPhotosChange: (photos: PhotoState[]) => void;
  // Optional legacy props (no longer used internally)
  onPhotosAdd?: () => void;
  onPhotoRemove?: (index: number) => void;
  onPhotoRemoveAll?: () => void;
  onPhotoRetry?: (id: string) => void;
}

export default function VifForm({
  vehicles,
  formState,
  inspectionNumber,
  recentInspection,
  onVehicleChange,
  onOdometerChange,
  onBooleanChange,
  onPhotosChange,
  // Legacy props are ignored but kept to avoid breaking existing calls
  onPhotosAdd,
  onPhotoRemove,
  onPhotoRemoveAll,
  onPhotoRetry,
}: VifFormProps) {
  const { theme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = vehicles
    .filter((v) =>
      v.vehicleReg?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => a.vehicleReg?.localeCompare(b.vehicleReg));

  const selectedVehicle = vehicles.find(
    (v) => v.id === formState.selectedVehicleId,
  );

  const canSubmit =
    formState.selectedVehicleId &&
    formState.odometerValue &&
    formState.photos.length > 0 &&
    formState.photos.every((p) => p.status === "success") &&
    !formState.booleanQuestions.some((q) => q.value === null);

  const getPreviousAnswer = (index: number): boolean | null => {
    if (!recentInspection) return null;
    const fieldNames = [
      "oilAndCoolant",
      "fuelLevel",
      "seatbeltDoorsMirrors",
      "handbrake",
      "tyreCondition",
      "spareTyre",
      "numberPlate",
      "licenseDisc",
      "leaks",
      "lights",
      "defrosterAircon",
      "emergencyKit",
      "clean",
      "warnings",
      "windscreenWipers",
      "serviceBook",
      "siteKit",
    ];
    const fieldName = fieldNames[index];
    return fieldName ? (recentInspection[fieldName] ?? null) : null;
  };

  const styles = StyleSheet.create({
    container: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: 16,
      backgroundColor: theme.colors.card,
      gap: 20,
    },
    field: { gap: 6 },
    label: { fontSize: 13, fontWeight: "500", color: theme.colors.text },
    labelMuted: { fontWeight: "400", color: theme.colors.accent },
    selectTrigger: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 11,
      backgroundColor: theme.colors.card,
    },
    selectText: { fontSize: 14, color: theme.colors.text },
    placeholder: { color: theme.colors.textMuted },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 14,
      color: theme.colors.text,
      backgroundColor: theme.colors.card,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "center",
      padding: 24,
    },
    dropdown: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      overflow: "hidden",
      maxHeight: 400,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.text,
      paddingVertical: 0,
    },
    dropdownList: { maxHeight: 320 },
    dropdownItem: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.colors.border,
    },
    dropdownItemActive: { backgroundColor: theme.colors.success + "20" },
    dropdownItemText: { fontSize: 14, color: theme.colors.text },
    dropdownItemTextActive: { color: theme.colors.success, fontWeight: "500" },
    emptyText: {
      padding: 16,
      textAlign: "center",
      color: theme.colors.textMuted,
      fontSize: 13,
    },
    recentBanner: {
      padding: 10,
      backgroundColor: theme.colors.info + "20",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.info + "40",
    },
    recentText: { fontSize: 13, color: theme.colors.info, fontWeight: "500" },
    questionsList: { gap: 8 },
    readinessBanner: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
    },
    readyBanner: {
      backgroundColor: theme.colors.success + "20",
      borderColor: theme.colors.success + "40",
    },
    warningBanner: {
      backgroundColor: theme.colors.warning + "20",
      borderColor: theme.colors.warning + "40",
    },
    readinessText: { fontSize: 13, fontWeight: "500" },
    readyText: { color: theme.colors.success },
    warningText: { color: theme.colors.warning },
  });

  return (
    <View style={styles.container}>
      {/* Vehicle selector */}
      <View style={styles.field}>
        <Text style={styles.label}>Vehicle Registration</Text>
        <TouchableOpacity
          style={styles.selectTrigger}
          onPress={() => setDropdownOpen(true)}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.selectText, !selectedVehicle && styles.placeholder]}
          >
            {selectedVehicle?.vehicleReg ?? "Select a vehicle"}
          </Text>
          <ChevronDown size={16} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Vehicle dropdown modal */}
      <Modal visible={dropdownOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => {
            setDropdownOpen(false);
            setSearchTerm("");
          }}
        >
          <View style={styles.dropdown} onStartShouldSetResponder={() => true}>
            <View style={styles.searchRow}>
              <Search size={15} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search vehicles..."
                placeholderTextColor="#94a3b8"
                value={searchTerm}
                onChangeText={setSearchTerm}
                autoFocus
              />
              {searchTerm ? (
                <TouchableOpacity onPress={() => setSearchTerm("")}>
                  <X size={14} color="#94a3b8" />
                </TouchableOpacity>
              ) : null}
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              style={styles.dropdownList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    item.id === formState.selectedVehicleId &&
                      styles.dropdownItemActive,
                  ]}
                  onPress={() => {
                    onVehicleChange(item.id, item.vehicleReg, item.vehicleVin);
                    setDropdownOpen(false);
                    setSearchTerm("");
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      item.id === formState.selectedVehicleId &&
                        styles.dropdownItemTextActive,
                    ]}
                  >
                    {item.vehicleReg}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No vehicles found</Text>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Photo upload */}
      {formState.selectedVehicleId && (
        <View style={styles.field}>
          <Text style={styles.label}>Upload Inspection Photos</Text>
          <PhotoUpload
            photos={formState.photos}
            onPhotosChange={onPhotosChange}
            vehicleReg={formState.selectedVehicleReg}
            inspectionNumber={inspectionNumber}
          />
        </View>
      )}

      {/* Rest of form — shown after photos */}
      {formState.selectedVehicleId && formState.photos.length > 0 && (
        <>
          {recentInspection && (
            <View style={styles.recentBanner}>
              <Text style={styles.recentText}>
                Last inspection:{" "}
                {new Date(recentInspection.inspectionDate).toLocaleDateString()}
              </Text>
            </View>
          )}

          {/* Odometer */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Odometer Start
              {recentInspection?.odometerStart && (
                <Text style={styles.labelMuted}>
                  {" "}
                  (Last: {recentInspection.odometerStart} km)
                </Text>
              )}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter odometer reading"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={formState.odometerValue}
              onChangeText={onOdometerChange}
            />
          </View>

          {/* Boolean questions */}
          <View style={styles.field}>
            <Text style={styles.label}>Inspection Checklist</Text>
            <View style={styles.questionsList}>
              {formState.booleanQuestions.map((q, i) => (
                <BooleanQuestion
                  key={i}
                  question={q.question}
                  value={q.value}
                  onChange={(val) => onBooleanChange(i, val)}
                  previousAnswer={getPreviousAnswer(i)}
                />
              ))}
            </View>
          </View>

          {/* Readiness banner */}
          <View
            style={[
              styles.readinessBanner,
              canSubmit ? styles.readyBanner : styles.warningBanner,
            ]}
          >
            <Text
              style={[
                styles.readinessText,
                canSubmit ? styles.readyText : styles.warningText,
              ]}
            >
              {canSubmit
                ? "✅ All set! Form is ready for submission."
                : "⚠️ Please complete all fields and ensure all photos are uploaded"}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}
