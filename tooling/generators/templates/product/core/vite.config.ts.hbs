import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      // Emits schema.graphql from the Pothos schema. Deliberately needs no env
      // and no database (scripts/schema.ts avoids runtime.ts), so the filtered
      // task environment is a feature here, not a constraint.
      codegen: {
        command: "tsx scripts/schema.ts",
        // Explicit output so a cache hit restores the committed artifact —
        // CI's codegen drift check diffs it, so it must always materialize.
        output: ["schema.graphql"],
      },
      typecheck: {
        command: "tsc --noEmit",
        dependsOn: ["codegen"],
      },
    },
  },
});
