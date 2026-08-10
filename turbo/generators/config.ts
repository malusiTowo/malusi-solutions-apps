import type { PlopTypes } from "@turbo/gen";

/**
 * Scaffolding for the "new product in 10 minutes" goal.
 *
 *   pnpm gen package   → a new generic logic brick under packages/<name>
 *   pnpm gen product   → a new product under apps/<name>/{core,api,mobile}
 *
 * Templates live in ./templates and are pre-wired to the shared @repo/* bricks.
 *
 * This generator produces **files only**. `pnpm factory new <name>` wraps it and then
 * provisions the third-party resources (Atlas, Vercel, Sentry, …) and writes the
 * credentials into the app's .env files. Use `pnpm gen product` directly when you
 * want the code without touching any remote service.
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
      {
        // Every generated api app used to hardcode --port 3000, so two products
        // could never run side by side. The factory allocates a free port and
        // passes it in; running the generator by hand prompts for one.
        type: "input",
        name: "devPort",
        message: "Local dev port for the Next.js app:",
        default: "3001",
        validate: (value: string) => {
          const port = Number(value);
          return Number.isInteger(port) && port >= 3000 && port <= 3999
            ? true
            : "Pick a port between 3000 and 3999 that no other product uses";
        },
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
