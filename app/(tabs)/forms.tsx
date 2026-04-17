import { CustomHeader } from "@/components/ui/customHeader";
import { ModuleCard } from "@/components/ui/DashboardCards";
import { Screen } from "@/components/ui/screen";
import { Tabforms } from "@/src/dashboardLists";
import { router } from "expo-router";

export default function Forms() {
  const handleStockformPress = () => {
    router.push("/forms/stockcontrolform");
  };
  const handleVehicleInspectionPress = () => {
    router.push("/forms/vehicle-inspection");
  };

  return (
    <Screen>
      {/* Custom Header without back button */}
      <CustomHeader title="Forms" subtitle="Select a form to fill out" />
      {/* Modules */}

      {Tabforms.map((form) => (
        <ModuleCard
          key={form.name}
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
    </Screen>
  );
}
