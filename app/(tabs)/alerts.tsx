import { CustomHeader } from "@/components/ui/customHeader";
import { Screen, ThemedText } from "@/components/ui/screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useListFleetsQuery } from "@/src/state/api";
import { ActivityIndicator, View } from "react-native";

export default function Alerts() {
  // const { data: categories, isLoading, isError } = useListCategoriesQuery();
  // // ── 1. Fetch all vehicles ─────────────────────────────────────────────────────
  const { data: vehicles = [], isLoading, isError } = useListFleetsQuery();

  return (
    <Screen>
      <CustomHeader
        title="Alerts"
        subtitle="Stay updated with your latest alerts"
      />
      {isLoading && <ActivityIndicator />}
      {isError && <ThemedText>Something went wrong.</ThemedText>}
      {!isLoading && !isError && (
        <CustomScrollView>
          {vehicles?.map((item) => (
            <View key={item.id}>
              <ThemedText>{item.vehicleReg}</ThemedText>
              <ThemedText>{item.vehicleModel}</ThemedText>
            </View>
          ))}
        </CustomScrollView>
      )}
    </Screen>
  );
}
