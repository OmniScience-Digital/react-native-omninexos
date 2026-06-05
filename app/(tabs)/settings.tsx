// app/(tabs)/settings.tsx
import {
  AppCard,
  getCardStyle,
  SectionHeader,
} from "@/components/page-Reusables";
import { Screen, ThemedText } from "@/components/screens/screen";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { CustomHeader } from "@/components/ui/customHeader";
import { CustomScrollView } from "@/components/ui/scrollView";
import "@/global.css";
import { getCopyright } from "@/lib/utils";
import { useAuth } from "@/src/contexts/auth-context";
import { useTabBar } from "@/src/contexts/tabbar-context";
import { useTheme } from "@/src/contexts/theme-context";
import { resetVifForm, showResponseModal } from "@/src/state";
import { api } from "@/src/state/api";
import { useAppDispatch } from "@/src/state/redux";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  Settings as Appsettings,
  ChevronRight,
  Info,
  LogOut,
  LucideIcon,
  Moon,
  RotateCcw,
  ShieldAlert,
  Sun,
  Trash2,
  User,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";

const IShieldAlert = ShieldAlert as any;

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
  const { user, logout, isAdmin } = useAuth();
  const { onScroll } = useTabBar();
  const dispatch = useAppDispatch();
  const { theme, preference, setPreference } = useTheme();
  const [refresh, setRefresh] = useState(false);

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

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
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
      <CustomScrollView>
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
              2.1.0 (build 42)
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
                Production
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

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          className="flex-row items-center justify-center gap-2 p-4 rounded-2xl border mt-4"
          style={{
            backgroundColor: theme.colors.accent,
            borderColor: theme.colors.accent,
          }}
        >
          <LogOut size={20} color={theme.colors.primaryText} />
          <ThemedText weight="600" style={{ color: theme.colors.primaryText }}>
            Log Out
          </ThemedText>
        </Pressable>

        {/* Footer */}
        <View className="mt-8 pt-4 items-center">
          <ThemedText muted variant="small">
            {getCopyright()}
          </ThemedText>
        </View>
      </CustomScrollView>
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
