import outputs from "@/amplify_outputs.json";
import "@/global.css";
import { AuthProvider, useAuth } from "@/src/contexts/auth-context";
import { ThemeProvider, useTheme } from "@/src/contexts/theme-context";
import StoreProvider from "@/src/state/redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Easing, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

Amplify.configure(outputs);
cognitoUserPoolsTokenProvider.setKeyValueStorage(AsyncStorage);

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

  // ── Theme transition overlay ──────────────────────────────────────────────
  const prevBgRef = React.useRef(theme.colors.background);
  const [overlayBg, setOverlayBg] = React.useState(theme.colors.background);
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;

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

  // ── Splash hide ───────────────────────────────────────────────────────────
  const isReady = fontsLoaded && themeReady && !authLoading;

  // Track whether splash has been hidden so we don't flash
  const [splashHidden, setSplashHidden] = useState(false);

  useEffect(() => {
    if (isReady && !splashHidden) {
      // Small delay ensures the first React frame is painted BEFORE
      // the splash disappears — eliminates the white gap entirely.
      const timer = setTimeout(async () => {
        await SplashScreen.hideAsync();
        setSplashHidden(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isReady, splashHidden]);

  // ── While not ready: render a solid background that matches the theme ─────
  // NEVER return null — that exposes the default white window background.
  if (!isReady || !splashHidden) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  // ── Full app ──────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar
        style={theme.name === "light" ? "dark" : "light"}
        backgroundColor={theme.colors.background}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          // Match the background so screen transitions don't flash white
          contentStyle: { backgroundColor: theme.colors.background },
          // Disable the default white background on the animation container
          animation: "fade",
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

export default function RootLayout() {
  return (
    <StoreProvider>
      <ThemeProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <LayoutInner />
          </AuthProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </StoreProvider>
  );
}
