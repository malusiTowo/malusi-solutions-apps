import { fontSize, fontWeight, palette, radii, spacing, tokens, type Tokens } from "./tokens";

/**
 * Build a Unistyles theme object from design tokens. Consumers (Expo apps)
 * register the returned theme(s) with `StyleSheet.configure` from
 * `react-native-unistyles`. This package stays UI-framework-free — it only
 * produces the plain theme object.
 */
export function createUnistylesTheme(overrides?: Partial<Tokens>) {
  const t = { ...tokens, ...overrides };
  return {
    colors: {
      background: t.palette.black,
      surface: t.palette.surface,
      surfaceElevated: t.palette.surfaceElevated,
      surfaceMuted: t.palette.surfaceMuted,
      border: t.palette.border,
      text: t.palette.textPrimary,
      textSecondary: t.palette.textSecondary,
      textMuted: t.palette.textMuted,
      accent: t.palette.accent,
      accentMuted: t.palette.accentMuted,
      onAccent: t.palette.onAccent,
      purple: t.palette.purple,
      orange: t.palette.orange,
      blue: t.palette.blue,
      pink: t.palette.pink,
      success: t.palette.success,
      warning: t.palette.warning,
      danger: t.palette.danger,
    },
    spacing: t.spacing,
    radii: t.radii,
    fontSize: t.fontSize,
    fontWeight: t.fontWeight,
  } as const;
}

export const darkTheme = createUnistylesTheme();

export type AppTheme = ReturnType<typeof createUnistylesTheme>;

export { palette, spacing, radii, fontSize, fontWeight };
