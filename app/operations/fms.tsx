//operations / fms.tsx;
import FleetDetailScreen from "@/components/fms/FleetDetailScreen";
import FleetListScreen from "@/components/fms/FleetListScreen";
import InspectionDetailScreen from "@/components/fms/InspectionDetailScreen";
import { NonTabScreen } from "@/components/ui/non-tab-screen";
import { useTheme } from "@/src/contexts/theme-context";
import { useState } from "react";
import { StatusBar } from "react-native";

export default function FleetManagementScreen() {
  const { theme } = useTheme();
  const [screen, setScreen] = useState<"list" | "detail" | "inspection">(
    "list",
  );
  const [selectedFleet, setSelectedFleet] = useState<Fleet | null>(null);
  const [selectedInspection, setSelectedInspection] =
    useState<Inspection | null>(null);

  return (
    <NonTabScreen
      title="Fleet Management"
      subtitle="Manage your fleet"
      showBack
      scrollable={false}
    >
      <StatusBar
        barStyle={theme.name === "dark" ? "light-content" : "dark-content"}
        backgroundColor={theme.colors.background}
      />
      {screen === "list" && (
        <FleetListScreen
          onSelectFleet={(fleet) => {
            setSelectedFleet(fleet);
            setScreen("detail");
          }}
        />
      )}
      {screen === "detail" && selectedFleet && (
        <FleetDetailScreen
          fleet={selectedFleet}
          onBack={() => setScreen("list")}
          onSelectInspection={(insp) => {
            setSelectedInspection(insp);
            setScreen("inspection");
          }}
        />
      )}
      {screen === "inspection" && selectedInspection && selectedFleet && (
        <InspectionDetailScreen
          inspection={selectedInspection}
          fleetReg={selectedFleet.vehicleReg || undefined}
          onBack={() => setScreen("detail")}
        />
      )}
    </NonTabScreen>
  );
}
