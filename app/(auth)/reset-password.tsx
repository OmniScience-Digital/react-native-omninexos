import { ThemedText } from "@/components/ui/screen";
import { useTheme } from "@/src/contexts/theme-context";
import { confirmResetPassword } from "aws-amplify/auth";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { AuthFormLayout } from "../../components/auth/AuthFormLayout";

const ResetPassword = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const codeValid = code.length === 6;
  const passwordValid = newPassword.length >= 8;
  const passwordsMatch = newPassword === confirmPassword;
  const formValid = codeValid && passwordValid && passwordsMatch;

  const handleSubmit = async () => {
    if (!formValid) return;
    setIsLoading(true);
    setError("");

    try {
      await confirmResetPassword({
        username: email,
        newPassword,
        confirmationCode: code,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  const getInputStyle = (hasError: boolean) => ({
    borderColor: hasError ? theme.colors.warning : theme.colors.border,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
  });

  if (success) {
    return (
      <AuthFormLayout
        title="Password Updated"
        subtitle="Your password has been reset successfully"
        buttonText="Return to Sign In"
        isLoading={false}
        onSubmit={() => router.replace("/(auth)/sign-in")}
        footerText=""
        footerLinkText=""
        footerLinkHref="/sign-in"
      >
        <View />
      </AuthFormLayout>
    );
  }

  return (
    <AuthFormLayout
      title="Set New Password"
      subtitle={`Enter the code sent to ${email} and your new password`}
      buttonText="Update Password"
      isLoading={isLoading}
      onSubmit={handleSubmit}
      isDisabled={!formValid}
      footerText=""
      footerLinkText="Back to Sign In"
      footerLinkHref="/sign-in"
    >
      <View className="gap-2">
        <ThemedText
          weight="600"
          style={{ fontSize: 14, color: theme.colors.text }}
        >
          Verification Code
        </ThemedText>
        <TextInput
          className="rounded-2xl border px-4 py-4 text-base font-sans-medium"
          style={getInputStyle(!!error && !codeValid)}
          value={code}
          placeholder="6-digit code"
          placeholderTextColor={theme.colors.textMuted}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
        />
      </View>

      <View className="gap-2">
        <ThemedText
          weight="600"
          style={{ fontSize: 14, color: theme.colors.text }}
        >
          New Password
        </ThemedText>
        <TextInput
          className="rounded-2xl border px-4 py-4 text-base font-sans-medium"
          style={getInputStyle(!!error && !passwordValid)}
          value={newPassword}
          placeholder="Minimum 8 characters"
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry
          onChangeText={setNewPassword}
        />
        {newPassword.length > 0 && !passwordValid && (
          <ThemedText
            weight="400"
            style={{ fontSize: 12, color: theme.colors.warning }}
          >
            Password must be at least 8 characters
          </ThemedText>
        )}
      </View>

      <View className="gap-2">
        <ThemedText
          weight="600"
          style={{ fontSize: 14, color: theme.colors.text }}
        >
          Confirm New Password
        </ThemedText>
        <TextInput
          className="rounded-2xl border px-4 py-4 text-base font-sans-medium"
          style={getInputStyle(
            !!error && confirmPassword.length > 0 && !passwordsMatch,
          )}
          value={confirmPassword}
          placeholder="Re-enter your password"
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry
          onChangeText={setConfirmPassword}
        />
        {confirmPassword.length > 0 && !passwordsMatch && (
          <ThemedText
            weight="400"
            style={{ fontSize: 12, color: theme.colors.warning }}
          >
            Passwords do not match
          </ThemedText>
        )}
      </View>

      {error && (
        <ThemedText
          weight="400"
          style={{ fontSize: 12, color: theme.colors.warning }}
        >
          {error}
        </ThemedText>
      )}
    </AuthFormLayout>
  );
};

export default ResetPassword;
