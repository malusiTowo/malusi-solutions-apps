import type { CodegenConfig } from "@graphql-codegen/cli";

/**
 * Typed documents for the mobile app.
 *
 * Reads the SDL `@habitual/core` emits rather than introspecting a running server,
 * so `pnpm codegen` needs neither a database nor a dev server.
 *
 * Operations are written as inline template literals passed to the generated
 * `graphql()`, and the preset emits only `.ts` — there is never a `.graphql` file
 * for Metro to resolve, which is why `metro.config.js` needs no changes.
 */
const config: CodegenConfig = {
  schema: "../core/schema.graphql",
  documents: ["src/**/*.ts", "src/**/*.tsx", "!src/gql/**"],
  ignoreNoDocuments: true,
  generates: {
    "src/gql/": {
      preset: "client",
      presetConfig: {
        // Two call sites and no fragments — masking would be pure indirection.
        fragmentMasking: false,
      },
      config: {
        // Not cosmetic: the base tsconfig sets `verbatimModuleSyntax` *and*
        // `isolatedModules`, so the default value-import of the types-only package
        // `@graphql-typed-document-node/core` would survive to the bundle and throw.
        useTypeImports: true,
        // `isolatedModules` handles TS `enum` declarations poorly.
        enumsAsConst: true,
        // Note: the generated types describe the documents as written, so they carry
        // no `__typename`, while Apollo injects one into every selection at runtime
        // for its normalized cache. The types are a strict subset of the data, which
        // is safe — just don't expect `__typename` to be reachable from TypeScript.
        scalars: {
          DateTime: "string",
          JSONObject: "Record<string, string>",
        },
      },
    },
  },
};

export default config;
