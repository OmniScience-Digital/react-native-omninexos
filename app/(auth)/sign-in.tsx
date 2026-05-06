import { ThemedText } from "@/components/screens/screen";
import { useAuth } from "@/src/contexts/auth-context";
import { useTheme } from "@/src/contexts/theme-context";
import { signIn } from "aws-amplify/auth";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { AuthFormLayout } from "../../components/auth/AuthFormLayout";

const SignIn = () => {
  const router = useRouter();
  const { theme } = useTheme();

  const { isAuthenticated, isLoading: contextLoad, checkAuth } = useAuth();

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
          placeholder=" Enter your password"
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
    </AuthFormLayout>
  );
};

export default SignIn;

// app/(auth)/sign-in.tsx
// import { ThemedText } from "@/components/ui/screen";
// import { useAuth } from "@/src/contexts/auth-context";
// import { useTheme } from "@/src/contexts/theme-context";
// import { signIn, signInWithRedirect } from "aws-amplify/auth";
// import { Hub } from "aws-amplify/utils";
// import { Redirect, useRouter } from "expo-router";
// import { useEffect, useState } from "react";
// import { Pressable, TextInput, View } from "react-native";
// import { AuthFormLayout } from "../../components/auth/AuthFormLayout";

// const SignIn = () => {
//   const router = useRouter();
//   const { theme } = useTheme();
//   const { isAuthenticated, isLoading: contextLoad, checkAuth } = useAuth();

//   const [emailAddress, setEmailAddress] = useState("");
//   const [password, setPassword] = useState("");
//   const [isLoading, setIsLoading] = useState(false);
//   const [googleLoading, setGoogleLoading] = useState(false);
//   const [signInError, setSignInError] = useState("");

//   const [emailTouched, setEmailTouched] = useState(false);
//   const [passwordTouched, setPasswordTouched] = useState(false);

//   const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress);
//   const passwordValid = password.length > 0;
//   const formValid =
//     emailAddress.length > 0 && password.length > 0 && emailValid;

//   // ── Listen for Amplify Hub events (Google OAuth callback) ─────────────────
//   // When the user returns from the Google sign-in browser, Hub fires
//   // "signedIn". We catch it here to refresh auth context and navigate.
//   useEffect(() => {
//     const unsubscribe = Hub.listen("auth", async ({ payload }) => {
//       switch (payload.event) {
//         case "signedIn":
//           setGoogleLoading(false);
//           await checkAuth();
//           router.replace("/(tabs)");
//           break;
//         case "signInWithRedirect_failure":
//           setGoogleLoading(false);
//           setSignInError("Google sign-in failed. Please try again.");
//           break;
//         case "customOAuthState":
//           // Optional: handle custom state passed during redirect
//           break;
//       }
//     });

//     return () => unsubscribe();
//   }, []);

//   // Wait for auth context to initialise
//   if (contextLoad) return null;

//   // Already authenticated — send to tabs
//   if (isAuthenticated) return <Redirect href="/(tabs)" />;

//   // ── Email/password submit ─────────────────────────────────────────────────
//   const handleSubmit = async () => {
//     if (!formValid) return;
//     setIsLoading(true);
//     setSignInError("");
//     try {
//       const result = await signIn({ username: emailAddress, password });
//       if (result.isSignedIn) {
//         await checkAuth();
//         router.replace("/(tabs)");
//       } else {
//         setSignInError("Additional verification required. Check your email.");
//       }
//     } catch (error: any) {
//       setSignInError(error.message || "Invalid email or password");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   // ── Google sign-in ────────────────────────────────────────────────────────
//   // signInWithRedirect opens the Cognito hosted UI in a browser.
//   // The Hub listener above handles the callback when the user returns.
//   const handleGoogleSignIn = async () => {
//     try {
//       setGoogleLoading(true);
//       setSignInError("");
//       await signInWithRedirect({ provider: "Google" });
//       // Note: execution continues here briefly before the browser opens.
//       // The Hub "signedIn" event handles the actual post-login navigation.
//     } catch (error: any) {
//       setGoogleLoading(false);
//       setSignInError(error.message || "Google sign-in failed");
//     }
//   };

//   const getInputStyle = (hasError: boolean) => ({
//     borderColor: hasError ? theme.colors.warning : theme.colors.border,
//     backgroundColor: theme.colors.background,
//     color: theme.colors.text,
//   });

