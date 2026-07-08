/**
 * Cross-platform design tokens.
 *
 * These are the raw, platform-agnostic values that feed both the Unistyles
 * theme (native) and the Tailwind preset (web). Values are sampled from the
 * Habitual mockup but are intentionally generic — any product can override
 * them via `createUnistylesTheme` / `createTailwindPreset`.
 */

export const palette = {
  // near-black surfaces
  black: "#0A0A0A",
  surface: "#141414",
  surfaceElevated: "#1C1C1E",
  surfaceMuted: "#242426",
  border: "#2A2A2C",

  // text
  textPrimary: "#FFFFFF",
  textSecondary: "#A1A1AA",
  textMuted: "#6B6B70",

  // brand — lime accent
  accent: "#C8F135",
  accentMuted: "#9BB82A",
  onAccent: "#0A0A0A",

  // secondary accents (from mockup rings / badges)
  purple: "#8B7CF6",
  orange: "#F5A623",
  blue: "#4FB0F0",
  pink: "#F27CA5",

  // semantic
  success: "#4ADE80",
  warning: "#F5A623",
  danger: "#F87171",

  white: "#FFFFFF",
  transparent: "transparent",
} as const;

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
  "4xl": 64,
} as const;

export const radii = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
  "5xl": 48,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
} as const;

export type FontWeightValue = "400" | "500" | "600" | "700" | "800";

export type Palette = Record<keyof typeof palette, string>;
export type Spacing = Record<keyof typeof spacing, number>;
export type Radii = Record<keyof typeof radii, number>;
export type FontSize = Record<keyof typeof fontSize, number>;
// Keep the literal union so values stay assignable to RN's `TextStyle.fontWeight`.
export type FontWeight = Record<keyof typeof fontWeight, FontWeightValue>;

export interface Tokens {
  palette: Palette;
  spacing: Spacing;
  radii: Radii;
  fontSize: FontSize;
  fontWeight: FontWeight;
}

export const tokens: Tokens = {
  palette,
  spacing,
  radii,
  fontSize,
  fontWeight,
};
