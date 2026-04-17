import outputs from "@/amplify_outputs.json";
import "@/global.css";
import { AuthProvider, useAuth } from "@/src/contexts/auth-context";
import { ThemeProvider, useTheme } from "@/src/contexts/theme-context";
import { store } from "@/src/store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Animated, Easing, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";

Amplify.configure(outputs);
cognitoUserPoolsTokenProvider.setKeyValueStorage(AsyncStorage);

// Hold the splash screen before anything renders
SplashScreen.preventAutoHideAsync();

function LayoutInner() {
  const { theme, isReady: themeReady } = useTheme();
  const { isLoading: authLoading } = useAuth();
  const [fontsLoaded] = useFonts({
    "sans-regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "sans-bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "sans-medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    "sans-semibold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    "sans-extrabold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
    "sans-light": require("../assets/fonts/PlusJakartaSans-Light.ttf"),
  });

  // --- All hooks must be called unconditionally ---
  const prevBgRef = React.useRef(theme.colors.background);
  const [overlayBg, setOverlayBg] = React.useState(theme.colors.background);
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;

  // Background transition effect
  useEffect(() => {
    const newBg = theme.colors.background;
    const oldBg = prevBgRef.current;
    if (oldBg !== newBg) {
      setOverlayBg(oldBg);
      overlayOpacity.setValue(1);
      const anim = Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      });
      anim.start();
      prevBgRef.current = newBg;
      return () => anim.stop();
    }
  }, [theme.colors.background, overlayOpacity]);

  // --- Readiness condition ---
  const isReady = fontsLoaded && themeReady && !authLoading;

  // Hide splash only when everything is ready
  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  // --- Early return (after all hooks) while not ready ---
  if (!isReady) {
    return null; // Native splash remains visible, no React content
  }

  // --- Full app UI (only when ready) ---
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar
        style={theme.name === "light" ? "dark" : "light"}
        backgroundColor={theme.colors.background}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: overlayBg,
          opacity: overlayOpacity,
        }}
      />
    </View>
  );
}

export default function Rootlayout() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <LayoutInner />
          </AuthProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </Provider>
  );
}
