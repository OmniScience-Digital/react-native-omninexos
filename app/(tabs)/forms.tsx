import { ModuleCard } from "@/components/ui/DashboardCards";
import { Screen, ThemedText } from "@/components/ui/screen";
import { Tabforms } from "@/src/dashboardLists";
import { View } from "react-native";

export default function Forms() {
  const handleStockformPress = () => alert("Stock Coming Soon");
  const handleVehicleInspectionPress = () =>
    alert("Vehicle Inspection Coming Soon");

  return (
    <Screen>
      {/* Modules */}
      <View className="mb-1">
        <ThemedText variant="h2" weight="600" style={{ marginBottom: "5" }}>
          Forms
        </ThemedText>

        {Tabforms.map((form) => (
          <ModuleCard
            title={form.name}
            description={form.title}
            icon={form.icon}
            onPress={
              form.name === "Stock Control Form"
                ? handleStockformPress
                : handleVehicleInspectionPress
            }
          />
        ))}
      </View>
    </Screen>
  );
}
