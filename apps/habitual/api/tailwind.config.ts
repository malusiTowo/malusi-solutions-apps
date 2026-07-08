import { createTailwindPreset } from "@repo/design/tailwind";
import type { Config } from "tailwindcss";

/** Tailwind v4 still supports a JS config via the `@config` directive in CSS.
 *  Colors/spacing/radii come from the shared design preset. */
export default {
  presets: [createTailwindPreset() as Config],
  content: ["./src/**/*.{ts,tsx}", "../../../packages/ui/src/**/*.{ts,tsx}"],
} satisfies Config;
