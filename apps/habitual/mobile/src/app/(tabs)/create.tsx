import { Redirect } from "expo-router";

// The center "+" opens the new-habit modal directly (see the tab bar button).
// This route only exists to hold the tab slot; visiting it bounces home.
export default function CreatePlaceholder() {
  return <Redirect href="/(tabs)" />;
}
