import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** Initialize Sentry when a DSN is configured. Safe to call unconditionally. */
export function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 1,
    enableNativeFramesTracking: true,
  });
}

export { Sentry };
