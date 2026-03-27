# Mobile Versioning

This document defines the release contract for the ANI mobile app.

## Goals

- allow store releases and OTA releases to evolve independently
- keep JS / asset hotfixes available for a full native generation
- only force a new native build when native code, native config, or runtime compatibility changes

## Terms

- app version:
  the user-facing release version shown in App Store / Play and in the app about page
- runtime version:
  the EAS Update compatibility boundary used to decide which OTA bundle a native build can load
- build number:
  the store submission sequence number managed by EAS remote versioning

## Current Policy

- app version: `1.6.2`
- runtime version: `native-2026-03-27.1`
- EAS update branch: `production`

## Rules

1. Bump `app version` when preparing a new App Store / Play submission.
2. Do not bump `runtime version` for JS-only fixes, copy changes, style changes, or API-compatible feature work.
3. Bump `runtime version` only when the shipped native binary would no longer be safely compatible with new OTA bundles.
4. Publish OTA hotfixes on the existing runtime until the next native generation begins.
5. Keep the settings "About" page exposing both app version and runtime version for support and debugging.

## What Requires A Runtime Bump

- adding or removing native Expo / React Native modules
- changing native permissions or entitlements that affect runtime behavior
- upgrading Expo / React Native in a way that changes the native generation
- changing native build configuration that makes old OTA bundles incompatible

## What Does Not Require A Runtime Bump

- UI changes
- copy / translation updates
- routing changes
- state-management changes
- API integration changes that remain backward compatible with the shipped native app
- web / server / OTA-only fixes

## Source Of Truth

The release values are defined in [app.config.js](/Users/donaldford/code/SuperBody/dev/agent-native-im-mobile/app.config.js):

- `package.json` -> app version
- `runtimeVersion` constant -> OTA compatibility boundary
- `extra.release` -> build metadata surfaced in-app

## Release Flow

### Native Store Release

1. bump `package.json` version
2. keep or bump `runtimeVersion` depending on compatibility
3. run local validation
4. trigger `eas build --platform ios --profile production`
5. submit the resulting build to App Store Connect

### OTA Hotfix

1. keep `package.json` version unchanged
2. keep `runtimeVersion` unchanged
3. validate JS / asset changes
4. publish `eas update --branch production --message "..."`

## Current Native Generation

The current native generation starts at:

- app version `1.6.2`
- runtime version `native-2026-03-27.1`

All non-native changes for this generation should continue shipping on that runtime until a deliberate native-breaking change is introduced.
