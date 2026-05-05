import {
  AppCard,
  getCardStyle,
  SectionHeader,
} from "@/components/page-Reusables";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { CustomHeader } from "@/components/ui/customHeader";
import { Screen, ThemedText } from "@/components/ui/screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import "@/global.css";
import { getCopyright } from "@/lib/utils";
import { useAuth } from "@/src/contexts/auth-context";
import { useTheme } from "@/src/contexts/theme-context";
import { resetVifForm, showResponseModal } from "@/src/state";
import { api } from "@/src/state/api";
import { useAppDispatch } from "@/src/state/redux";
import {
  Settings as Appsettings,
  Info,
  LogOut,
  LucideIcon,
  Moon,
  RotateCcw,
  Sun,
  Trash2,
  User,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

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
  const { user, logout } = useAuth();
  const dispatch = useAppDispatch();
  const { theme, preference, setPreference } = useTheme();
  // Add state for dialog configuration
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

  return (
    <Screen>
      <CustomScrollView>
        {/* Custom Header without back button */}
        <CustomHeader
          title="Settings"
          subtitle="Customize your app experience"
        />

        {/* Profile Section – custom card */}
        <View className="mb-6">
          <SectionHeader title="Profile" />
          <View
            className="flex-row items-center p-4 rounded-2xl border mb-3"
            style={getCardStyle(theme)}
          >
            <View
              className="w-12 h-12 rounded-full items-center justify-center mr-4"
              style={{ backgroundColor: theme.colors.glass }}
            >
              <User size={24} color={theme.colors.accent} />
            </View>
            <View className="flex-1">
              <ThemedText weight="700">{user?.preferred_username}</ThemedText>
              <ThemedText muted variant="small">
                {user?.email}
              </ThemedText>
            </View>
            <Pressable
              className="px-3 py-1 rounded-full border"
              style={{
                borderColor: theme.colors.accent,
                backgroundColor: theme.colors.glass,
              }}
            >
              <ThemedText
                variant="small"
                weight="600"
                style={{ color: theme.colors.accent }}
              >
                Edit
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Appearance Section */}
        <View className="mb-6">
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
        <View className="mb-6">
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
        <View className="mb-6">
          <SectionHeader title="Data" />
          <AppCard title="Clear Cache" onPress={handleClearCache}>
            <Trash2 size={18} color={theme.colors.textMuted} />
          </AppCard>
          <AppCard title="Reset Settings" onPress={handleReset}>
            <Info size={18} color={theme.colors.textMuted} />
          </AppCard>
        </View>
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

        {/* Logout Button – using AppCard style but full width */}
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
