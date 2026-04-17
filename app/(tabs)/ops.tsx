import { CustomHeader } from "@/components/ui/customHeader";
import { ModuleCard } from "@/components/ui/DashboardCards";
import { Screen } from "@/components/ui/screen";
import { TabOperations } from "@/src/dashboardLists";
import { View } from "react-native";

export default function Operations() {
  const InventoryPress = () => alert("Inventory Management Coming Soon");
  const FleetPress = () => alert("Fleet Management Coming Soon");

  return (
    <Screen>
      {/* Modules */}
      <View className="mb-1">
        {/* Custom Header without back button */}
        <CustomHeader title="Operations" subtitle="Manage your operations" />

        {TabOperations.map((op) => (
          <ModuleCard
            key={op.name}
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
