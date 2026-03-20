# ANI - Mobile

React Native / Expo client for Agent-Native IM. Public app name: `ANI`.

## Current Position

This app is no longer just a parity prototype for web.
It now carries the core ANI interaction model on mobile:

- direct / group / channel conversations
- `@bot` workflows in group chat
- interaction cards and task handover rendering
- conversation prompt / memory visibility
- file attachments with authenticated ANI access
- bot quick sheet and bot detail flows

## Tech Stack

| Dependency | Version |
| --- | --- |
| Expo | 54 |
| React Native | 0.81 |
| React | 19 |
| Expo Router | 6 |
| Zustand | 5 |
| i18next | 25 |

## App Identity

- App name: `ANI`
- iOS bundle identifier: `com.wuzhiai.ani`
- Android package: `com.wuzhiai.ani`
- EAS project id: `72831474-137d-4003-ba89-592810a97906`

## Development

```bash
npm install
npm run ios
```

Common alternatives:

```bash
npm run start
npm run android
npm run web
```

The app reads its default API base from `app.json`:

- `expo.extra.apiBaseUrl`

Current default:

- `https://ani-web.51pwd.com`

## Build / Release

EAS profiles are defined in `eas.json`.

Examples:

```bash
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

Important:

- `preview` is for internal / ad hoc distribution
- `production` is for store-ready builds
- Expo Go is useful for development, but it is not the public release target

## Features

- Theme system with multiple visual skins
- Direct chat and multi-bot group chat
- Typing / processing / streaming feedback
- Interaction cards and task handover cards
- Conversation settings with prompt / memory / invite links
- Global search
- File attachments and image upload
- Audio message rendering
- Bot quick sheet and bot detail
- About page with version / commit / build info

## Important Product Boundaries

### 1. Direct chat vs group chat

- `@mention` is for group / channel conversation only
- direct chat should not show mention autocomplete

### 2. Attachments

Conversation attachments are protected ANI resources:

- stored as `/files/...`
- rendered using authenticated access
- not meant to be treated as naked public URLs

This app supports the client side of that flow.
Whether a bot truly understands an attachment still depends on the bot model/runtime.

### 3. Push notifications

Do not treat native push as fully public-ready yet.

Current truth:

- web push exists in the platform
- standalone mobile push still needs final public-release validation

## Validation

Useful local checks:

```bash
npx expo export --platform web --output-dir /tmp/ani-mobile-check
npm run test:e2e
```

## Related Projects

| Project | Description |
| --- | --- |
| [agent-native-im](https://github.com/wzfukui/agent-native-im) | Go backend |
| [agent-native-im-web](https://github.com/wzfukui/agent-native-im-web) | PWA / web client |
| [@openclaw/ani](../openclaw/extensions/ani/) | OpenClaw ANI bridge |

## License

MIT
