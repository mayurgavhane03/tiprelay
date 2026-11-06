const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const workspace = path.resolve(__dirname, '../../..');
const config = getDefaultConfig(__dirname);
config.watchFolders = [...new Set([...config.watchFolders, workspace])];
config.resolver.blockList = /[/\\](\.local|\.venv|cdk\.out|\.turbo)[/\\]/;
module.exports = config;
