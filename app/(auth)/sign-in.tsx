// app/(auth)/sign-in.tsx
import { ThemedText } from "@/components/screens/screen";
import { GoogleIcon } from "@/components/ui/googleicon";
import { useAuth } from "@/src/contexts/auth-context";
import { useTheme } from "@/src/contexts/theme-context";
import { signIn, signInWithRedirect } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { AuthFormLayout } from "../../components/auth/AuthFormLayout";

const SignIn = () => {
  const router = useRouter();
  const { theme } = useTheme();

  const { isAuthenticated, isLoading: contextLoad, checkAuth } = useAuth();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [signInError, setSignInError] = useState("");

  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress);
  const passwordValid = password.length > 0;
  const formValid =
    emailAddress.length > 0 && password.length > 0 && emailValid;

  // ── Listen for Amplify Hub events (Google OAuth callback) ─────────────────
  // When the user returns from the Google sign-in browser, Hub fires
  // "signedIn". We catch it here to refresh auth context and navigate.
  // NOTE: this must be registered unconditionally (not after an early
  // `return null` below) or the listener never attaches and the redirect
  // back into the app is silently dropped.
  useEffect(() => {
    const unsubscribe = Hub.listen("auth", async ({ payload }) => {
      switch (payload.event) {
        case "signedIn":
          setGoogleLoading(false);
          await checkAuth();
          router.replace("/(tabs)");
          break;
        case "signInWithRedirect_failure":
          setGoogleLoading(false);
          setSignInError("Google sign-in failed. Please try again.");
          break;
        case "customOAuthState":
          // Optional: handle custom state passed during redirect
          break;
      }
    });

    return unsubscribe;
  }, []);

  // Wait for auth to load
  if (contextLoad) return null;

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

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

  // ── Google sign-in ────────────────────────────────────────────────────────
  // signInWithRedirect opens the Cognito Hosted UI in a browser. On native,
  // @aws-amplify/react-native handles opening it via the system browser and
  // capturing the `reactnativeomninexos://` redirect automatically — no
  // manual WebBrowser.openAuthSessionAsync/urlOpener wiring needed in v6.
  // The Hub listener above handles the callback when the user returns.
  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      setSignInError("");
      await signInWithRedirect({ provider: "Google" });
      // Execution continues here briefly before the browser opens.
      // The Hub "signedIn" event above handles post-login navigation.
    } catch (error: any) {
      setGoogleLoading(false);
      setSignInError(error.message || "Google sign-in failed");
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
      subtitle="Sign in and manage your account"
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

      {/* ── Divider ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginVertical: 2,
        }}
      >
        <View
          style={{ flex: 1, height: 0.5, backgroundColor: theme.colors.border }}
        />
        <ThemedText
          weight="400"
          style={{ fontSize: 12, color: theme.colors.textMuted }}
        >
          or
        </ThemedText>
        <View
          style={{ flex: 1, height: 0.5, backgroundColor: theme.colors.border }}
        />
      </View>

      {/* ── Google Sign In ── */}
      <Pressable
        onPress={handleGoogleSignIn}
        disabled={googleLoading || isLoading}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          paddingVertical: 10,
          paddingHorizontal: 20,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: pressed
            ? theme.colors.background
            : theme.colors.card,
          opacity: googleLoading || isLoading ? 0.6 : 1,
        })}
      >
        {googleLoading ? (
          <ActivityIndicator size="small" color={theme.colors.textMuted} />
        ) : (
          <GoogleIcon size={20} />
        )}
        <ThemedText
          weight="400"
          style={{ fontSize: 15, color: theme.colors.text }}
        >
          {googleLoading ? "Opening Google…" : "Continue with Google"}
        </ThemedText>
      </Pressable>
    </AuthFormLayout>
  );
};

export default SignIn;
