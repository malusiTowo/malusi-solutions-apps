import Anthropic from "@anthropic-ai/sdk";
import { Effect, Layer } from "effect";
import { AiError, AiProvider, type GenerateRequest, type GenerateResponse } from "../types";

/**
 * Default Anthropic provider adapter. The engine and modules are provider-
 * agnostic; this is the concrete implementation wired in by apps. Model ids and
 * parameters come from each module's `ModelConfig`, not from here.
 */
export const anthropicProvider = (apiKey: string) => {
  const client = new Anthropic({ apiKey });

  const generate = (request: GenerateRequest): Effect.Effect<GenerateResponse, AiError> =>
    Effect.tryPromise({
      try: async () => {
        const response = await client.messages.create({
          model: request.model.model,
          max_tokens: request.model.maxTokens ?? 1024,
          temperature: request.model.temperature,
          system: request.system,
          messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        });
        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("");
        return { text, model: response.model, stopReason: response.stop_reason ?? undefined };
      },
      catch: (cause) =>
        new AiError({ reason: "provider", message: "Anthropic request failed", cause }),
    });

  const stream = (request: GenerateRequest): Effect.Effect<AsyncIterable<string>, AiError> =>
    Effect.try({
      try: () => {
        const runner = client.messages.stream({
          model: request.model.model,
          max_tokens: request.model.maxTokens ?? 1024,
          temperature: request.model.temperature,
          system: request.system,
          messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        });
        async function* chunks() {
          for await (const event of runner) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              yield event.delta.text;
            }
          }
        }
        return chunks();
      },
      catch: (cause) =>
        new AiError({ reason: "provider", message: "Anthropic stream failed", cause }),
    });

  return { generate, stream };
};

/** Layer that reads `ANTHROPIC_API_KEY` from the environment. */
export const AnthropicLive: Layer.Layer<AiProvider> = Layer.sync(AiProvider, () =>
  anthropicProvider(process.env.ANTHROPIC_API_KEY ?? ""),
);

/** Default recommended model for new modules. */
export const DEFAULT_MODEL = "claude-opus-4-8";
