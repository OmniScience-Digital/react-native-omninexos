import { CustomHeader } from "@/components/ui/customHeader";
import { Screen, ThemedText } from "@/components/ui/screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useListCategoriesQuery } from "@/src/store/categoriesApi";
import { ActivityIndicator, View } from "react-native";

export default function Alerts() {
  const { data: categories, isLoading, isError } = useListCategoriesQuery();

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
          {categories?.map((item) => (
            <View key={item.id}>
              <ThemedText>{item.categoryName}</ThemedText>
            </View>
          ))}
        </CustomScrollView>
      )}
    </Screen>
  );
}
