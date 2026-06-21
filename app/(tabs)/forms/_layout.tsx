import { useTabBar } from "@/src/contexts/tabbar-context";
import { Stack } from "expo-router";
import { useEffect } from "react";

export default function FormsStack() {
  const { resetScrollY } = useTabBar();

  useEffect(() => {
    resetScrollY(); //shows tab bar resets the height from home screen
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="stockcontrolform" />
      <Stack.Screen name="vehicle-inspection" />
    </Stack>
  );
}
