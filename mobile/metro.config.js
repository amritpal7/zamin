const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname, { isCSSEnabled: true });

config.resolver.platforms = ['ios', 'android', 'web'];

const reactNativeWebPath = path.resolve(__dirname, 'node_modules/react-native-web');

// On web, redirect all react-native imports (root + deep paths) to react-native-web
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    if (moduleName === 'react-native') {
      return { filePath: path.join(reactNativeWebPath, 'dist/index.js'), type: 'sourceFile' };
    }
    if (moduleName.startsWith('react-native/')) {
      const subpath = moduleName.replace('react-native/', '');
      const webEquiv = path.join(reactNativeWebPath, 'dist', subpath);
      try {
        require.resolve(webEquiv);
        return { filePath: webEquiv + '.js', type: 'sourceFile' };
      } catch {
        // No web equiv — return a stub
        return { filePath: path.join(reactNativeWebPath, 'dist/index.js'), type: 'sourceFile' };
      }
    }
  }
  if (defaultResolveRequest) return defaultResolveRequest(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
