import type { PlopTypes } from "@turbo/gen";

/**
 * Scaffolding for the "new product in 10 minutes" goal.
 *
 *   pnpm gen package   → a new generic logic brick under packages/<name>
 *   pnpm gen product   → a new product under apps/<name>/{core,api,mobile}
 *
 * Templates live in ./templates and are pre-wired to the shared @repo/* bricks,
 * so a new product only needs its env keys filled in to run.
 */
export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setHelper("titleCase", (text: string) =>
    text.replace(/(^|[-_ ])(\w)/g, (_m, _s, c: string) => c.toUpperCase()),
  );

  const kebab = (value: string) =>
    /^[a-z][a-z0-9-]*$/.test(value) ? true : "Use a lowercase kebab-case name (e.g. my-app)";

  plop.setGenerator("package", {
    description: "A new generic package (logic brick) under packages/",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Package name (without @repo/ prefix):",
        validate: kebab,
      },
    ],
    actions: [
      {
        type: "addMany",
        destination: "packages/{{name}}",
        base: "templates/package",
        templateFiles: "templates/package/**/*",
        stripExtensions: ["hbs"],
      },
    ],
  });

  plop.setGenerator("product", {
    description: "A new product (core + api + mobile) under apps/",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Product name (lowercase, e.g. acme):",
        validate: kebab,
      },
    ],
    actions: [
      {
        type: "addMany",
        destination: "apps/{{name}}",
        base: "templates/product",
        templateFiles: "templates/product/**/*",
        stripExtensions: ["hbs"],
        globOptions: { dot: true },
      },
    ],
  });
}
