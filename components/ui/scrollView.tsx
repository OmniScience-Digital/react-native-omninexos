// components/CustomScrollView.tsx
import { ScrollView, ScrollViewProps } from "react-native";

export const CustomScrollView = ({
  children,
  keyboardDismissMode = "on-drag",
  showsVerticalScrollIndicator = false,
  contentContainerClassName = "pb-35",
  ...props
}: Omit<ScrollViewProps, "refreshControl"> & {
  contentContainerClassName?: string;
}) => {
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
