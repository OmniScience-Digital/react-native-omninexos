import { Screen } from "@/components/screens/screen";
import { CustomHeader } from "@/components/ui/customHeader";
import { ModuleCard } from "@/components/ui/DashboardCards";
import { useTabBar } from "@/src/contexts/tabbar-context";
import { Tabforms } from "@/src/dashboardLists";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback } from "react";

export default function Forms() {
  const { onScroll } = useTabBar();
  const { resetScrollY } = useTabBar();

  useFocusEffect(
    useCallback(() => {
      resetScrollY();
    }, [resetScrollY]),
  );

  const handleStockformPress = () => {
    router.push("./forms/stockcontrolform");
  };
  const handleVehicleInspectionPress = () => {
    router.push("./forms/vehicle-inspection");
  };

  return (
    <Screen scrollable onScroll={onScroll}>
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
