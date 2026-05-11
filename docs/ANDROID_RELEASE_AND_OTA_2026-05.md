# Android Release And OTA

This document captures the Android release path for the ANI mobile app.
It is the Android counterpart to the iOS release notes and is written as an operational playbook.

## Scope

Use this guide when:

- you want an installable Android APK for internal testing
- you want to verify whether Android builds receive EAS Update hotfixes
- you need to understand when a new APK is required versus when OTA is enough
- you do not have, or do not want to use, Google Play for the current release

## Core Release Model

ANI Android uses the same two-layer model as iOS:

1. Native Android build
2. EAS Update OTA bundle

The correct mental model is:

- the native build defines the compatibility boundary
- OTA updates can only apply to builds with a matching `runtimeVersion`
- native capability changes still require a new APK or AAB

Current Android release baseline:

- app version: `1.6.3`
- runtime version: `native-2026-03-27.1`
- package name: `com.wuzhiai.ani`

## What Build Type To Use

### Internal / test APK

Use this when you want a standard installable Android package without Google Play:

```bash
eas build --platform android --profile preview
```

Current project config:

- `preview` builds an Android `apk`
- `production` builds an Android `app-bundle`

This means the preview profile is the correct path for direct installation on a device.

### Store-ready Android build

Use this only when Google Play distribution is actually needed:

```bash
eas build --platform android --profile production
```

This produces an `AAB`, not a direct-install APK.

## OTA Hot Update Support

Yes, the preview APK supports hot updates as long as all of the following are true:

- the APK was built after EAS Update was configured
- the installed build has the same `runtimeVersion` as the published OTA bundle
- the OTA bundle is published to the matching EAS channel / branch

For this project, Android preview builds are expected to receive JS-only and asset-only updates through EAS Update.

## What Requires A New APK

Do not rely on OTA alone when any of the following changes:

- native Expo or React Native modules
- permissions / entitlements / manifest changes
- Expo SDK upgrades that change native generation
- native plugins in `app.config.js`
- any incompatible runtime boundary change

These require a fresh Android build.

## What Can Continue Through OTA

Once the preview APK is installed, the following should continue via EAS Update:

- UI changes
- copy / translation updates
- routing changes
- state-management changes
- API integration changes that remain backward compatible
- other JS-only fixes

## Recommended Validation Flow

### 1. Validate locally

```bash
npm test
npx expo export --platform android --output-dir /tmp/ani-android-release-check
```

### 2. Build preview APK

```bash
eas build --platform android --profile preview
```

### 3. Install and verify

Check the installed APK for:

- login
- conversation list
- direct chat and group chat
- file upload / download
- settings page version info
- OTA update behavior after publishing a preview update

### 4. Publish an OTA hotfix

```bash
eas update --branch preview --message "Describe the Android hotfix"
```

Keep `runtimeVersion` unchanged for JS-only updates.

## Operational Notes

- `expo start --android` is development mode, not a release APK
- APK testing does not require Google Play
- if a change is native-breaking, build a new APK before expecting OTA to work
- preview APKs are the right artifact for direct installation and manual verification

## Related Docs

- [VERSIONING.md](/Users/donaldford/code/SuperBody/dev/agent-native-im-mobile/docs/VERSIONING.md)
- [IOS_RELEASE_AND_OTA_TROUBLESHOOTING_2026-04.md](/Users/donaldford/code/SuperBody/dev/agent-native-im-mobile/docs/IOS_RELEASE_AND_OTA_TROUBLESHOOTING_2026-04.md)
- [APP_STORE_RELEASE_1.6.2.md](/Users/donaldford/code/SuperBody/dev/agent-native-im-mobile/docs/APP_STORE_RELEASE_1.6.2.md)
