import { Stack } from "expo-router";

export default function FormsStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="stockcontrolform" />
      <Stack.Screen name="vehicle-inspection" />
    </Stack>
  );
}
