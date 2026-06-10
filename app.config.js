const pkg = require('./package.json')
const { execSync } = require('node:child_process')

const appVersion = pkg.version
const releaseVersion =
  process.env.RELEASE_VERSION ||
  process.env.OTA_RELEASE_VERSION ||
  process.env.APP_RELEASE_VERSION ||
  appVersion
const runtimeVersion = 'native-2026-03-27.1'
function resolveGitCommit() {
  const fromEnv =
    process.env.EAS_BUILD_GIT_COMMIT_HASH ||
    process.env.EAS_UPDATE_GIT_COMMIT_HASH ||
    process.env.GIT_COMMIT_HASH
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'local'
  }
}

const buildCommit =
  resolveGitCommit()
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
    // Keep legacy IDs stable for App Store/Android upgrades across organization rebrands.
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
    plugins: ['expo-router', 'expo-notifications'],
    extra: {
      apiBaseUrl: 'https://agent-native.im',
      eas: {
        projectId: 'b318235c-68da-4c80-916f-03920d2400f7',
      },
      router: {},
      release: {
        version: releaseVersion,
        releaseVersion,
        appVersion,
        runtimeVersion,
        commit: buildCommit,
        buildTime,
      },
    },
    owner: 'wuhumanxiu',
    runtimeVersion,
    updates: {
      url: 'https://u.expo.dev/b318235c-68da-4c80-916f-03920d2400f7',
      checkAutomatically: 'NEVER',
      fallbackToCacheTimeout: 0,
    },
  },
}
