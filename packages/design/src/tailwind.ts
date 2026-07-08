import { fontSize, palette, radii, spacing, tokens, type Tokens } from "./tokens";

type TailwindPreset = {
  theme: {
    extend: Record<string, unknown>;
  };
};

/**
 * Build a Tailwind preset from design tokens. Web apps add the returned object
 * to `presets: []` in their `tailwind.config.ts`. Tailwind v4 still supports JS
 * config via the `@config` directive, so this keeps a single source of truth
 * for colors/spacing/radii across web.
 */
export function createTailwindPreset(overrides?: Partial<Tokens>): TailwindPreset {
  const t = { ...tokens, ...overrides };
  const px = (map: Record<string, number>) =>
    Object.fromEntries(Object.entries(map).map(([k, v]) => [k, `${v}px`]));

  return {
    theme: {
      extend: {
        colors: {
          background: t.palette.black,
          surface: t.palette.surface,
          "surface-elevated": t.palette.surfaceElevated,
          "surface-muted": t.palette.surfaceMuted,
          border: t.palette.border,
          foreground: t.palette.textPrimary,
          "muted-foreground": t.palette.textSecondary,
          accent: {
            DEFAULT: t.palette.accent,
            muted: t.palette.accentMuted,
            foreground: t.palette.onAccent,
          },
          purple: t.palette.purple,
          orange: t.palette.orange,
          blue: t.palette.blue,
          pink: t.palette.pink,
          success: t.palette.success,
          warning: t.palette.warning,
          danger: t.palette.danger,
        },
        borderRadius: px(t.radii),
        spacing: px(t.spacing),
        fontSize: Object.fromEntries(Object.entries(t.fontSize).map(([k, v]) => [k, `${v}px`])),
      },
    },
  };
}

export { palette, spacing, radii, fontSize };
