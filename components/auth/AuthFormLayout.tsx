// components/auth/AuthFormLayout.tsx
import logodark from "@/assets/images/icon.png";
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
        style={{ flex: 1 }}
      >
        <CustomScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              paddingHorizontal: 24,
              paddingVertical: 45,
            }}
          >
            {/* Logo & Brand */}
            <View style={{ alignItems: "center", marginBottom: 32 }}>
              <View
                style={{
                  width: 120,
                  height: 100,
                  borderRadius: 20,
                  backgroundColor: theme.colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 5,
                }}
              >
                <Image
                  source={theme.name === "light" ? logodark : logo}
                  style={{ width: 90, height: 100 }}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Title & Subtitle */}
            <View style={{ marginBottom: 32 }}>
              <ThemedText
                weight="600"
                style={{
                  fontSize: 24,
                  color: theme.colors.text,
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                {title}
              </ThemedText>
              <ThemedText
                weight="400"
                muted
                style={{
                  fontSize: 14,
                  textAlign: "center",
                  lineHeight: 18,
                  maxWidth: 300,
                  alignSelf: "center",
                }}
              >
                {subtitle}
              </ThemedText>
            </View>

            {/* Form Card */}
            <View
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: 28,
                padding: 24,
                borderWidth: 1,
                borderColor: theme.colors.border,
                shadowColor: theme.colors.accent,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.08,
                shadowRadius: 16,
                elevation: 4,
              }}
            >
              <View style={{ gap: 20 }}>
                {children}

                <Pressable
                  style={({ pressed }) => [
                    {
                      backgroundColor: getButtonStyle(isDisabled || isLoading)
                        .backgroundColor,
                      borderRadius: 100,
                      paddingVertical: 16,
                      alignItems: "center",
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                  onPress={onSubmit}
                  disabled={isDisabled || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.colors.primaryText} />
                  ) : (
                    <ThemedText
                      weight="700"
                      style={{
                        fontSize: 16,
                        color: theme.colors.primaryText,
                      }}
                    >
                      {buttonText}
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            </View>

            {/* Footer Link */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                marginTop: 24,
                gap: 4,
              }}
            >
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
