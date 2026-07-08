import { Context, Effect, Layer, Schema } from "effect";
import { AiError, type AnyAiModule, AiProvider } from "./types";

/** Registry of AI modules keyed by name. Built per-project from its module set. */
export class AiRegistry extends Context.Tag("@repo/ai/AiRegistry")<
  AiRegistry,
  ReadonlyMap<string, AnyAiModule>
>() {}

export const registryLayer = (modules: ReadonlyArray<AnyAiModule>): Layer.Layer<AiRegistry> =>
  Layer.succeed(AiRegistry, new Map(modules.map((m) => [m.name, m])));

/**
 * Default classifier: scores each module by how many significant words from its
 * description appear in the input text; returns the best match (registration
 * order breaks ties). Projects can route with a provider-backed classifier
 * instead, but this keeps `route` deterministic and API-key-free.
 */
const tokenize = (text: string): ReadonlyArray<string> =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);

export const classify = (text: string, modules: ReadonlyArray<AnyAiModule>): AnyAiModule | null => {
  const words = new Set(tokenize(text));
  let best: AnyAiModule | null = null;
  let bestScore = 0;
  for (const module of modules) {
    const score = tokenize(module.description).reduce((acc, w) => acc + (words.has(w) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = module;
    }
  }
  return best ?? modules[0] ?? null;
};

export interface RouteInput {
  readonly text: string;
  readonly input?: unknown;
}

export interface RouteResult {
  readonly module: string;
  readonly output: unknown;
}

/** The engine: dispatches to registered modules directly or via the classifier. */
export class AiEngine extends Context.Tag("@repo/ai/AiEngine")<
  AiEngine,
  {
    readonly list: Effect.Effect<ReadonlyArray<{ name: string; description: string }>>;
    readonly run: (name: string, input: unknown) => Effect.Effect<unknown, AiError>;
    readonly route: (input: RouteInput) => Effect.Effect<RouteResult, AiError>;
  }
>() {}

export const AiEngineLive: Layer.Layer<AiEngine, never, AiRegistry | AiProvider> = Layer.effect(
  AiEngine,
  Effect.gen(function* () {
    const registry = yield* AiRegistry;
    const provider = yield* AiProvider;

    const runModule = (module: AnyAiModule, input: unknown) =>
      Schema.decodeUnknown(module.input)(input).pipe(
        Effect.mapError(
          (cause) =>
            new AiError({
              reason: "decode",
              message: `Invalid input for module "${module.name}"`,
              cause,
            }),
        ),
        Effect.flatMap((decoded) => module.run(decoded)),
        Effect.provideService(AiProvider, provider),
      );

    const run = (name: string, input: unknown) => {
      const module = registry.get(name);
      if (!module) {
        return Effect.fail(
          new AiError({ reason: "unknown_module", message: `Unknown module "${name}"` }),
        );
      }
      return runModule(module, input);
    };

    const route = (input: RouteInput) => {
      const module = classify(input.text, [...registry.values()]);
      if (!module) {
        return Effect.fail(
          new AiError({ reason: "no_match", message: "No module matched the input" }),
        );
      }
      return runModule(module, input.input ?? input).pipe(
        Effect.map((output) => ({ module: module.name, output })),
      );
    };

    const list = Effect.sync(() =>
      [...registry.values()].map((m) => ({ name: m.name, description: m.description })),
    );

    return { list, run, route };
  }),
);
