// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so workspace packages hot-reload.
config.watchFolders = [workspaceRoot];
// 2. Resolve modules from the app first, then the workspace root. Hierarchical
//    lookup stays ENABLED so Metro can find each workspace package's own deps
//    (e.g. @habitual/core -> @repo/ai) in that package's node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
