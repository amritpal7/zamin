const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname, { isCSSEnabled: true });

config.resolver.platforms = ['ios', 'android', 'web'];

// react-native-maps has no web support — replace with a null stub on web
const mapsStub = path.resolve(__dirname, 'src/stubs/react-native-maps.js');
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return { filePath: mapsStub, type: 'sourceFile' };
  }
  if (defaultResolve) return defaultResolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
