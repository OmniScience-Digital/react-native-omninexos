//src/services/auth-errors.ts
//
// Turns raw Cognito/Amplify auth errors into short, user-friendly messages.
// Used by: app/(auth)/forgot-password.tsx and app/(auth)/reset-password.tsx
//
// Why: Cognito's raw messages are confusing (e.g. "Cannot reset password for the user
// as there is no registered/verified email or phone_number"). The most common real
// cause in OmniNexos is an account that only ever signed in with Google, which has no
// password to reset, so we say that plainly.

/** Message for errors raised while REQUESTING a reset code (forgot-password screen). */
export function getRequestResetErrorMessage(err: any): string {
  switch (err?.name) {
    case "InvalidParameterException":
    case "NotAuthorizedException":
      // Cognito returns these for Google-only (federated) or unverified-email accounts.
      return 'We couldn\'t send a reset code to this account. If you normally sign in with Google, use "Continue with Google" on the sign-in screen. Otherwise, please contact support.';
    case "UserNotFoundException":
      return "No account was found with this email address.";
    case "LimitExceededException":
    case "TooManyRequestsException":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "NetworkError":
      return "Network error. Check your connection and try again.";
    default:
      return err?.message || "Failed to send reset code. Please try again.";
  }
}

/** Message for errors raised while CONFIRMING the code + new password (reset-password screen). */
export function getConfirmResetErrorMessage(err: any): string {
  switch (err?.name) {
    case "CodeMismatchException":
      return "That code is incorrect. Please check it and try again.";
    case "ExpiredCodeException":
      return 'That code has expired. Tap "Resend code" to get a new one.';
    case "InvalidPasswordException":
      return "Password doesn't meet the requirements. Use at least 8 characters with a mix of letters, numbers and symbols.";
    case "LimitExceededException":
    case "TooManyFailedAttemptsException":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "NetworkError":
      return "Network error. Check your connection and try again.";
    default:
      return err?.message || "Failed to reset password. Please try again.";
  }
}
