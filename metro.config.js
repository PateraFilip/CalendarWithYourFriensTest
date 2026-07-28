const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const upstreamResolveRequest = config.resolver.resolveRequest;

// Workaround: Metro on Windows sometimes fails to resolve `./utils`
// inside expo-image-picker/build/ImagePicker.js even though utils.js exists.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = (context.originModulePath || '').replace(/\\/g, '/');
  if (
    moduleName === './utils' &&
    origin.includes('expo-image-picker/build/ImagePicker')
  ) {
    return {
      type: 'sourceFile',
      filePath: path.join(path.dirname(context.originModulePath), 'utils.js'),
    };
  }

  if (typeof upstreamResolveRequest === 'function') {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
