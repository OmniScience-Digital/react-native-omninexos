// react-native-omninexos/app/(auth)/forgot-password.tsx  (MODIFIED - AUTH-FIX)
//
// Step 1 of the password reset flow: user enters their email and Cognito emails a code.
// Changes (search "AUTH-FIX"):
//   - email is trimmed + lowercased before use (keyboards add trailing spaces; casing
//     must match the stored username), and validation runs on the cleaned value
//   - passes the masked delivery destination (e.g. "t***@o***.digital") to the next screen
//     so the user can see where the code was sent
//   - friendly error messages via src/services/auth-errors.ts (incl. Google-only accounts)
//   - router.push now passes `destination`, read by reset-password.tsx
import { ThemedText } from "@/components/screens/screen";
import { useAuthInputStyle } from "@/hooks/useAuthInputStyle";
import { useTheme } from "@/src/contexts/theme-context";
import { getRequestResetErrorMessage } from "@/src/services/auth-errors";
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

  // AUTH-FIX: clean the email once and use it everywhere below
  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const formValid = normalizedEmail.length > 0 && emailValid;

  const handleSubmit = async () => {
    if (!formValid) return;
    setIsLoading(true);
    setError("");

    try {
      const { nextStep } = await resetPassword({ username: normalizedEmail });
      // AUTH-FIX: Cognito tells us where it sent the code (masked), e.g. "t***@o***.digital"
      const destination =
        nextStep?.resetPasswordStep === "CONFIRM_RESET_PASSWORD_WITH_CODE"
          ? (nextStep.codeDeliveryDetails?.destination ?? "")
          : "";
      router.push({
        pathname: "/(auth)/reset-password",
        params: { email: normalizedEmail, destination },
      });
    } catch (err: any) {
      setError(getRequestResetErrorMessage(err)); // AUTH-FIX
    } finally {
      setIsLoading(false);
    }
  };

  const getInputStyle = useAuthInputStyle();

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
