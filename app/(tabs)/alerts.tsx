import { Screen } from "@/components/screens/screen";
import { CustomHeader } from "@/components/ui/customHeader";
import { useTabBar } from "@/src/contexts/tabbar-context";

export default function Alerts() {
  const { onScroll } = useTabBar();
  return (
    <Screen scrollable onScroll={onScroll}>
      <CustomHeader
        title="Alerts"
        subtitle="Stay updated with your latest alerts"
      />
    </Screen>
  );
}
