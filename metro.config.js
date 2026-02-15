// metro.config.js
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const config = {
  resolver: {
    sourceExts: ['jsx', 'js', 'ts', 'tsx', 'json'], // ✅ Tambahkan ts & tsx
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
