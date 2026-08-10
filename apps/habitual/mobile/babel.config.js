module.exports = (api) => {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Unistyles v3 requires its Babel plugin to transform StyleSheet usage.
      [
        "react-native-unistyles/plugin",
        {
          // Routes moved to src/app; this must match or styles go untransformed.
          root: "src",
        },
      ],
      // Reanimated/Worklets plugin must be listed last.
      "react-native-worklets/plugin",
    ],
  };
};
