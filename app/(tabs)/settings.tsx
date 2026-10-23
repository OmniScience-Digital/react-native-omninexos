// app/(tabs)/settings.tsx
import {
  AppCard,
  getCardStyle,
  SectionHeader,
} from "@/components/page-Reusables";
import { Screen, ThemedText } from "@/components/screens/screen";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { CustomHeader } from "@/components/ui/customHeader";
import "@/global.css";
import { getCopyright } from "@/lib/utils";
import { useAuth } from "@/src/contexts/auth-context";
import { useReferencePhotoContext } from "@/src/contexts/reference-photo-context";
import { useTabBar } from "@/src/contexts/tabbar-context";
import { useTheme } from "@/src/contexts/theme-context";
import { resetVifForm, showResponseModal } from "@/src/state";
import { api } from "@/src/state/api";
import { useAppDispatch } from "@/src/state/redux";
import * as Application from "expo-application";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Updates from "expo-updates";
import {
  Settings as Appsettings,
  ChevronRight,
  Info,
  LucideIcon,
  Moon,
  RotateCcw,
  ShieldAlert,
  Sun,
  Trash2,
  User,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";

const IShieldAlert = ShieldAlert as any;

/**
 * Real version info, read from the installed native binary.
 * - nativeApplicationVersion: CFBundleShortVersionString (iOS) / versionName (Android)
 * - nativeBuildVersion:       CFBundleVersion (iOS) / versionCode (Android)
 */
const APP_VERSION = Application.nativeApplicationVersion ?? "unknown";
const BUILD_NUMBER = Application.nativeBuildVersion ?? "unknown";

/** OTA update id (null when running the embedded bundle or in dev builds). */
const UPDATE_ID = Updates.updateId ? Updates.updateId.slice(0, 8) : null;

const VERSION_LABEL = `${APP_VERSION} (build ${BUILD_NUMBER})`;

/** Theme Toggle */
const ThemeToggle = () => {
  const { theme, preference, setPreference } = useTheme();
  const isLight = preference === "light";

  return (
    <Pressable
      onPress={() => setPreference(isLight ? "dark" : "light")}
      className="flex-row items-center justify-center w-12 h-12 rounded-full border"
      style={{
        backgroundColor: theme.colors.glass,
        borderColor: theme.colors.border,
      }}
    >
      {isLight ? (
        <Sun size={22} color={theme.colors.text} />
      ) : (
        <Moon size={22} color={theme.colors.text} />
      )}
    </Pressable>
  );
};

export default function Settings() {
  const { user, isAdmin } = useAuth();
  const userId = (user as any)?.email ?? (user as any)?.username ?? "anonymous";
  const { photoUri, photoVersion } = useReferencePhotoContext();
  const { onScroll } = useTabBar();
  const dispatch = useAppDispatch();
  const { theme, preference, setPreference } = useTheme();
  const [refresh, setRefresh] = useState(false);
  // If the profile photo URL fails to load (expired, missing, no permission),
  // fall back to the user icon instead of a blank circle.
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  useEffect(() => {
    setImageFailed(false);
    setImageLoaded(false);
  }, [photoUri]);

  const [dialogConfig, setDialogConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    variant?: "danger" | "warning" | "info";
    icon?: LucideIcon;
    onConfirm: () => void;
  } | null>(null);

  const getThemeLabel = () =>
    preference === "light"
      ? "Light"
      : preference === "dark"
        ? "Dark"
        : "System";

  const handleClearCache = () => {
    setDialogConfig({
      visible: true,
      title: "Clear Cache",
      message:
        "This will clear temporary app data. This action cannot be undone.",
      variant: "warning",
      icon: RotateCcw,
      onConfirm: () => {
        dispatch(api.util.resetApiState());
        dispatch(
          showResponseModal({ successful: true, message: "Cache cleared" }),
        );
        setDialogConfig(null);
      },
    });
  };

  const handleReset = () => {
    setDialogConfig({
      visible: true,
      title: "Reset Settings",
      message:
        "Reset all preferences? This will restore all settings to their default values.",
      variant: "danger",
      icon: Appsettings,
      onConfirm: () => {
        setPreference("system");
        dispatch(resetVifForm());
        dispatch(api.util.resetApiState());
        setDialogConfig(null);
      },
    });
  };

  const handleRefresh = async () => {
    setRefresh(true);
    setRefresh(false);
  };

  return (
    <Screen
      scrollable
      onScroll={onScroll}
      refreshControl={
        <RefreshControl
          refreshing={refresh}
          onRefresh={handleRefresh}
          tintColor={theme.colors.accent}
          colors={[theme.colors.accent]}
        />
      }
    >
      <View>
        {/* Header */}
        <CustomHeader
          title="Settings"
          subtitle="Customize your app experience"
        />

        {/* Profile Section */}
        <View className="mb-4">
          <SectionHeader title="Profile" />
          <LinearGradient
            colors={[theme.colors.accent + "18", theme.colors.accent + "05"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.profileCard,
              { borderColor: theme.colors.accent + "30" },
            ]}
          >
            {/* Avatar */}
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: theme.colors.accent + "20",
                  borderColor: theme.colors.accent + "40",
                },
              ]}
            >
              <User size={26} color={theme.colors.accent} />
              {photoUri && !imageFailed && (
                <Image
                  source={{
                    uri: photoUri,
                    cacheKey: photoUri.startsWith("http")
                      ? `profile-${userId}-${photoVersion}`
                      : undefined,
                  }}
                  style={[styles.avatarImage, { opacity: imageLoaded ? 1 : 0 }]}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  transition={150}
                  onLoad={(e) => {
                    if (e.source.width > 1 && e.source.height > 1)
                      setImageLoaded(true);
                    else setImageFailed(true);
                  }}
                  onError={() => setImageFailed(true)}
                />
              )}
            </View>

            {/* Name / email / admin badge */}
            <View style={{ flex: 1 }}>
              <ThemedText weight="700" style={{ fontSize: 15 }}>
                {user?.preferred_username}
              </ThemedText>
              <ThemedText muted variant="small">
                {user?.email}
              </ThemedText>

              {isAdmin && (
                <Pressable
                  onPress={() => router.push("/admin/adminPage")}
                  style={({ pressed }) => [
                    styles.adminBadge,
                    {
                      backgroundColor: pressed
                        ? theme.colors.accent + "30"
                        : theme.colors.accent + "18",
                      borderColor: theme.colors.accent + "45",
                    },
                  ]}
                >
                  <IShieldAlert size={11} color={theme.colors.accent} />
                  <ThemedText
                    weight="700"
                    style={{
                      color: theme.colors.accent,
                      fontSize: 10,
                      letterSpacing: 0.8,
                    }}
                  >
                    ADMIN
                  </ThemedText>
                  <ChevronRight size={10} color={theme.colors.accent} />
                </Pressable>
              )}
            </View>

            {/* Edit button */}
            <Pressable
              style={({ pressed }) => [
                styles.editBtn,
                {
                  borderColor: theme.colors.accent,
                  backgroundColor: pressed
                    ? theme.colors.accent + "25"
                    : theme.colors.glass,
                },
              ]}
            >
              <ThemedText
                variant="small"
                weight="600"
                style={{ color: theme.colors.accent }}
              >
                Edit
              </ThemedText>
            </Pressable>
          </LinearGradient>
        </View>

        {/* Appearance Section */}
        <View className="mb-4">
          <SectionHeader title="Appearance" />
          <View
            className="flex-row justify-between items-center p-4 rounded-2xl border mb-3"
            style={getCardStyle(theme)}
          >
            <View>
              <ThemedText weight="600">Theme</ThemedText>
              <ThemedText muted variant="small">
                Current: {getThemeLabel()}
              </ThemedText>
            </View>
            <ThemeToggle />
          </View>
        </View>

        {/* About Section */}
        <View className="mb-4">
          <SectionHeader title="About" />
          <AppCard title="Version">
            <ThemedText muted variant="small">
              {VERSION_LABEL}
              {UPDATE_ID ? ` · update ${UPDATE_ID}` : ""}
            </ThemedText>
          </AppCard>
          <AppCard title="Environment">
            <View className="flex-row items-center gap-2">
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: theme.colors.success }}
              />
              <ThemedText
                variant="small"
                style={{ color: theme.colors.success }}
              >
                {__DEV__ ? "Development" : "Production"}
              </ThemedText>
            </View>
          </AppCard>
        </View>

        {/* Data Section */}
        <View className="mb-4">
          <SectionHeader title="Data" />
          <AppCard title="Clear Cache" onPress={handleClearCache}>
            <Trash2 size={18} color={theme.colors.textMuted} />
          </AppCard>
          <AppCard title="Reset Settings" onPress={handleReset}>
            <Info size={18} color={theme.colors.textMuted} />
          </AppCard>
        </View>

        {/* Confirm dialogs */}
        {dialogConfig && (
          <ConfirmDialog
            visible={dialogConfig.visible}
            title={dialogConfig.title}
            message={dialogConfig.message}
            variant={dialogConfig.variant}
            icon={dialogConfig.icon}
            onConfirm={dialogConfig.onConfirm}
            onCancel={() => setDialogConfig(null)}
          />
        )}

        {/* Footer */}
        <View className="mt-8 pt-4 items-center">
          <ThemedText muted variant="small">
            {getCopyright()}
          </ThemedText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 50,
    height: 50,
    borderRadius: 16,
  },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
});
