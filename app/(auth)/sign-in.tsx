import { ThemedText } from "@/components/ui/screen";
import { useAuth } from "@/src/contexts/auth-context";
import { useTheme } from "@/src/contexts/theme-context";
import { signIn } from "aws-amplify/auth";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { AuthFormLayout } from "../../components/auth/AuthFormLayout";

const SignIn = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const { checkAuth } = useAuth();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [signInError, setSignInError] = useState("");

  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress);
  const passwordValid = password.length > 0;
  const formValid =
    emailAddress.length > 0 && password.length > 0 && emailValid;

  const handleSubmit = async () => {
    if (!formValid) return;
    setIsLoading(true);
    setSignInError("");

    try {
      const result = await signIn({ username: emailAddress, password });

      if (result.isSignedIn) {
        await checkAuth(); // 👈 FORCE context refresh
        router.replace("/(tabs)");
      } else {
        setSignInError("Additional verification required. Check your email.");
      }
    } catch (error: any) {
      setSignInError(error.message || "Invalid email or password");
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
      title="Welcome back"
      subtitle="Sign in to continue managing your account"
      buttonText="Sign In"
      isLoading={isLoading}
      onSubmit={handleSubmit}
      isDisabled={!formValid}
      footerText="Don't have an account?"
      footerLinkText="Create Account"
      footerLinkHref="/sign-up"
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
          placeholder="name@example.com"
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
            Please enter a valid email address
          </ThemedText>
        )}
        {signInError && (
          <ThemedText
            weight="400"
            style={{ fontSize: 12, color: theme.colors.warning }}
          >
            {signInError}
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
          placeholder="Enter your password"
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry
          onChangeText={setPassword}
          onBlur={() => setPasswordTouched(true)}
          autoComplete="password"
        />
        {passwordTouched && !passwordValid && (
          <ThemedText
            weight="400"
            style={{ fontSize: 12, color: theme.colors.warning }}
          >
            Password is required
          </ThemedText>
        )}
      </View>
      <View>
        {passwordTouched && !passwordValid}

        {/* Forgot password link */}
        <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
          <ThemedText
            weight="400"
            style={{
              fontSize: 12,
              color: theme.colors.accent,
              textAlign: "right",
            }}
          >
            Forgot password?
          </ThemedText>
        </Pressable>
      </View>
    </AuthFormLayout>
  );
};

export default SignIn;
