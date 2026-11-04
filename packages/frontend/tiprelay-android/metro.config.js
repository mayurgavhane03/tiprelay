const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');
const workspace = path.resolve(__dirname, '../../..');
module.exports = mergeConfig(getDefaultConfig(__dirname), {
  watchFolders: [workspace],
  resolver: {
    blockList: /[/\\](\.local|\.venv|cdk\.out|\.turbo)[/\\]/,
    nodeModulesPaths: [path.join(workspace, 'node_modules')],
    disableHierarchicalLookup: false,
  },
});
