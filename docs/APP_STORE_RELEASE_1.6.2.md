# App Store Release 1.6.2

This note records the intended App Store metadata for the `1.6.2` mobile release.

## Release Identity

- app version: `1.6.2`
- runtime version: `native-2026-03-27.1`
- EAS update branch: `production`

## Suggested "What's New"

### English

ANI 1.6.2 improves bot and conversation workflows on mobile, adds clearer version diagnostics in Settings, and prepares the app for safer independent hot updates in future releases.

### Chinese

ANI 1.6.2 优化了移动端 Bot 与会话流程，补充了设置页中的版本诊断信息，并为后续更安全的独立热更新发布做好准备。

## Short Review Notes

### English

This build upgrades the ANI mobile client to app version 1.6.2 and introduces a new runtime boundary for future OTA updates. No special reviewer account or hardware is required beyond normal app use.

### Chinese

该版本将 ANI 移动端升级为 1.6.2，并引入新的 runtime 边界以支持后续独立 OTA 热更新。除正常使用 App 外，无需特殊审核账号或额外硬件。

## Internal Operator Notes

- use App Store version `1.6.2`
- do not mention runtime version in public customer-facing release notes
- if a post-release JS-only hotfix is needed, publish an EAS Update on runtime `native-2026-03-27.1`
