// app/_layout.tsx
import ResponseModal from "@/components/responsemodal";
import { UpdateBanner } from "@/components/ui/update-banner";
import "@/global.css";

import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { useJobCardNotificationLinks } from "@/hooks/useJobCardNotificationLinks"; // JOBCARDS
import { useJobCardSync } from "@/hooks/useJobCardSync"; // JOBCARDS // SIDEMENU
import { warmDbConnection } from "@/services/submissionQueue";
import { AuthProvider, useAuth } from "@/src/contexts/auth-context";
import { NotificationProvider } from "@/src/contexts/notification-context";
import { SideMenuProvider } from "@/src/contexts/sidemenu-context";
import { ThemeProvider, useTheme } from "@/src/contexts/theme-context";
import {
  registerJobCardBackgroundSync,
  unregisterJobCardBackgroundSync,
} from "@/src/jobcards/background";
import { initMonitoring } from "@/src/monitoring/sentry";
import { applyPendingUpdate, checkForUpdate } from "@/src/services/appUpdates";
import { hideResponseModal } from "@/src/state";
import StoreProvider, {
  useAppDispatch,
  useAppSelector,
} from "@/src/state/redux";
import { useFonts } from "expo-font";
import * as NavigationBar from "expo-navigation-bar";
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
  BackHandler,
  Easing,
  Keyboard,
  Platform,
  ToastAndroid,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

initMonitoring();

// Amplify is configured once in src/amplify.ts — do NOT call configure() again
// here or the generated client and the auth provider end up with split state. The Cognito token storage is set
// there too, so a headless background wake (see index.js) finds the session.

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
  // JOBCARDS: keep job cards in step with the server in the background, and open work items from push taps
  const jobCardUser =
    isAuthenticated && (user?.sub || user?.username)
      ? {
          sub: (user.sub || user.username) as string,
          // The person's real name is saved as preferred_username (the sign-up form sets it; Google sign-in only has
          // name). Email is the last resort, so a result never says "by <email>" when a name exists.
          name:
            (user as any).preferred_username || user.name || user.email || "",
          email: user.email || undefined,
        }
      : null;
  useJobCardSync(jobCardUser);
  useJobCardNotificationLinks(!!jobCardUser);

  // JOBCARDS: register the OS background task so results still go out when the app is backgrounded (not force-quit).
  // Android: WorkManager (minimum 15 min). iOS: BGTaskScheduler (OS decides when).
  useEffect(() => {
    if (jobCardUser) void registerJobCardBackgroundSync();
    else void unregisterJobCardBackgroundSync();
    // jobCardUser is recreated on every render; keying on sub is what actually matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobCardUser?.sub]);

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

  // Immersive mode (Android): hide the system navigation bar (back/home/recents).
  // A swipe up from the bottom edge reveals it temporarily; the system hides it
  // again on its own. Re-applied on resume and after the keyboard closes, which
  // can bring the bar back.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const hideNavBar = () => {
      NavigationBar.setVisibilityAsync("hidden").catch(() => {});
    };
    hideNavBar();
    const appSub = AppState.addEventListener("change", (next) => {
      if (next === "active") hideNavBar();
    });
    const kbSub = Keyboard.addListener("keyboardDidHide", hideNavBar);
    return () => {
      appSub.remove();
      kbSub.remove();
    };
  }, []);

  // On foreground resume, re-validate (and repair if needed) the offline-queue
  // database so it is ready before the user taps "Save Offline". This used to
  // close the connection on every resume, which could break a connection that
  // was still in use.
  //
  // Also checks for an OTA update on the same foreground transition — one
  // listener covering both, rather than a second AppState subscription. Never
  // blocking: a found update just shows the banner below; the user decides
  // when (or whether) to restart onto it.
  const [updateReady, setUpdateReady] = useState(false);
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        warmDbConnection();
        checkForUpdate().then((r) => {
          if (r.status === "fetched") setUpdateReady(true);
        });
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  // Same check on cold launch, once splash/fonts/theme are ready — no point
  // checking while still showing the splash screen.
  useEffect(() => {
    if (!fontsLoaded || !themeReady) return;
    checkForUpdate().then((r) => {
      if (r.status === "fetched") setUpdateReady(true);
    });
  }, [fontsLoaded, themeReady]);

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

  // Android hardware back: when there's nothing left to pop (a root tab),
  // require a second press within 2s to exit instead of silently backing
  // out of the app. No-op on iOS (no hardware back button there).
  const lastBackPress = useRef(0);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (router.canGoBack()) return false; // let the normal back happen

      const now = Date.now();
      if (now - lastBackPress.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPress.current = now;
      ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
      return true; // swallow this first press
    });
    return () => sub.remove();
  }, [router]);

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
  }, [authLoading, isAuthenticated, isOfflineAuth, segments, router]);

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
        {updateReady && (
          <UpdateBanner
            onRestart={() => applyPendingUpdate()}
            onDismiss={() => setUpdateReady(false)}
          />
        )}
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
    <ErrorBoundary>
      <StoreProvider>
        <ThemeProvider>
          <SafeAreaProvider>
            <AuthProvider>
              {/* SIDEMENU: the menu is drawn above every screen */}
              <SideMenuProvider>
                <LayoutInner />
              </SideMenuProvider>
            </AuthProvider>
          </SafeAreaProvider>
        </ThemeProvider>
      </StoreProvider>
    </ErrorBoundary>
  );
}
