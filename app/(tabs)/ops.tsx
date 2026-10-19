// app/(tabs)/ops.tsx  (MODIFIED - search "JOBCARDS" for the additions)
import { Screen } from "@/components/screens/screen";
import { CustomHeader } from "@/components/ui/customHeader";
import { ModuleCard } from "@/components/ui/DashboardCards";
import { useTabBar } from "@/src/contexts/tabbar-context";
import { TabOperations } from "@/src/dashboardLists";
import { router, type Href } from "expo-router";
import { View } from "react-native";

// Which screen each module opens
const MODULE_ROUTES: Record<string, Href> = {
  "Fleet Management System": "/operations/fms",
  "Inventory Management System": "/operations/ims",
  "Job Cards": "/operations/jobcards", // JOBCARDS
};

export default function Operations() {
  const { onScroll } = useTabBar();

  return (
    <Screen scrollable onScroll={onScroll}>
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
            onPress={() =>
              router.push(MODULE_ROUTES[op.name] ?? "/operations/ims")
            }
          />
        ))}
      </View>
    </Screen>
  );
}
