import { darkTheme } from "@repo/design/unistyles";
import { StyleSheet } from "react-native-unistyles";

/**
 * Unistyles registration. Imported once at the app entry (top of the root
 * layout). The theme is generated from the shared `@repo/design` tokens, so
 * every product using Unistyles stays visually consistent by default.
 */
const themes = {
  dark: darkTheme,
};

type AppThemes = typeof themes;

declare module "react-native-unistyles" {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  themes,
  settings: {
    initialTheme: "dark",
  },
});
