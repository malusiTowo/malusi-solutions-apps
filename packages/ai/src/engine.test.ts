import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { AiEngine, AiEngineLive, registryLayer } from "./engine";
import { AiProvider, defineModule } from "./types";

const echo = defineModule({
  name: "echo",
  description: "Echoes the user message back verbatim",
  model: { provider: "anthropic", model: "test-model", maxTokens: 16 },
  systemPrompt: "You echo input.",
  input: Schema.Struct({ text: Schema.String }),
  output: Schema.Struct({ reply: Schema.String }),
  run: (input) => Effect.succeed({ reply: input.text }),
});

const shout = defineModule({
  name: "shout",
  description: "Returns the message uppercased and loud with exclamation",
  model: { provider: "anthropic", model: "test-model" },
  systemPrompt: "You shout.",
  input: Schema.Struct({ text: Schema.String }),
  output: Schema.Struct({ reply: Schema.String }),
  run: (input) => Effect.succeed({ reply: `${input.text.toUpperCase()}!` }),
});

const FakeProvider = Layer.succeed(AiProvider, {
  generate: () => Effect.succeed({ text: "fake", model: "test-model" }),
  stream: () => Effect.succeed((async function* () {})()),
});

const TestEngine = AiEngineLive.pipe(
  Layer.provide(Layer.merge(registryLayer([echo, shout]), FakeProvider)),
);

const runProgram = <A, E>(program: Effect.Effect<A, E, AiEngine>) =>
  Effect.runPromise(Effect.provide(program, TestEngine));

describe("AiEngine", () => {
  it("runs a registered module by name", async () => {
    const result = await runProgram(
      Effect.flatMap(AiEngine, (engine) => engine.run("echo", { text: "hi" })),
    );
    expect(result).toEqual({ reply: "hi" });
  });

  it("routes to the best-matching module via the classifier", async () => {
    const result = await runProgram(
      Effect.flatMap(AiEngine, (engine) =>
        engine.route({ text: "please shout this uppercased loud message" }),
      ),
    );
    expect(result.module).toBe("shout");
    expect(result.output).toEqual({ reply: "PLEASE SHOUT THIS UPPERCASED LOUD MESSAGE!" });
  });

  it("lists registered modules", async () => {
    const list = await runProgram(Effect.flatMap(AiEngine, (engine) => engine.list));
    const names = list.map((m) => m.name);
    names.sort();
    expect(names).toEqual(["echo", "shout"]);
  });

  it("fails on unknown module", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.provide(
        Effect.flatMap(AiEngine, (engine) => engine.run("missing", {})),
        TestEngine,
      ),
    );
    expect(exit._tag).toBe("Failure");
  });
});
