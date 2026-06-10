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

- app version: `1.6.4`
- runtime version: `native-2026-03-27.1`
- EAS project: `@wuhumanxiu/agent-native-im-mobile`
- EAS project id: `b318235c-68da-4c80-916f-03920d2400f7`
- iOS bundle identifier: `com.wuzhiai.ani`
- App Store Connect app id: `6760842475`
- Apple Team: `95998WP7YU` / `Wuhu Manxiu Technology Co., Ltd`

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

Current EAS Submit API key:

- Key ID: `QJW9LN8XAJ`
- Issuer ID: `032680d1-0935-4b2d-8163-e38a341579a4`
- private key: stored locally outside Git under `apple-store-connect-api/` and uploaded to EAS servers

Do not commit `.p8` files or paste their contents into logs, docs, or chat.

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

### 4. Submit fails because the version train is closed

Typical errors:

- `ITMS-90186: Invalid Pre-Release Train`
- `ITMS-90062: CFBundleShortVersionString ... must contain a higher version`

Meaning:

- App Store Connect already closed the submitted version train after a previously approved release.
- Incrementing only `buildNumber` is not enough.

Fix:

1. create a higher App Store version in App Store Connect
2. bump `package.json` so `CFBundleShortVersionString` is higher
3. keep `runtimeVersion` unchanged unless the native compatibility boundary changed
4. rebuild and submit the new binary

### 5. Submit warns about keychain access after app transfer

Typical warning:

- `ITMS-90076: Potential Loss of Keychain Access`

Meaning:

- the App Store build is signed by the new Apple Team after an app transfer
- the application identifier changed from old Team ID + Bundle ID to new Team ID + Bundle ID
- iOS keychain access groups are Team-ID scoped

Expected impact:

- this is not a blocking delivery error
- users upgrading from a build signed by the old Team may lose keychain-stored session data
- users may need to sign in again once after updating

## Operational Lessons From ANI 1.6.3

These are the rules worth preserving:

- treat provisioning profile problems and App Store agreement problems as separate layers
- do not conflate a successful build with a successful App Store submission
- when App Store Connect rejects a build with `ITMS-90186` / `ITMS-90062`, create or use a higher App Store version and bump `CFBundleShortVersionString`; incrementing only buildNumber is not enough once that version train is closed
- when push capability changes, refresh EAS credentials explicitly
- once a new stable native build ships, use it as the base for future OTA updates
- do not assume device reinstall proves OTA correctness; reinstall only restores the embedded native bundle first

## Wuhu Manxiu Account Migration 2026-06-10

The mobile EAS project was re-created under the `wuhumanxiu` Expo organization instead of transferring the old `flagify` project.

Current migration facts:

- old EAS project: `@flagify/agent-native-im-mobile`
- old EAS project id: `72831474-137d-4003-ba89-592810a97906`
- new EAS project: `@wuhumanxiu/agent-native-im-mobile`
- new EAS project id: `b318235c-68da-4c80-916f-03920d2400f7`
- new production update group: `7d569bea-7e7d-45c1-b4ab-37200d447e58`
- new iOS production update id: `019eaf9c-570b-771e-984e-2bd46fd632fe`
- production channel is explicitly mapped to the `production` branch
- iOS production build id: `6cb3bfdd-31d6-4cb7-8800-2ec27cb9389b`
- iOS IPA: `https://expo.dev/artifacts/eas/eqwZfdWXNHPwTUgzUyjbLK.ipa`
- iOS submission id: `7353a30e-e453-4b3f-8f2d-126b64dbc133`
- App Store Connect TestFlight URL: `https://appstoreconnect.apple.com/apps/6760842475/testflight/ios`

The initial `1.6.3` submission was rejected by App Store Connect because version train `1.6.3` was already closed after a previously approved build. The fix was to create App Store version `1.6.4`, bump `CFBundleShortVersionString` through `package.json`, rebuild, and submit the new binary:

- fixed app version: `1.6.4`
- fixed iOS build id: `e295e6fa-4a47-468e-9b2f-aad631bd446f`
- fixed build number: `5`
- fixed IPA: `https://expo.dev/artifacts/eas/tYPT4vK7EWhA47zh3sjeHz.ipa`
- fixed iOS submission id: `1afce19e-9557-4895-a30f-78fa1bb5cde9`
- fixed git commit: `40c7c555efcf8fd5bbee1a934156a45757fdb13d`

Credentials verified during migration:

- Distribution Certificate serial: `61976E05266077A8294FF794757BF64D`
- Provisioning Profile Developer Portal ID: `L3LQVR5B7K`
- Provisioning Profile status: `active`
- credentials expiration: `2027-06-10`

Important boundary:

- builds installed from the old `flagify` EAS project continue to use the old update URL
- builds installed from the new `wuhumanxiu` EAS project use `https://u.expo.dev/b318235c-68da-4c80-916f-03920d2400f7`
- keep the old EAS project available during any transition period for already installed clients

## Recommended Ongoing Policy

Use the following release policy going forward:

- ship native builds only when native capabilities change or when a new stable OTA base is needed
- ship ordinary product iteration through EAS Update
- keep `runtimeVersion` stable until a true native boundary changes
- test OTA behavior on a device already running the latest production native build

## Related Docs

- [VERSIONING.md](VERSIONING.md)
- [APP_STORE_CURRENT.md](APP_STORE_CURRENT.md)
- [APP_STORE_RELEASE_1.6.2.md](APP_STORE_RELEASE_1.6.2.md)
