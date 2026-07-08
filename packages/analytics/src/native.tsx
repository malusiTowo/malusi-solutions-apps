import { PostHog, PostHogProvider, usePostHog } from "posthog-react-native";
import { type AnalyticsClient, type AnalyticsConfig, type EventMap, noopAnalytics } from "./core";

/**
 * Native analytics backed by posthog-react-native. Wrap the app in
 * `<PostHogProvider>` (re-exported) and read a typed client via `useAnalytics`.
 */

export function createNativeAnalytics<E extends EventMap>(
  instance: PostHog | undefined,
): AnalyticsClient<E> {
  if (!instance) return noopAnalytics<E>();
  // PostHog RN types require JSON-serializable props; our event maps are looser.
  // oxlint-disable-next-line typescript/no-explicit-any
  type Json = Record<string, any>;
  return {
    capture: (event, properties?) => instance.capture(event as string, properties as Json),
    identify: (distinctId, traits) => instance.identify(distinctId, traits as Json),
    screen: (name, properties) => instance.screen(name, properties as Json),
    reset: () => instance.reset(),
    flush: async () => {
      await instance.flush();
    },
  };
}

/** Construct a PostHog instance for the provider. */
export function createPostHog(config: Partial<AnalyticsConfig>): PostHog | undefined {
  if (!config.apiKey) return undefined;
  return new PostHog(config.apiKey, { host: config.host ?? "https://us.i.posthog.com" });
}

/** Typed hook returning an `AnalyticsClient` for the product's event map. */
export function useAnalytics<E extends EventMap>(): AnalyticsClient<E> {
  const instance = usePostHog();
  return createNativeAnalytics<E>(instance);
}

export { PostHog, PostHogProvider, usePostHog };
