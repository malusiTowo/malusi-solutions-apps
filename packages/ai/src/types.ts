import { Context, Data, type Effect, type Schema } from "effect";

/** Model selection + generation parameters. Passed by the module, never hardcoded in the engine. */
export interface ModelConfig {
  readonly provider: string;
  readonly model: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

export interface ChatMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface GenerateRequest {
  readonly model: ModelConfig;
  readonly system?: string;
  readonly messages: ReadonlyArray<ChatMessage>;
}

export interface GenerateResponse {
  readonly text: string;
  readonly model: string;
  readonly stopReason?: string;
}

export class AiError extends Data.TaggedError("AiError")<{
  readonly reason: "provider" | "unknown_module" | "decode" | "no_match";
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Provider adapter. Anthropic is the default implementation; swapping providers
 * is a matter of supplying a different `AiProvider` layer.
 */
export class AiProvider extends Context.Tag("@repo/ai/AiProvider")<
  AiProvider,
  {
    readonly generate: (request: GenerateRequest) => Effect.Effect<GenerateResponse, AiError>;
    readonly stream: (request: GenerateRequest) => Effect.Effect<AsyncIterable<string>, AiError>;
  }
>() {}

/**
 * A reusable unit of AI behaviour. Projects define modules in their own core
 * package and register them with the engine. The engine validates I/O against
 * the module's schemas and dispatches to `run`.
 */
export interface AiModule<In, Out> {
  readonly name: string;
  readonly description: string;
  readonly model: ModelConfig;
  readonly systemPrompt: string;
  readonly input: Schema.Schema<In>;
  readonly output: Schema.Schema<Out>;
  readonly run: (input: In) => Effect.Effect<Out, AiError, AiProvider>;
}

// `any` (not `unknown`) so modules with concrete I/O schemas remain assignable —
// Effect's `Schema` is invariant in its type parameter.
// oxlint-disable-next-line typescript/no-explicit-any
export type AnyAiModule = AiModule<any, any>;

/** Author a module with full type inference on `run`. */
export function defineModule<In, Out>(module: AiModule<In, Out>): AiModule<In, Out> {
  return module;
}