//   return (
//     <AuthFormLayout
//       title="Welcome back"
//       subtitle="Sign in and manage your account"
//       buttonText="Sign In"
//       isLoading={isLoading}
//       onSubmit={handleSubmit}
//       isDisabled={!formValid}
//       footerText="Don't have an account?"
//       footerLinkText="Create Account"
//       footerLinkHref="/sign-up"
//     >
//       {/* ── Email ── */}
//       <View className="gap-2">
//         <ThemedText
//           weight="600"
//           style={{ fontSize: 14, color: theme.colors.text }}
//         >
//           Email Address
//         </ThemedText>
//         <TextInput
//           className="rounded-2xl border px-4 py-4 text-base font-sans-medium"
//           style={getInputStyle(emailTouched && !emailValid)}
//           autoCapitalize="none"
//           value={emailAddress}
//           placeholder="name@example.com"
//           placeholderTextColor={theme.colors.textMuted}
//           onChangeText={setEmailAddress}
//           onBlur={() => setEmailTouched(true)}
//           keyboardType="email-address"
//           autoComplete="email"
//         />
//         {emailTouched && !emailValid && (
//           <ThemedText
//             weight="400"
//             style={{ fontSize: 12, color: theme.colors.warning }}
//           >
//             Please enter a valid email address
//           </ThemedText>
//         )}
//         {signInError && (
//           <ThemedText
//             weight="400"
//             style={{ fontSize: 12, color: theme.colors.warning }}
//           >
//             {signInError}
//           </ThemedText>
//         )}
//       </View>

//       {/* ── Password ── */}
//       <View className="gap-2">
//         <ThemedText
//           weight="600"
//           style={{ fontSize: 14, color: theme.colors.text }}
//         >
//           Password
//         </ThemedText>
//         <TextInput
//           className="rounded-2xl border px-4 py-4 text-base font-sans-medium"
//           style={getInputStyle(passwordTouched && !passwordValid)}
//           value={password}
//           placeholder="Enter your password"
//           placeholderTextColor={theme.colors.textMuted}
//           secureTextEntry
//           onChangeText={setPassword}
//           onBlur={() => setPasswordTouched(true)}
//           autoComplete="password"
//         />
//         {passwordTouched && !passwordValid && (
//           <ThemedText
//             weight="400"
//             style={{ fontSize: 12, color: theme.colors.warning }}
//           >
//             Password is required
//           </ThemedText>
//         )}
//       </View>

//       {/* ── Forgot password ── */}
//       <View>
//         <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
//           <ThemedText
//             weight="400"
//             style={{
//               fontSize: 12,
//               color: theme.colors.accent,
//               textAlign: "right",
//             }}
//           >
//             Forgot password?
//           </ThemedText>
//         </Pressable>
//       </View>

//       {/* ── Divider ── */}
//       <View
//         style={{
//           flexDirection: "row",
//           alignItems: "center",
//           gap: 10,
//           marginVertical: 4,
//         }}
//       >
//         <View
//           style={{ flex: 1, height: 0.5, backgroundColor: theme.colors.border }}
//         />
//         <ThemedText
//           weight="400"
//           style={{ fontSize: 12, color: theme.colors.textMuted }}
//         >
//           or
//         </ThemedText>
//         <View
//           style={{ flex: 1, height: 0.5, backgroundColor: theme.colors.border }}
//         />
//       </View> */}

//       {/* ── Google Sign In ── */}
//        <Pressable
//         onPress={handleGoogleSignIn}
//         disabled={googleLoading || isLoading}
//         style={({ pressed }) => ({
//           flexDirection: "row",
//           alignItems: "center",
//           justifyContent: "center",
//           gap: 10,
//           paddingVertical: 14,
//           paddingHorizontal: 20,
//           borderRadius: theme.radius.md,
//           borderWidth: 1,
//           borderColor: theme.colors.border,
//           backgroundColor: pressed
//             ? theme.colors.background
//             : theme.colors.card,
//           opacity: googleLoading || isLoading ? 0.6 : 1,
//         })}
//       >
//         {googleLoading ? (
//           <ActivityIndicator size="small" color={theme.colors.textMuted} />
//         ) : (
//           // Simple "G" logo — avoids any native SVG dependency
//           <View
//             style={{
//               width: 20,
//               height: 20,
//               borderRadius: 10,
//               backgroundColor: "#4285F4",
//               alignItems: "center",
//               justifyContent: "center",
//             }}
//           >
//             <ThemedText weight="600" style={{ fontSize: 12, color: "#fff" }}>
//               G
//             </ThemedText>
//           </View>
//         )}
//         <ThemedText
//           weight="400"
//           style={{ fontSize: 15, color: theme.colors.text }}
//         >
//           {googleLoading ? "Opening Google…" : "Continue with Google"}
//         </ThemedText>
//       </Pressable>
//     </AuthFormLayout>
//   );
// };

// export default SignIn;

// That error means Cognito doesn't have `reactnativeomninexos://` registered as an allowed callback URL yet. It's a Cognito console config issue, not a code issue.

// Go to:

// **AWS Console → Cognito → User Pools → your pool → App clients → your app client → Hosted UI → Edit**

// Add to **Allowed callback URLs:**
// ```
// reactnativeomninexos://
// ```

// Add to **Allowed sign-out URLs:**
// ```
// reactnativeomninexos://
// ```

// Then in your `amplify_outputs.json` add the same to both arrays:
// ```json
// "redirect_sign_in_uri": [
//   "http://localhost:5173/landing",
//   "https://...",
//   "reactnativeomninexos://"
// ],
// "redirect_sign_out_uri": [
//   "http://localhost:5173/",
//   "https://...",
//   "reactnativeomninexos://"
// ]
// ```

// Save in Cognito, rebuild the app (`npx expo start --clear`), and it will work.
