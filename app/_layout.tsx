// app/_layout.tsx
import outputs from "@/amplify_outputs.json";
import logodark from "@/assets/images/icon.png";
import logo from "@/assets/images/logo_dark.png";
import ResponseModal from "@/components/stockcontrolComponents/responsemodal";
import "@/global.css";
import { AuthProvider, useAuth } from "@/src/contexts/auth-context";
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
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Easing, Image, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

Amplify.configure(outputs);
cognitoUserPoolsTokenProvider.setKeyValueStorage(AsyncStorage);

SplashScreen.preventAutoHideAsync();
WebBrowser.maybeCompleteAuthSession();
// Inner component that has access to Redux and theme
function LayoutInner() {
  const { theme, isReady: themeReady } = useTheme();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
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

  // ✅ 1. Hide splash as soon as fonts & theme are ready (DON'T wait for auth)
  const [splashHidden, setSplashHidden] = useState(false);

  useEffect(() => {
    if (fontsLoaded && themeReady && !splashHidden) {
      const timer = setTimeout(async () => {
        await SplashScreen.hideAsync();
        setSplashHidden(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded, themeReady, splashHidden]);

  // useEffect(() => {
  //   if (fontsLoaded && themeReady && !authLoading && !splashHidden) {
  //     const timer = setTimeout(async () => {
  //       await SplashScreen.hideAsync();
  //       setSplashHidden(true);
  //     }, 50);
  //     return () => clearTimeout(timer);
  //   }
  // }, [fontsLoaded, themeReady, authLoading, splashHidden]);

  // ✅ 2. Single source of truth for auth routing
  useEffect(() => {
    if (authLoading) return; // Wait until auth resolves

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      // User is not logged in and trying to access app screens
      router.replace("/(auth)/sign-in");
    } else if (isAuthenticated && inAuthGroup) {
      // User is logged in but somehow on login screen
      router.replace("/(tabs)");
    }
  }, [authLoading, isAuthenticated, segments]);

  // Theme transition overlay (kept as is)
  const prevBgRef = React.useRef(theme.colors.background);
  const [overlayBg, setOverlayBg] = React.useState(theme.colors.background);
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;

  // ✅ 3. Show themed loading screen while fonts/theme/auth load
  const isUIReady = fontsLoaded && themeReady;

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

  // useEffect(() => {
  //   const newBg = theme.colors.background;
  //   const oldBg = prevBgRef.current;
  //   if (oldBg !== newBg) {
  //     setOverlayBg(oldBg);
  //     overlayOpacity.setValue(1);
  //     const anim = Animated.timing(overlayOpacity, {
  //       toValue: 0,
  //       duration: 380,
  //       easing: Easing.out(Easing.ease),
  //       useNativeDriver: true,
  //     });
  //     // Only start if UI is ready (overlay is mounted)
  //     if (isUIReady && splashHidden) {
  //       anim.start();
  //     }
  //     prevBgRef.current = newBg;
  //     return () => anim.stop();
  //   }
  // }, [theme.colors.background, overlayOpacity, isUIReady, splashHidden]);

  if (!isUIReady || !splashHidden || authLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        <View
          style={{
            width: 120,
            height: 100,
            borderRadius: 20,
            backgroundColor: theme.colors.accent,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <Image
            source={theme.name === "light" ? logodark : logo}
            style={{ width: 90, height: 100 }}
            resizeMode="contain"
          />
        </View>

        <ActivityIndicator
          size="large"
          color={theme.colors.accent}
          style={{ marginTop: 90 }}
        />
      </View>
    );
  }

  //  4. Auth is resolved — render the router.
  //    useEffect above already handled any needed redirects.
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
          animation: "fade",
        }}
      />
      {/* Theme transition overlay (on top of everything except modal) */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: overlayBg,
          opacity: overlayOpacity,
        }}
      />

      {/* ✅ Global Response Modal – appears above everything */}
      <ResponseModal
        visible={responseModal.visible}
        successful={responseModal.successful}
        message={responseModal.message}
        onClose={() => dispatch(hideResponseModal())}
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
