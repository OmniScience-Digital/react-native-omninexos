// app/_layout.tsx
import outputs from "@/amplify_outputs.json";
import ResponseModal from "@/components/responsemodal";
import "@/global.css";

import { resetDbConnection } from "@/services/submissionQueue";
import { AuthProvider, useAuth } from "@/src/contexts/auth-context";
import { NotificationProvider } from "@/src/contexts/notification-context";
import { ThemeProvider, useTheme } from "@/src/contexts/theme-context";
import { hideResponseModal } from "@/src/state";
import StoreProvider, {
  useAppDispatch,
  useAppSelector,
} from "@/src/state/redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  AppStateStatus,
  Easing,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

Amplify.configure(outputs);
cognitoUserPoolsTokenProvider.setKeyValueStorage(AsyncStorage);

SplashScreen.preventAutoHideAsync();
WebBrowser.maybeCompleteAuthSession();

function LayoutInner() {
  const { theme, isReady: themeReady } = useTheme();
  const {
    isLoading: authLoading,
    isAuthenticated,
    isOfflineAuth,
    user,
  } = useAuth();
  const userId = (user as any)?.email ?? (user as any)?.username ?? "anonymous";
  const segments = useSegments();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const responseModal = useAppSelector((state) => state.global.responseModal);

  const [fontsLoaded] = useFonts({
    "sans-regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "sans-bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "sans-medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    "sans-semibold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    "sans-extrabold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
    "sans-light": require("../assets/fonts/PlusJakartaSans-Light.ttf"),
  });

  // Reset SQLite on foreground resume (Android NullPointerException fix)
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        resetDbConnection();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  // Hide splash once fonts + theme ready
  const [splashHidden, setSplashHidden] = useState(false);
  useEffect(() => {
    if (fontsLoaded && themeReady && !splashHidden) {
      const t = setTimeout(async () => {
        await SplashScreen.hideAsync();
        setSplashHidden(true);
      }, 50);
      return () => clearTimeout(t);
    }
  }, [fontsLoaded, themeReady, splashHidden]);

  // ── Auth routing ──────────────────────────────────────────────────────────
  // Only redirect to sign-in when we are CERTAIN the user is not authenticated.
  // isOfflineAuth=true means we have a cached session — treat as logged in.
  useEffect(() => {
    if (authLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [authLoading, isAuthenticated, segments]);

  // Theme transition overlay
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

  if (!fontsLoaded || !themeReady || !splashHidden || authLoading) {
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

  return (
    <NotificationProvider userId={isAuthenticated ? userId : "anonymous"}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar
          style={theme.name === "light" ? "dark" : "light"}
          backgroundColor={theme.colors.background}
        />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
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
        <ResponseModal
          visible={responseModal.visible}
          successful={responseModal.successful}
          message={responseModal.message}
          onClose={() => dispatch(hideResponseModal())}
        />
      </View>
    </NotificationProvider>
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
