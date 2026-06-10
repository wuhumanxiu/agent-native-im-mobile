# Android APK Startup Crash Incident - 2026-06

This document records the June 2026 Android production APK startup crash
investigation and the reusable checks for future Android/OPPO/Huawei startup
reports.

## Summary

- Affected package: `com.wuzhiai.ani`
- Affected release path: Android `production-apk`
- Reported symptom: users saw black screen or immediate crash on startup,
  initially reported on OPPO devices.
- Reproduced device during investigation: Huawei `ICL-AL20`, Android 12.
- Confirmed root cause: an incomplete local auth session could contain
  `aim_token` without `aim_entity`. The app treated that as logged in, rendered
  the tab layout, and `InboxTab` read `me.id` from a null entity.
- Fix type: JS/TS app logic. It can be shipped by OTA for matching runtime
  clients, but a fresh APK is still required for users who install directly or
  cannot reliably receive the OTA before startup.

## What Was Not The Root Cause

The first suspicion was Android native startup and `expo-updates`, because the
failure looked like a first-frame black screen or crash. The app did receive a
startup hardening pass, but that did not fix the device crash by itself.

Commit `0211899 fix: harden android startup hydration` still remains useful:

- Android no longer depends on `expo-secure-store` during startup auth
  hydration.
- Native storage hydration reads only `aim_token` and `aim_entity`.
- Storage reads have a timeout.
- `auth.hydrate` catches hydration failures.
- `app/index.tsx` renders a loading indicator instead of returning `null`.
- Notification setup is guarded.

However, versionCode 5 built from that commit still crashed on the test phone.

## Evidence

Device state during investigation:

```bash
adb devices -l
adb shell getprop ro.product.manufacturer
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
adb shell dumpsys package com.wuzhiai.ani | rg "versionCode|versionName|lastUpdateTime"
```

The crashing APK was installed as:

- `versionName=1.6.4`
- `versionCode=5`

Starting the app through adb succeeded at the native Activity level:

```bash
adb shell am start -W -n com.wuzhiai.ani/.MainActivity
```

Dropbox/logcat showed the real failure as a React Native JS exception:

```text
com.facebook.react.common.JavascriptException: TypeError: Cannot read property 'id' of null
This error is located at:
  at InboxTab
  at TabLayout
  at RootLayout
```

That stack points to app state and routing, not to `expo-updates` or a native
Android crash.

## Root Cause

The app could restore a token without a matching entity:

- `aim_token` existed in local storage.
- `aim_entity` was missing, null, corrupt, or unavailable during hydration.
- Routing logic treated `token` as sufficient for authenticated UI.
- Tab UI mounted.
- `InboxTab` used the auth entity as non-null and read `me.id`.
- JS crashed before the user could recover.

The practical trigger was a stale or incomplete local session on the device.
This explains why clearing data, reinstalling from scratch, or logging out could
appear to change the behavior, while reinstalling over existing data preserved
the crash.

## Fix

Commit `46aeebe fix: clear incomplete mobile sessions` fixed the crash path:

- `src/store/auth.ts` clears `aim_token` and `aim_entity` when hydration restores
  a token without an entity.
- The auth store then sets `token=null`, `entity=null`, and
  `sessionChecked=true`.
- The tab layout does not render child tabs unless both `token` and `entity`
  exist.
- A regression test covers incomplete restored sessions.

The expected user result is a safe redirect to the login screen instead of a JS
crash.

## Release Artifacts

OTA update for the JS-only fix:

- Branch: `production`
- Message: `Clear incomplete mobile sessions`
- Update group: `c8bca920-0222-4877-8479-cd701ceb45d6`
- Android update ID: `019eb0a7-da91-7a0d-a655-c91be0f7144b`
- iOS update ID: `019eb0a7-da91-7b21-9d4b-ed16d28f6a9c`
- Runtime: `native-2026-03-27.1`
- Commit: `46aeebe147306b7177161bd297a66981cc26f312`

Fresh Android production APK:

