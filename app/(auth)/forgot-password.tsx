import { ThemedText } from "@/components/screens/screen";
import { useTheme } from "@/src/contexts/theme-context";
import { resetPassword } from "aws-amplify/auth";
import { useRouter } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { AuthFormLayout } from "../../components/auth/AuthFormLayout";

const ForgotPassword = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const formValid = email.length > 0 && emailValid;

  const handleSubmit = async () => {
    if (!formValid) return;
    setIsLoading(true);
    setError("");

    try {
      await resetPassword({ username: email });
      // Store email temporarily (could use route params or context)
      router.push({ pathname: "/(auth)/reset-password", params: { email } });
    } catch (err: any) {
      setError(err.message || "Failed to send reset code");
    } finally {
      setIsLoading(false);
    }
  };

  const getInputStyle = (hasError: boolean) => ({
    borderColor: hasError ? theme.colors.warning : theme.colors.border,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
  });

  return (
    <AuthFormLayout
      title="Reset Password"
      subtitle="Enter your email to receive a verification code"
      buttonText="Send Verification Code"
      isLoading={isLoading}
      onSubmit={handleSubmit}
      isDisabled={!formValid}
      footerText="Remember your password?"
      footerLinkText="Back to Sign In"
      footerLinkHref="/sign-in"
    >
      <View className="gap-2">
        <ThemedText
          weight="600"
          style={{ fontSize: 14, color: theme.colors.text }}
        >
          Email Address
        </ThemedText>
        <TextInput
          className="rounded-2xl border px-4 py-4 text-base font-sans-medium"
          style={getInputStyle(emailTouched && !emailValid)}
          autoCapitalize="none"
          value={email}
          placeholder="name@example.com"
          placeholderTextColor={theme.colors.textMuted}
          onChangeText={setEmail}
          onBlur={() => setEmailTouched(true)}
          keyboardType="email-address"
          autoComplete="email"
        />
        {emailTouched && !emailValid && (
          <ThemedText
            weight="400"
            style={{ fontSize: 12, color: theme.colors.warning }}
          >
            Please enter a valid email address
          </ThemedText>
        )}
        {error && (
          <ThemedText
            weight="400"
            style={{ fontSize: 12, color: theme.colors.warning }}
          >
            {error}
          </ThemedText>
        )}
      </View>
    </AuthFormLayout>
  );
};

export default ForgotPassword;
