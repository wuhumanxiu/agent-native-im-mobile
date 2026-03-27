const pkg = require('./package.json')

const appVersion = pkg.version
const runtimeVersion = 'native-2026-03-27.1'
const buildCommit =
  process.env.EAS_BUILD_GIT_COMMIT_HASH ||
  process.env.GIT_COMMIT_HASH ||
  'local'
const buildTime = process.env.BUILD_TIME || new Date().toISOString()

module.exports = {
  expo: {
    name: 'ANI',
    slug: 'agent-native-im-mobile',
    version: appVersion,
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    scheme: 'ani',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.wuzhiai.ani',
      buildNumber: '3',
      infoPlist: {
        NSMicrophoneUsageDescription: 'Used for voice messages',
        NSCameraUsageDescription: 'Used to take photos for chat',
        NSPhotoLibraryUsageDescription: 'Used to attach photos to messages',
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.wuzhiai.ani',
      versionCode: 3,
      adaptiveIcon: {
        backgroundColor: '#6366f1',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      permissions: ['RECORD_AUDIO', 'CAMERA', 'READ_EXTERNAL_STORAGE'],
    },
    web: {
      bundler: 'metro',
      favicon: './assets/favicon.png',
    },
    plugins: ['expo-router'],
    extra: {
      apiBaseUrl: 'https://agent-native.im',
      eas: {
        projectId: '72831474-137d-4003-ba89-592810a97906',
      },
      router: {},
      release: {
        appVersion,
        runtimeVersion,
        commit: buildCommit,
        buildTime,
      },
    },
    owner: 'flagify',
    runtimeVersion,
    updates: {
      url: 'https://u.expo.dev/72831474-137d-4003-ba89-592810a97906',
    },
  },
}
