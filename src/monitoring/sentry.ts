// src/monitoring/sentry.ts
//
// Crash reporting. Safe no-op until BOTH are true:
//   1. `npx expo install @sentry/react-native` has been run, and
//   2. EXPO_PUBLIC_SENTRY_DSN is set (EAS secret or .env).
// Nothing is reported from development builds.
let Sentry: any = null;
try {
  // Optional dependency: Metro allows a require inside try/catch.
  Sentry = require("@sentry/react-native");
} catch {
  Sentry = null;
}

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
let started = false;

export function initMonitoring() {
  if (started || !Sentry || !DSN || __DEV__) return;
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.1,
    sendDefaultPii: false, // employee data: never attach user details automatically
  });
  started = true;
}

export function captureException(
  error: unknown,
  extra?: Record<string, unknown>,
) {
  if (!started || !Sentry) return;
  Sentry.captureException(error, extra ? { extra } : undefined);
}

export function setMonitoringUser(id: string | null) {
  if (!started || !Sentry) return;
  Sentry.setUser(id ? { id } : null);
}
