// react-native-omninexos/app/(auth)/reset-password.tsx  (MODIFIED - AUTH-FIX)
//
// Step 2 of the password reset flow: user enters the emailed code and a new password.
// Changes (search "AUTH-FIX"):
//   - NEW "Resend code" button with a 30s cooldown (there was no way to resend before)
//   - subtitle shows the masked address the code was sent to (`destination` route param
//     from forgot-password.tsx), falling back to the typed email
//   - email param is cleaned (it can arrive as string | string[]); code is digits-only
//   - friendly error messages via src/services/auth-errors.ts
import { ThemedText } from "@/components/screens/screen";
import { useAuthInputStyle } from "@/hooks/useAuthInputStyle";
import { useTheme } from "@/src/contexts/theme-context";
import {
  getConfirmResetErrorMessage,
  getRequestResetErrorMessage,
} from "@/src/services/auth-errors";
import { confirmResetPassword, resetPassword } from "aws-amplify/auth";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { AuthFormLayout } from "../../components/auth/AuthFormLayout";

const ResetPassword = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{
    email: string | string[];
    destination?: string | string[];
  }>();
  // AUTH-FIX: route params can be string | string[]
  const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? "";
  const email = first(params.email).trim().toLowerCase();
  const destination = first(params.destination);

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // AUTH-FIX: resend code with a cooldown so users can't spam Cognito (rate limits)
  const RESEND_COOLDOWN = 30;
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN); // code was just sent
  const [resendMessage, setResendMessage] = useState("");
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

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
      setError(getConfirmResetErrorMessage(err)); // AUTH-FIX
    } finally {
      setIsLoading(false);
    }
  };

  // AUTH-FIX: request a fresh code for the same email
  const handleResend = async () => {
    if (cooldown > 0 || isResending || !email) return;
    setIsResending(true);
    setError("");
    setResendMessage("");
    try {
      await resetPassword({ username: email });
      setCode("");
      setResendMessage("A new code has been sent.");
      setCooldown(RESEND_COOLDOWN);
    } catch (err: any) {
      setError(getRequestResetErrorMessage(err));
    } finally {
      setIsResending(false);
    }
  };

  const getInputStyle = useAuthInputStyle();

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
      subtitle={`Enter the code sent to ${destination || email} and your new password`}
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
          onChangeText={(v) => setCode(v.replace(/\D/g, ""))} // AUTH-FIX: digits only
          keyboardType="number-pad"
          maxLength={6}
        />
        {/* AUTH-FIX: resend code */}
        <Pressable
          onPress={handleResend}
          disabled={cooldown > 0 || isResending}
          hitSlop={8}
        >
          <ThemedText
            weight="600"
            style={{
              fontSize: 13,
              color:
                cooldown > 0 || isResending
                  ? theme.colors.textMuted
                  : theme.colors.primary,
            }}
          >
            {isResending
              ? "Sending..."
              : cooldown > 0
                ? `Resend code in ${cooldown}s`
                : "Resend code"}
          </ThemedText>
        </Pressable>
        {resendMessage !== "" && (
          <ThemedText
            weight="400"
            style={{ fontSize: 12, color: theme.colors.textMuted }}
          >
            {resendMessage} Check your spam folder if you don't see it.
          </ThemedText>
        )}
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
