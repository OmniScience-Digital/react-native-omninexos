// components/CustomScrollView.tsx
import { ScrollView, ScrollViewProps } from "react-native";

export const CustomScrollView = ({
  children,
  showsVerticalScrollIndicator = false,
  contentContainerClassName = "pb-30",
  ...props
}: ScrollViewProps & { contentContainerClassName?: string }) => {
  return (
    <ScrollView
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      contentContainerClassName={contentContainerClassName}
      {...props}
    >
      {children}
    </ScrollView>
  );
};