- Build ID: `a3c25c73-7ef1-4067-96e2-3cc1f3b1cccd`
- APK: `https://expo.dev/artifacts/eas/mdRKNiQSAXXT37qdMgGpaX.apk`
- Build page:
  `https://expo.dev/accounts/wuhumanxiu/projects/agent-native-im-mobile/builds/a3c25c73-7ef1-4067-96e2-3cc1f3b1cccd`
- Profile: `production-apk`
- Channel: `production`
- Version: `1.6.4`
- VersionCode: `6`
- Runtime: `native-2026-03-27.1`
- Commit: `46aeebe147306b7177161bd297a66981cc26f312`

## Validation

Repo validation for `46aeebe`:

```bash
npm test
npx tsc --noEmit --pretty false
npx expo export --platform android --output-dir /tmp/ani-android-incomplete-session-check
```

Device validation after installing versionCode 6:

```bash
adb shell dumpsys package com.wuzhiai.ani | rg "versionCode|versionName|lastUpdateTime"
adb logcat -c
adb shell am force-stop com.wuzhiai.ani
adb shell am start -W -n com.wuzhiai.ani/.MainActivity
sleep 8
adb shell pidof com.wuzhiai.ani
adb logcat -d -t 1200 | rg -i "ReactNativeJS|JavascriptException|FATAL EXCEPTION|AndroidRuntime|Cannot read property|InboxTab|TypeError|ANR"
```

Observed result:

- Installed package reported `versionCode=6`, `versionName=1.6.4`.
- Cold start returned `Status: ok` and `LaunchState: COLD`.
- The app stayed alive.
- The UI reached the login screen.
- No `JavascriptException`, `Cannot read property 'id' of null`, `InboxTab`,
  `FATAL EXCEPTION`, or `ANR` appeared in the filtered startup logs.

## APK Install Note For Huawei/HarmonyOS Test Devices

During local validation, `adb install -r` appeared to hang while the device was
locked. The APK transfer had already succeeded, but the Huawei system installer
was waiting in `com.android.packageinstaller/.InstallStaging` behind the
lockscreen/security UI.

Useful checks:

```bash
adb shell dumpsys window | rg "mDreamingLockscreen|mCurrentFocus|mFocusedApp"
adb shell dumpsys package sessions | rg -A 30 "Active install sessions"
```

If the focus shows `InstallStaging` while `mDreamingLockscreen=true`, unlock the
phone and approve the system prompt such as continue install or allow USB
install. After the phone was unlocked and the prompt approved, this command
completed immediately:

```bash
adb install -r /tmp/ani-production-v6.apk
```

Do not confuse a black adb screenshot caused by lockscreen/AOD with an app
black screen. Confirm focus, wakefulness, process state, and logcat before
classifying the issue.

## Future Triage Checklist

For any Android startup black screen or crash report:

1. Confirm installed build metadata.

   ```bash
   adb shell dumpsys package com.wuzhiai.ani | rg "versionCode|versionName|lastUpdateTime"
   ```

2. Clear logs, cold start, then collect focused crash output.

   ```bash
   adb logcat -c
   adb shell am force-stop com.wuzhiai.ani
   adb shell am start -W -n com.wuzhiai.ani/.MainActivity
   sleep 8
   adb logcat -d -t 1200 | rg -i "ReactNativeJS|JavascriptException|FATAL EXCEPTION|AndroidRuntime|TypeError|ANR"
   ```

3. Check whether the screen is actually locked or in notification shade.

   ```bash
   adb shell dumpsys window | rg "mDreamingLockscreen|mCurrentFocus|mFocusedApp"
   ```

4. If the app process is alive and logcat has no fatal JS/native exception, take
   a screenshot before calling it a crash.

   ```bash
   adb exec-out screencap -p > /tmp/ani-startup.png
   ```

5. For auth-related crashes, inspect whether routing can enter authenticated UI
   with only part of the session restored. `token` alone must not be treated as a
   complete authenticated state; mobile tabs require both `token` and `entity`.

