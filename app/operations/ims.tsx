// operations/ims.tsx
import IMSCategoryListScreen from "@/components/ims/IMSCategoryListScreen";
import IMSSubcategoryScreen from "@/components/ims/IMSSubcategoryScreen";
import { useState } from "react";

export default function IMSScreen() {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );

  if (selectedCategory) {
    return (
      <IMSSubcategoryScreen
        category={selectedCategory}
        onBack={() => setSelectedCategory(null)}
      />
    );
  }
  return <IMSCategoryListScreen onSelectCategory={setSelectedCategory} />;
}
