import { AiProvider, DEFAULT_MODEL, defineModule } from "@repo/ai";
import { Effect, Schema } from "effect";

/**
 * Habitual's AI "coach" module. Skeleton implementation: it calls the provider
 * with a coaching system prompt and returns the reply. The real coach (habit-
 * aware nudges, streak-risk alerts, weekly summaries) is a follow-up — but it
 * plugs into the generic `@repo/ai` engine exactly like this.
 */

export const CoachInput = Schema.Struct({
  text: Schema.String,
  context: Schema.optional(Schema.String),
});
export type CoachInput = typeof CoachInput.Type;

export const CoachOutput = Schema.Struct({
  reply: Schema.String,
});
export type CoachOutput = typeof CoachOutput.Type;

const SYSTEM_PROMPT =
  "You are Habitual's AI coach. You are encouraging, concise, and data-aware. " +
  "Help the user build and keep habits, celebrate streaks, and gently nudge when they slip.";

export const coachModule = defineModule({
  name: "coach",
  description:
    "Habit coaching: motivate the user, suggest habits, warn about streak risk, summarize the week",
  model: { provider: "anthropic", model: DEFAULT_MODEL, maxTokens: 512, temperature: 0.7 },
  systemPrompt: SYSTEM_PROMPT,
  input: CoachInput,
  output: CoachOutput,
  run: (input) =>
    Effect.gen(function* () {
      const provider = yield* AiProvider;
      const response = yield* provider.generate({
        model: { provider: "anthropic", model: DEFAULT_MODEL, maxTokens: 512, temperature: 0.7 },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: input.context ? `${input.context}\n\n${input.text}` : input.text,
          },
        ],
      });
      return { reply: response.text };
    }),
});
