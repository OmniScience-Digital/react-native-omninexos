// app/(auth)/_layout.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, Stack } from "expo-router";
import { useEffect, useState } from "react";

const DUMMY_TOKEN_KEY = "dummy_token";

export default function AuthLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const checkToken = async () => {
      const token = await AsyncStorage.getItem(DUMMY_TOKEN_KEY);
      setHasToken(!!token);
      setIsLoading(false);
    };
    checkToken();
  }, []);

  if (isLoading) return null; // or a simple spinner

  if (hasToken) {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
