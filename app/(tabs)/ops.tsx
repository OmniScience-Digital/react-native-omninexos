import { ModuleCard } from "@/components/ui/DashboardCards";
import { Screen, ThemedText } from "@/components/ui/screen";
import { TabOperations } from "@/src/dashboardLists";
import { View } from "react-native";

export default function Operations() {
  const InventoryPress = () => alert("Inventory Management Coming Soon");
  const FleetPress = () => alert("Fleet Management Coming Soon");

  return (
    <Screen>
      {/* Modules */}
      <View className="mb-1">
        <ThemedText variant="h2" weight="600" style={{ marginBottom: "5" }}>
          Operations
        </ThemedText>

        {TabOperations.map((op) => (
          <ModuleCard
            title={op.name}
            description={op.title}
            icon={op.icon}
            onPress={
              op.name === "Fleet Management System"
                ? FleetPress
                : InventoryPress
            }
          />
        ))}
      </View>
    </Screen>
  );
}
