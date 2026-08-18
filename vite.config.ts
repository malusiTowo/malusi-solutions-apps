import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    plugins: ["typescript", "unicorn", "import", "react"],
    categories: {
      correctness: "error",
      suspicious: "warn",
    },
    env: {
      browser: true,
      es2024: true,
      node: true,
    },
    ignorePatterns: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/.expo/**",
      "**/expo-export/**",
      // Generator templates are Handlebars, not valid TS/JS.
      "**/tooling/generators/templates/**",
      "**/*.gen.ts",
      "**/src/gql/**",
    ],
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      "no-underscore-dangle": "off",
      "typescript/no-explicit-any": "warn",
      "react/react-in-jsx-scope": "off",
    },
  },
  fmt: {
    tabWidth: 2,
    printWidth: 100,
    singleQuote: false,
    semi: true,
    trailingComma: "all",
    ignorePatterns: [
      // Generator templates are Handlebars, not valid TS/JS.
      "tooling/generators/templates/**",
      // drizzle-kit output. Committed, but regenerated verbatim on every
      // `db:generate` — reformatting the snapshots would churn against the next run.
      "**/drizzle/**",
      // GraphQL artifacts. Committed so a fresh clone can build without running
      // codegen first, but rewritten verbatim by `pnpm codegen`.
      "**/src/gql/**",
      "**/schema.graphql",
      // build artifacts (also gitignored)
      "**/.next/**",
      "**/dist/**",
      "**/.expo/**",
      "**/expo-export/**",
      "pnpm-lock.yaml",
    ],
  },
  test: {
    // Mirrors pnpm-workspace.yaml. Any workspace package is a Vitest project, so
    // new packages are covered by `vp test` from birth — no per-package test
    // script or --passWithNoTests needed.
    projects: ["apps/*/*", "packages/*", "tooling/*"],
  },
});
