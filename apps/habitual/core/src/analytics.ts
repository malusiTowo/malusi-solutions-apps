import type { EventMap } from "@repo/analytics";

/**
 * Habitual's typed analytics events. Pass this map to `@repo/analytics` clients
 * (`AnalyticsClient<HabitualEvents>`) to get autocomplete + type-checked
 * `capture` calls across web and mobile.
 */
export interface HabitualEvents extends EventMap {
  onboarding_started: undefined;
  onboarding_completed: undefined;
  habit_created: { color: string; repeatDays: number };
  habit_logged: { habitId: string; xpEarned: number };
  streak_frozen: { habitId: string; cost: number };
  coach_message_sent: { chars: number };
  reward_redeemed: { rewardId: string; cost: number };
}
