import posthog from "posthog-js";
import { type AnalyticsClient, type AnalyticsConfig, type EventMap, noopAnalytics } from "./core";

/**
 * Web analytics client backed by posthog-js. Call once on the client. Returns a
 * no-op client when no key is configured so callers never branch on env.
 */
export function initWebAnalytics<E extends EventMap>(
  config: Partial<AnalyticsConfig>,
): AnalyticsClient<E> {
  if (!config.apiKey || typeof window === "undefined") return noopAnalytics<E>();

  posthog.init(config.apiKey, {
    api_host: config.host ?? "https://us.i.posthog.com",
    capture_pageview: true,
    loaded: (ph) => {
      if (config.debug) ph.debug();
    },
  });

  return {
    capture: (event, properties?) => posthog.capture(event as string, properties),
    identify: (distinctId, traits) => posthog.identify(distinctId, traits),
    screen: (name, properties) => posthog.capture("$screen", { $screen_name: name, ...properties }),
    reset: () => posthog.reset(),
    flush: async () => {},
  };
}

export { posthog };
