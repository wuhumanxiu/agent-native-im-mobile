# Web To Mobile Parity Review 2026-05-18

This note records the WUZ-31 review of recent ANI Web/PWA changes against the mobile app.

## Summary

Mobile already carries the core product model from the recent Web work: five-tab navigation, conversation settings, bot identity management, inbox, friend workflows, release diagnostics, onboarding surfaces, and message forwarding.

The remaining work should be selective. Marketing and developer-documentation pages belong to Web/docs, while mobile should preserve the same user workflows with touch-first screens.

## Parity Decisions

| Web/PWA area | Mobile status | Decision |
| --- | --- | --- |
| Public landing page and WeChat verification | Not applicable in app | Keep on Web/docs only. Do not add a landing page to the installed app. |
| Developer guide and docs entry points | Partially available from bot detail/onboarding links | Keep mobile focused on runtime access and bot setup. Full docs remain external. |
| Onboarding guide | Present as compact onboarding cards and bot access guide entry | No immediate UI port needed. Continue validating first-run flows. |
| Settings page refresh | Present as native settings tabs for profile, security, devices, theme, language, and about/release info | Mobile keeps native section navigation instead of desktop layout. |
| Release notes and runtime diagnostics | Present in Settings/About and debug exports | Keep aligned; validate before Android production APK release. |
| Message forwarding | Present in mobile chat thread and forwarded message cards | Treat as synced. Regression-test merged/separate forwarding and forwarded record preview. |
| Mention follow-up and subscription modes | Present in conversation settings as `mention_with_context` | Treat as synced at the settings/data-contract level. |
| Feedback management | Not currently a mobile primary surface | Defer unless product explicitly wants in-app feedback management. Web admin workflow is denser than the mobile settings surface. |
| Conversation context card in chat | Removed from main chat stream for WUZ-31 | Context remains in settings/tasks data, but the chat timeline should not be displaced by a persistent card. |

## WUZ-31 Changes

- Removed the always-visible `ConversationContextCard` from the mobile chat thread so prompt/memory/task context no longer appears as a card above messages.
- Kept the underlying conversation context, memory, and task APIs intact.
- Hardened Android production APK startup by disabling native first-frame automatic OTA checks and keeping the existing best-effort JS update check after the root layout is mounted.

## Validation Checklist

Before shipping:

```bash
npm test
npx tsc --noEmit
npx expo export --platform android --output-dir /tmp/ani-android-release-check
```

Manual checks:

- Open a group conversation with prompt or memory configured; no `Conversation Context` card should appear in the chat stream.
- Open conversation settings and task panel; context-related management surfaces should still work.
- Install a `production-apk` build on Android and capture `adb logcat` if startup still shows a white screen or crash.
- Confirm Settings/About shows the expected app version, release version, runtime version, commit, and build time.
