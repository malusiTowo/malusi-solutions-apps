import type { HabitualEvents } from "@habitual/core";
import { PostHogProvider, useAnalytics as useAnalyticsBase } from "@repo/analytics/native";
import type { ReactNode } from "react";

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/** Typed analytics hook bound to Habitual's event map. */
export const useAnalytics = () => useAnalyticsBase<HabitualEvents>();

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  if (!apiKey) return <>{children}</>;
  return (
    <PostHogProvider apiKey={apiKey} options={{ host }} autocapture>
      {children}
    </PostHogProvider>
  );
}
