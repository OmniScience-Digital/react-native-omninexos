// components/auth/AuthFormLayout.tsx
import logo from "@/assets/images/logo_dark.png";
import { Screen, ThemedText } from "@/components/ui/screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useTheme } from "@/src/contexts/theme-context";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from "react-native";

export const AuthFormLayout = ({
  title,
  subtitle,
  buttonText,
  isLoading,
  onSubmit,
  isDisabled = false,
  children,
  footerText,
  footerLinkText,
  footerLinkHref,
}: AuthFormLayoutProps) => {
  const { theme } = useTheme();

  const getButtonStyle = (disabled: boolean) => ({
    backgroundColor: disabled
      ? theme.colors.textMuted + "80"
      : theme.colors.accent,
  });

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <CustomScrollView keyboardShouldPersistTaps="handled">
          <View className="px-5 pb-10 pt-8">
            {/* Branding */}
            <View className="items-center">
              <View
                className="flex-row items-center gap-3 mb-7"
                style={{ backgroundColor: theme.colors.accent, padding: 10 }}
              >
                <View
                  style={{
                    width: 100,
                    height: 90,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Image
                    source={logo}
                    style={{ width: 92, height: 72 }}
                    resizeMode="contain"
                  />
                </View>
                <View style={{ alignItems: "center" }}>
                  <ThemedText
                    weight="600"
                    style={{
                      fontSize: 24,
                      color: theme.colors.text,
                      textAlign: "center",
                    }}
                  >
                    Omni-Nexos
                  </ThemedText>
                  <ThemedText
                    weight="400"
                    muted
                    style={{ fontSize: 11, letterSpacing: 1, marginTop: -4 }}
                  >
                    MASSIVE PTY LTD
                  </ThemedText>
                </View>
              </View>
              <ThemedText
                weight="700"
                style={{ fontSize: 30, color: theme.colors.text }}
              >
                {title}
              </ThemedText>
              <ThemedText
                weight="400"
                muted
                style={{
                  fontSize: 16,
                  textAlign: "center",
                  maxWidth: 320,
                  marginTop: 8,
                }}
              >
                {subtitle}
              </ThemedText>
            </View>

            {/* Form Card */}
            <View
              className="mt-8 rounded-3xl border p-5"
              style={{
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              }}
            >
              <View className="gap-4">
                {children}

                <Pressable
                  className="mt-1 items-center rounded-2xl py-4"
                  style={getButtonStyle(isDisabled || isLoading)}
                  onPress={onSubmit}
                  disabled={isDisabled || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.colors.primaryText} />
                  ) : (
                    <ThemedText
                      weight="700"
                      style={{ fontSize: 16, color: theme.colors.primaryText }}
                    >
                      {buttonText}
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            </View>

            {/* Footer Link */}
            <View className="mt-5 flex-row items-center justify-center gap-1">
              <ThemedText weight="400" muted style={{ fontSize: 14 }}>
                {footerText}
              </ThemedText>
              <Link href={footerLinkHref} asChild>
                <Pressable>
                  <ThemedText
                    weight="700"
                    style={{ fontSize: 14, color: theme.colors.accent }}
                  >
                    {footerLinkText}
                  </ThemedText>
                </Pressable>
              </Link>
            </View>
          </View>
        </CustomScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};
