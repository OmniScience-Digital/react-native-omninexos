// import { Screen, ThemedText } from "@/components/ui/screen";

// export default function Alerts() {
//   return (
//     <Screen>
//       <ThemedText variant="small">Alerts</ThemedText>
//     </Screen>
//   );
// }

import { Screen, ThemedText } from "@/components/ui/screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useListCategoriesQuery } from "@/src/store/categoriesApi";
import { ActivityIndicator, Text, View } from "react-native";

export default function Alerts() {
  const { data: categories, isLoading, isError } = useListCategoriesQuery();

  if (isLoading) return <ActivityIndicator />;
  if (isError) return <Text>Something went wrong.</Text>;
  console.log(categories);

  return (
    <Screen>
      <CustomScrollView>
        {categories?.map((item) => (
          <View key={item.id}>
            <ThemedText>{item.categoryName}</ThemedText>
          </View>
        ))}
      </CustomScrollView>
    </Screen>
  );
}
