# iOS Release And OTA Troubleshooting

This document captures the reusable lessons from the `ANI 1.6.3` iOS release.
It is intentionally written as an operational playbook rather than a one-off incident log.

## Scope

Use this guide when:

- an iOS App Store build succeeds but App Store Connect submission fails
- EAS Update behaves inconsistently on installed devices
- native push has been added or changed
- a new production build is intended to become the stable OTA base

## Core Release Model

ANI now uses two release layers:

1. Native App Store build
2. EAS Update OTA bundle

The correct mental model is:

- native builds define the runtime boundary
- OTA updates can only apply to builds with a matching `runtimeVersion`
- native capability changes still require a new App Store build

Current production runtime baseline:

- app version: `1.6.3`
- runtime version: `native-2026-03-27.1`

## What Requires A New Native Build

Do not rely on OTA alone when any of the following changes:

- `expo-notifications` or native push setup
- iOS entitlements / capabilities
- bundle identifier configuration
- Expo SDK version
- native plugin configuration in `app.config.js`
- any new native module

These require a fresh App Store build.

## What Can Continue Through OTA

Once the stable native build is live, the following should continue via EAS Update:

- React / Expo JS logic
- screen layout and styling
- most business logic changes
- copy and localization
- list rendering and conversation UX refinements

## Required Apple Configuration For Push

If native push is enabled, confirm all of the following before building:

1. `Push Notifications` is enabled for the App ID in Apple Developer
2. the active App Store provisioning profile includes `Push Notifications`
3. the provisioning profile includes the `aps-environment` entitlement
4. Expo/EAS credentials have been refreshed after any Apple-side profile change

Important operational rule:

- enabling push on the App ID is not enough
- if EAS still uses an older provisioning profile snapshot, builds will continue to fail

## Required Expo / EAS Configuration

### Production build

`eas.json` should have:

- a `production` build profile
- `channel: production`
- `autoIncrement: true`

### Submit configuration

`eas.json` submit config should include:

- `submit.production.ios.ascAppId`

Expo will typically use the App Store Connect API key stored on EAS servers for submit.

## Production OTA Reliability Rule

The embedded JS bundle inside the production App Store build must already include startup update checks.

ANI now expects startup logic to perform:

- `Updates.checkForUpdateAsync()`
- `Updates.fetchUpdateAsync()`
- `Updates.reloadAsync()`

Without this, OTA behavior may appear inconsistent and users may incorrectly rely on repeated force-quit / cold-start cycles.

## Recommended Release Sequence

### 1. Validate locally

```bash
npm test
npx expo export --platform ios --output-dir /tmp/ani-ios-release-check
```

### 2. Refresh Apple-side credentials if push changed

If push capability or profile contents changed:

```bash
eas credentials:configure-build -p ios
```

Use this to force EAS to re-sync credentials and provision a fresh App Store profile when needed.

### 3. Build

```bash
eas build --platform ios --profile production --auto-submit --non-interactive
```

### 4. Confirm build status

A successful build must reach:

- `FINISHED`

If the build fails before submission, do not debug App Store Connect first. Fix the build pipeline first.

### 5. Confirm submission status

Submission must reach:

- `FINISHED`

If build is `FINISHED` but submission is not, treat this as a submission-layer problem, not a build problem.

## Common Failure Modes

### 1. Build fails with missing push entitlement

Typical error:

- provisioning profile does not support `Push Notifications`
- provisioning profile does not include `aps-environment`

Meaning:

- EAS is still using an old App Store profile

Fix:

1. verify `Push Notifications` is enabled on the App ID
2. delete the stale App Store provisioning profile in Apple Developer if necessary
3. create a fresh App Store profile with push enabled
4. run `eas credentials:configure-build -p ios`
5. rebuild

### 2. Submit fails with missing required agreement

Typical Expo submission error:

- `SUBMISSION_SERVICE_IOS_MISSING_REQUIRED_AGREEMENT`

Meaning:

- Apple is rejecting the App Store Connect upload because required agreements, tax, banking, or related account state are incomplete

Fix:

1. check `App Store Connect -> Agreements, Tax, and Banking`
2. ensure the company account holder has completed any required agreements
3. retry submit against the already successful build

Important:

- this is not solved by rebuilding if the build already succeeded

### 3. Submit keeps failing but build succeeded

If build is good and submit still fails:

- retry `eas submit` against the successful build ID
- verify the current submission moves beyond immediate `ERRORED`
- only fall back to manual upload if Expo submit remains blocked after Apple-side account state is confirmed

Recommended retry command:

```bash
eas submit --platform ios --id <successful-build-id> --non-interactive --wait --verbose --verbose-fastlane
```

## Operational Lessons From ANI 1.6.3

These are the rules worth preserving:

- treat provisioning profile problems and App Store agreement problems as separate layers
- do not conflate a successful build with a successful App Store submission
- when push capability changes, refresh EAS credentials explicitly
- once a new stable native build ships, use it as the base for future OTA updates
- do not assume device reinstall proves OTA correctness; reinstall only restores the embedded native bundle first

## Recommended Ongoing Policy

Use the following release policy going forward:

- ship native builds only when native capabilities change or when a new stable OTA base is needed
- ship ordinary product iteration through EAS Update
- keep `runtimeVersion` stable until a true native boundary changes
- test OTA behavior on a device already running the latest production native build

## Related Docs

- [VERSIONING.md](dev/agent-native-im-mobile/docs/VERSIONING.md)
- [APP_STORE_CURRENT.md](dev/agent-native-im-mobile/docs/APP_STORE_CURRENT.md)
- [APP_STORE_RELEASE_1.6.2.md](dev/agent-native-im-mobile/docs/APP_STORE_RELEASE_1.6.2.md)
