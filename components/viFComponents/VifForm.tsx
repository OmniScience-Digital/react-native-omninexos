// components/viFComponents/VifForm.tsx
import { useTheme } from "@/src/contexts/theme-context";
import { setBooleanAnswer, setOdometer, setSelectedVehicle } from "@/src/state";
import { useAppDispatch, useAppSelector } from "@/src/state/redux";
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
import { ThemedText } from "../ui/screen";
import BooleanQuestion from "./BooleanQuestion";
import PhotoUpload from "./PhotoUpload";

interface Vehicle {
  id: string;
  vehicleReg: string;
  vehicleVin: string;
}

interface VifFormProps {
  vehicles: Vehicle[];
  inspectionNumber: number | null;
  recentInspection?: any;
}

export default function VifForm({
  vehicles = [],
  inspectionNumber,
  recentInspection,
}: VifFormProps) {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const formState = useAppSelector((state) => state.global.vifForm);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = vehicles.filter((v) =>
    v.vehicleReg?.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const selectedVehicle = vehicles.find(
    (v) => v.id === formState.selectedVehicleId,
  );

  const getPreviousAnswer = (index: number) => {
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
    return fieldNames[index] ? recentInspection[fieldNames[index]] : null;
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
  });

  return (
    <View style={styles.container}>
      {/* Vehicle selector */}
      <View style={styles.field}>
        <Text style={styles.label}>Vehicle Registration</Text>
        <TouchableOpacity
          style={styles.selectTrigger}
          onPress={() => setDropdownOpen(true)}
        >
          <Text
            style={[styles.selectText, !selectedVehicle && styles.placeholder]}
          >
            {selectedVehicle?.vehicleReg ?? "Select a vehicle"}
          </Text>
          <ChevronDown size={16} color="#64748b" />
        </TouchableOpacity>
      </View>

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
                    dispatch(
                      setSelectedVehicle({
                        id: item.id,
                        reg: item.vehicleReg,
                        vin: item.vehicleVin,
                      }),
                    );
                    setDropdownOpen(false);
                    setSearchTerm("");
                  }}
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

      {/* Everything below shows once a vehicle is selected */}
      {formState.selectedVehicleId && (
        <>
          {/* Photo upload */}
          <View style={styles.field}>
            <Text style={styles.label}>Upload Inspection Photos</Text>
            <PhotoUpload
              vehicleReg={formState.selectedVehicleReg}
              inspectionNumber={inspectionNumber}
            />
          </View>

          {/* Recent inspection banner */}
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
              Odometer Start{" "}
              {recentInspection?.odometerStart && (
                <ThemedText muted>
                  (Last: {recentInspection.odometerStart} km)
                </ThemedText>
              )}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter odometer reading"
              keyboardType="numeric"
              value={formState.odometerValue}
              onChangeText={(val) => dispatch(setOdometer(val))}
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          {/* Checklist — always visible, no photo gate */}
          <View style={styles.field}>
            <Text style={styles.label}>Inspection Checklist</Text>
            <View style={styles.questionsList}>
              {formState.booleanQuestions.map((q, i) => (
                <BooleanQuestion
                  key={i}
                  question={q.question}
                  value={q.value}
                  onChange={(val) =>
                    dispatch(setBooleanAnswer({ index: i, value: val }))
                  }
                  previousAnswer={getPreviousAnswer(i)}
                />
              ))}
            </View>
          </View>

          {/* Readiness banner removed —
              submit button enabled/disabled state is sufficient feedback */}
        </>
      )}
    </View>
  );
}
