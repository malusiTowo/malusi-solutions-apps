import { describe, expect, it } from "vitest";
import { createTailwindPreset } from "./tailwind";
import { palette } from "./tokens";
import { createUnistylesTheme } from "./unistyles";

describe("design tokens", () => {
  it("exposes the lime accent", () => {
    expect(palette.accent).toBe("#C8F135");
  });

  it("builds a unistyles theme with mapped colors", () => {
    const theme = createUnistylesTheme();
    expect(theme.colors.background).toBe(palette.black);
    expect(theme.colors.accent).toBe(palette.accent);
    expect(theme.spacing.lg).toBe(16);
  });

  it("supports palette overrides", () => {
    const theme = createUnistylesTheme({ palette: { ...palette, accent: "#FF0000" } });
    expect(theme.colors.accent).toBe("#FF0000");
  });

  it("builds a tailwind preset with px spacing", () => {
    const preset = createTailwindPreset();
    const spacing = preset.theme.extend.spacing as Record<string, string>;
    expect(spacing.lg).toBe("16px");
  });
});
