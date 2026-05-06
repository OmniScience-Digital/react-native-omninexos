import { ThemedText } from "@/components/screens/screen";
import { useTheme } from "@/src/contexts/theme-context";
import { confirmSignUp, resendSignUpCode, signUp } from "aws-amplify/auth";
import { useRouter } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { AuthFormLayout } from "../../components/auth/AuthFormLayout";
import { VerificationScreen } from "../../components/auth/VerificationScreen";

const SignUp = () => {
  const router = useRouter();
  const { theme } = useTheme();

  // Form fields
  const [emailAddress, setEmailAddress] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [signUpError, setSignUpError] = useState("");

  const [emailTouched, setEmailTouched] = useState(false);
  const [fullNameTouched, setFullNameTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);

  // Verification flow
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  // Domain validation (company emails only)
  const emailValid = (() => {
    if (!emailAddress) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) return false;
    const domain = emailAddress.split("@")[1];
    return (
      domain?.includes("omniscience") ||
      domain?.includes("mass") ||
      domain?.includes("sb-plant.com")
    );
  })();

  const fullNameValid = (() => {
    if (!fullName) return true;
    const words = fullName.trim().split(/\s+/);
    return words.length >= 2;
  })();

  const passwordValid = password.length === 0 || password.length >= 8;
  const passwordsMatch = password === confirmPassword;
  const formValid =
    emailAddress.length > 0 &&
    emailValid &&
    fullName.length > 0 &&
    fullNameValid &&
    password.length >= 8 &&
    passwordsMatch;

  const handleSubmit = async () => {
    if (!formValid) return;
    setIsLoading(true);
    setSignUpError("");

    try {
      const { isSignUpComplete, nextStep } = await signUp({
        username: emailAddress,
        password,
        options: {
          userAttributes: {
            email: emailAddress,
            preferred_username: fullName,
          },
          autoSignIn: true,
        },
      });

      if (isSignUpComplete) {
        // Already confirmed? shouldn't happen with email verification enabled
        router.replace("/(auth)/sign-in");
      } else {
        setPendingEmail(emailAddress);
        setShowVerification(true);
      }
    } catch (error: any) {
      setSignUpError(error.message || "Sign up failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode) {
      setVerificationError("Verification code is required");
      return;
    }
    setIsVerifying(true);
    setVerificationError("");

    try {
      await confirmSignUp({
        username: pendingEmail,
        confirmationCode: verificationCode,
      });
      // After verification, go to sign in
      router.replace("/(auth)/sign-in");
    } catch (error: any) {
      setVerificationError(error.message || "Invalid verification code");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    setVerificationCode("");
    setVerificationError("");
    try {
      await resendSignUpCode({ username: pendingEmail });
    } catch (error: any) {
      setVerificationError(error.message || "Failed to resend code");
    }
  };

  const handleStartOver = () => {
    setShowVerification(false);
    setVerificationCode("");
    setVerificationError("");
    setPendingEmail("");
  };

  const getInputStyle = (hasError: boolean) => ({
    borderColor: hasError ? theme.colors.warning : theme.colors.border,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
  });

  if (showVerification) {
    return (
      <VerificationScreen
        title="Verify your email"
        subtitle={`We sent a verification code to ${pendingEmail}`}
        code={verificationCode}
        setCode={setVerificationCode}
        error={verificationError}
        isVerifying={isVerifying}
        onVerify={handleVerify}
        onResend={handleResendCode}
        showStartOver
        onStartOver={handleStartOver}
      />
    );
  }

  return (
    <AuthFormLayout
      title="Create your account"
      subtitle="Sign up with your company email to get started"
      buttonText="Create Account"
      isLoading={isLoading}
      onSubmit={handleSubmit}
      isDisabled={!formValid}
      footerText="Already have an account?"
      footerLinkText="Sign In"
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
          value={emailAddress}
          placeholder=" name@example.com"
          placeholderTextColor={theme.colors.textMuted}
          onChangeText={setEmailAddress}
          onBlur={() => setEmailTouched(true)}
          keyboardType="email-address"
          autoComplete="email"
        />
        {emailTouched && !emailValid && (
          <ThemedText
            weight="400"
            style={{ fontSize: 12, color: theme.colors.warning }}
          >
            {!emailAddress
              ? "Email is required"
              : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)
                ? "Please enter a valid email address"
                : "Only company emails (omniscience, mass, sb-plant.com) are accepted"}
          </ThemedText>
        )}
        {signUpError && (
          <ThemedText
            weight="400"
            style={{ fontSize: 12, color: theme.colors.warning }}
          >
            {signUpError}
          </ThemedText>
        )}
      </View>

      <View className="gap-2">
        <ThemedText
          weight="600"
          style={{ fontSize: 14, color: theme.colors.text }}
        >
          Full Name
        </ThemedText>
        <TextInput
          className="rounded-2xl border px-4 py-4 text-base font-sans-medium"
          style={getInputStyle(fullNameTouched && !fullNameValid)}
          value={fullName}
          placeholder=" e.g., John Cross"
          placeholderTextColor={theme.colors.textMuted}
          onChangeText={setFullName}
          onBlur={() => setFullNameTouched(true)}
          autoComplete="name"
        />
        {fullNameTouched && !fullNameValid && (
          <ThemedText
            weight="400"
            style={{ fontSize: 12, color: theme.colors.warning }}
          >
            Please enter both first name and surname
          </ThemedText>
        )}
      </View>

      <View className="gap-2">
        <ThemedText
          weight="600"
          style={{ fontSize: 14, color: theme.colors.text }}
        >
          Password
        </ThemedText>
        <TextInput
          className="rounded-2xl border px-4 py-4 text-base font-sans-medium"
          style={getInputStyle(passwordTouched && !passwordValid)}
          value={password}
          placeholder=" Create a strong password"
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry
          onChangeText={setPassword}
          onBlur={() => setPasswordTouched(true)}
          autoComplete="password-new"
        />
        {passwordTouched && !passwordValid && (
          <ThemedText
            weight="400"
            style={{ fontSize: 12, color: theme.colors.warning }}
          >
            Password must be at least 8 characters
          </ThemedText>
        )}
        {!passwordTouched && (
          <ThemedText weight="400" muted style={{ fontSize: 12 }}>
            Minimum 8 characters required
          </ThemedText>
        )}
      </View>

      <View className="gap-2">
        <ThemedText
          weight="600"
          style={{ fontSize: 14, color: theme.colors.text }}
        >
          Confirm Password
        </ThemedText>
        <TextInput
          className="rounded-2xl border px-4 py-4 text-base font-sans-medium"
          style={getInputStyle(confirmPasswordTouched && !passwordsMatch)}
          value={confirmPassword}
          placeholder=" Re-enter your password"
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry
          onChangeText={setConfirmPassword}
          onBlur={() => setConfirmPasswordTouched(true)}
          autoComplete="password-new"
        />
        {confirmPasswordTouched && !passwordsMatch && (
          <ThemedText
            weight="400"
            style={{ fontSize: 12, color: theme.colors.warning }}
          >
            Passwords do not match
          </ThemedText>
        )}
      </View>
    </AuthFormLayout>
  );
};

export default SignUp;
