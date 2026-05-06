// src/screens/InspectionDetailScreen.tsx
import { ThemedText } from "@/components/screens/screen";
import { useS3Urls } from "@/hooks/useS3Urls";
import { useTheme } from "@/src/contexts/theme-context";
import {
    ArrowLeft,
    Check,
    ClipboardList,
    X,
    XCircle,
} from "lucide-react-native";
import { useState } from "react";
import {
    Dimensions,
    FlatList,
    Image,
    Modal,
    ScrollView,
    TouchableOpacity,
    View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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

const passCount = (insp: Inspection) =>
  CHECKLIST_ITEMS.filter((i) => insp[i.key] === true).length;

export default function InspectionDetailScreen({
  inspection,
  fleetReg,
  onBack,
}: {
  inspection: Inspection;
  fleetReg?: string;
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const photoUrls = useS3Urls(inspection.photo);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const total = CHECKLIST_ITEMS.length;
  const passed = passCount(inspection);
  const passPercent = (passed / total) * 100;
  const isPass = passPercent >= 80;

  const openImageModal = (index: number) => {
    setSelectedImageIndex(index);
    setImageModalVisible(true);
  };

  return (
    <>
      {/* Header - same as before */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 12,
          backgroundColor: theme.colors.card,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity onPress={onBack} style={{ padding: 4 }}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <ClipboardList size={18} color={theme.colors.primary} />
          <ThemedText style={{ fontSize: 15, fontWeight: "600" }}>
            Inspection #{inspection.inspectionNo}
          </ThemedText>
        </View>
        <ThemedText
          style={{
            paddingHorizontal: 9,
            paddingVertical: 3,
            borderRadius: 99,
            overflow: "hidden",
            fontSize: 11,
            fontWeight: "700",
            backgroundColor: isPass
              ? theme.colors.success + "20"
              : theme.colors.warning + "20",
            color: isPass ? theme.colors.success : theme.colors.warning,
          }}
        >
          {isPass ? "Pass" : "Fail"} {Math.round(passPercent)}%
        </ThemedText>
      </View>

      <ScrollView style={{ padding: 16 }}>
        {/* Summary Card */}
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
            marginBottom: 12,
          }}
        >
          <View style={{ padding: 12 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <View
                style={{
                  flex: 1,
                  minWidth: "45%",
                  backgroundColor: theme.colors.card,
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <ThemedText
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: theme.colors.textMuted,
                  }}
                >
                  Vehicle
                </ThemedText>
                <ThemedText style={{ fontSize: 14, fontWeight: "700" }}>
                  {fleetReg}
                </ThemedText>
              </View>
              <View
                style={{
                  flex: 1,
                  minWidth: "45%",
                  backgroundColor: theme.colors.card,
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <ThemedText
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: theme.colors.textMuted,
                  }}
                >
                  Date
                </ThemedText>
                <ThemedText style={{ fontSize: 14, fontWeight: "700" }}>
                  {inspection.inspectionDate}
                </ThemedText>
              </View>
              <View
                style={{
                  flex: 1,
                  minWidth: "45%",
                  backgroundColor: theme.colors.card,
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <ThemedText
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: theme.colors.textMuted,
                  }}
                >
                  Inspector
                </ThemedText>
                <ThemedText style={{ fontSize: 14, fontWeight: "700" }}>
                  {inspection.inspectorOrDriver}
                </ThemedText>
              </View>
              <View
                style={{
                  flex: 1,
                  minWidth: "45%",
                  backgroundColor: theme.colors.card,
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <ThemedText
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: theme.colors.textMuted,
                  }}
                >
                  Odometer
                </ThemedText>
                <ThemedText style={{ fontSize: 14, fontWeight: "700" }}>
                  {inspection.odometerStart?.toLocaleString()} km
                </ThemedText>
              </View>
            </View>

            {/* Score Bar */}
            <View style={{ marginTop: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <ThemedText
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: theme.colors.textMuted,
                  }}
                >
                  SCORE
                </ThemedText>
                <ThemedText
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color: isPass ? theme.colors.success : theme.colors.warning,
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
                  marginTop: 6,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${(passed / total) * 100}%`,
                    backgroundColor: isPass
                      ? theme.colors.success
                      : theme.colors.warning,
                    borderRadius: 99,
                  }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* ========== IMAGE GALLERY SECTION ========== */}
        {photoUrls.length > 0 && (
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.colors.border,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                padding: 14,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <ThemedText
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: theme.colors.textMuted,
                }}
              >
                INSPECTION PHOTOS ({photoUrls.length})
              </ThemedText>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ padding: 12 }}
            >
              <View style={{ flexDirection: "row", gap: 12 }}>
                {photoUrls.map((uri, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => openImageModal(idx)}
                  >
                    <Image
                      source={{ uri }}
                      style={{
                        width: 120,
                        height: 120,
                        borderRadius: 12,
                        backgroundColor: theme.colors.border,
                      }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Checklist */}
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
            marginBottom: 12,
          }}
        >
          <View
            style={{
              padding: 14,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}
          >
            <ThemedText
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: theme.colors.textMuted,
              }}
            >
              CHECKLIST
            </ThemedText>
          </View>
          <View
            style={{
              padding: 12,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {CHECKLIST_ITEMS.map((item) => {
              const val = inspection[item.key] === true;
              return (
                <View
                  key={item.key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    padding: 8,
                    borderRadius: 10,
                    backgroundColor: theme.colors.card,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    width: "48%",
                  }}
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
                    style={{
                      fontSize: 12,
                      color: val
                        ? theme.colors.textMuted
                        : theme.colors.warning,
                    }}
                  >
                    {item.label}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </View>

        {/* Notes */}
        {inspection.history && (
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.colors.border,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                padding: 14,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <ThemedText
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: theme.colors.textMuted,
                }}
              >
                NOTES
              </ThemedText>
            </View>
            <View style={{ padding: 12 }}>
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
      </ScrollView>

      {/* Fullscreen Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: "black" }}>
          <TouchableOpacity
            style={{ position: "absolute", top: 50, right: 20, zIndex: 1 }}
            onPress={() => setImageModalVisible(false)}
          >
            <XCircle size={32} color="white" />
          </TouchableOpacity>
          <FlatList
            data={photoUrls}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={selectedImageIndex}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item }}
                style={{ width: SCREEN_WIDTH, height: "100%" }}
                resizeMode="contain"
              />
            )}
            keyExtractor={(_, index) => String(index)}
          />
        </View>
      </Modal>
    </>
  );
}
