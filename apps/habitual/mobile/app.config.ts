import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Habitual",
  slug: "habitual",
  scheme: "habitual",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  runtimeVersion: { policy: "fingerprint" },
  updates: {
    // EAS Update / OTA. Fill in once the EAS project is created.
    // url: "https://u.expo.dev/<project-id>",
  },
  ios: {
    bundleIdentifier: "com.malusisolutions.habitual",
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.malusisolutions.habitual",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-updates",
    [
      "expo-notifications",
      {
        color: "#C8F135",
      },
    ],
    [
      "@sentry/react-native/expo",
      {
        organization: "malusi-solutions",
        project: "habitual-mobile",
      },
    ],
  ],
  experiments: {
    // Kept off so `tsc` passes without a prebuild generating route types.
    typedRoutes: false,
  },
  extra: {
    eas: {
      // projectId: "<eas-project-id>",
    },
  },
};

export default config;
