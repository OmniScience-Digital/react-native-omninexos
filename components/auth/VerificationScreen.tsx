// components/auth/VerificationScreen.tsx
import { Screen, ThemedText } from "@/components/screens/screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useTheme } from "@/src/contexts/theme-context";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    TextInput,
    View,
} from "react-native";

interface VerificationScreenProps {
  title: string;
  subtitle: string;
  code: string;
  setCode: (code: string) => void;
  error: string;
  isVerifying: boolean;
  onVerify: () => void;
  onResend: () => void;
  showStartOver?: boolean;
  onStartOver?: () => void;
}

export const VerificationScreen = ({
  title,
  subtitle,
  code,
  setCode,
  error,
  isVerifying,
  onVerify,
  onResend,
  showStartOver = false,
  onStartOver,
}: VerificationScreenProps) => {
  const { theme } = useTheme();

  const getInputStyle = (hasError: boolean) => ({
    borderColor: hasError ? theme.colors.warning : theme.colors.border,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
  });

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
            <View className="items-center">
              <View className="flex-row items-center gap-3 mb-7">
                <View
                  className="size-14 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: theme.colors.accent }}
                >
                  <ThemedText
                    weight="700"
                    style={{ fontSize: 24, color: theme.colors.primaryText }}
                  >
                    D
                  </ThemedText>
                </View>
                <View>
                  <ThemedText
                    weight="700"
                    style={{ fontSize: 28, color: theme.colors.text }}
                  >
                    DemoHub
                  </ThemedText>
                  <ThemedText
                    weight="600"
                    muted
                    style={{ fontSize: 12, letterSpacing: 1, marginTop: -4 }}
                  >
                    MANAGEMENT
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

            <View
              className="mt-8 rounded-3xl border p-5"
              style={{
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              }}
            >
              <View className="gap-4">
                <View className="gap-2">
                  <ThemedText
                    weight="600"
                    style={{ fontSize: 14, color: theme.colors.text }}
                  >
                    Verification Code
                  </ThemedText>
                  <TextInput
                    className="rounded-2xl border px-4 py-4 text-base font-sans-medium"
                    style={getInputStyle(!!error)}
                    value={code}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor={theme.colors.textMuted}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    maxLength={6}
                  />
                  {error && (
                    <ThemedText
                      weight="400"
                      style={{ fontSize: 12, color: theme.colors.warning }}
                    >
                      {error}
                    </ThemedText>
                  )}
                </View>

                <Pressable
                  className="mt-1 items-center rounded-2xl py-4"
                  style={getButtonStyle(!code || isVerifying)}
                  onPress={onVerify}
                  disabled={!code || isVerifying}
                >
                  <ThemedText
                    weight="700"
                    style={{ fontSize: 16, color: theme.colors.primaryText }}
                  >
                    {isVerifying ? "Verifying..." : "Verify"}
                  </ThemedText>
                </Pressable>

                <Pressable
                  className="items-center rounded-2xl border py-3"
                  style={{
                    borderColor: theme.colors.accent + "30",
                    backgroundColor: theme.colors.accent + "10",
                  }}
                  onPress={onResend}
                  disabled={isVerifying}
                >
                  <ThemedText
                    weight="600"
                    style={{ fontSize: 14, color: theme.colors.accent }}
                  >
                    Resend Code
                  </ThemedText>
                </Pressable>

                {showStartOver && onStartOver && (
                  <Pressable
                    className="items-center rounded-2xl border py-3"
                    style={{
                      borderColor: theme.colors.accent + "30",
                      backgroundColor: theme.colors.accent + "10",
                    }}
                    onPress={onStartOver}
                    disabled={isVerifying}
                  >
                    <ThemedText
                      weight="600"
                      style={{ fontSize: 14, color: theme.colors.accent }}
                    >
                      Start Over
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </CustomScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};
