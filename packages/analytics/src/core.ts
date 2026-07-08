/**
 * Generic analytics contract. Products supply their own strongly-typed event
 * map; this package provides the typed `capture` surface and PostHog-backed
 * implementations (web + native) behind it. No product event names live here.
 */

export type EventProperties = Record<string, unknown>;

/** An event map: event name -> its property shape (or `undefined` for no props). */
export type EventMap = Record<string, EventProperties | undefined>;

export type CaptureArgs<E extends EventMap, K extends keyof E> = E[K] extends undefined
  ? [event: K]
  : [event: K, properties: E[K]];

export interface AnalyticsClient<E extends EventMap> {
  capture<K extends keyof E>(...args: CaptureArgs<E, K>): void;
  identify(distinctId: string, traits?: EventProperties): void;
  screen(name: string, properties?: EventProperties): void;
  reset(): void;
  flush(): Promise<void>;
}

export interface AnalyticsConfig {
  readonly apiKey: string;
  readonly host?: string;
  readonly debug?: boolean;
}

/** No-op client, used when analytics is disabled or keys are absent. */
export function noopAnalytics<E extends EventMap>(): AnalyticsClient<E> {
  return {
    capture: () => {},
    identify: () => {},
    screen: () => {},
    reset: () => {},
    flush: async () => {},
  };
}

/** Helper to declare a product's typed event map with inference. */
export function defineEvents<E extends EventMap>(): E {
  return {} as E;
}
