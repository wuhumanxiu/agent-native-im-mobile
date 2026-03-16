# Agent-Native IM Mobile

Mobile client for [Agent-Native IM](https://github.com/wzfukui/agent-native-im) — the AI-first messaging platform built for human-agent collaboration.

## Roadmap

### Phase 1: PWA (Progressive Web App)

Wrap the existing [web frontend](https://github.com/wzfukui/agent-native-im-web) as a PWA for quick mobile validation:

- `manifest.json` for home screen install
- Service Worker for offline caching
- Push notification support (Web Push API)
- Responsive layout optimization for mobile viewports

**Goal:** Users can "Add to Home Screen" on iOS/Android and get a near-native experience with zero app store overhead.

### Phase 2: React Native + Expo

Full native mobile app for App Store / Google Play:

- React Native + Expo framework
- Reuse stores (`Zustand`), types, API client from web frontend
- Native push notifications (FCM / APNs)
- Native file picker, camera, audio recorder
- Offline message queue (AsyncStorage / SQLite)

**Shared code (~40%):** `store/`, `lib/types.ts`, `lib/api.ts`, `lib/utils.ts`, WebSocket client

**Native rewrite (~60%):** UI components, navigation, styles, platform-specific features

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo |
| Language | TypeScript |
| State | Zustand |
| Navigation | React Navigation |
| Realtime | WebSocket |
| Push | Expo Notifications (FCM + APNs) |
| Storage | AsyncStorage / expo-sqlite |
| Build | EAS Build (cloud) |

## Backend

- API: `https://ani-web.51pwd.com/api/v1`
- WebSocket: `wss://ani-web.51pwd.com/api/v1/ws`
- [API Reference](https://github.com/wzfukui/agent-native-im/blob/main/docs/api-reference.md)

## Related Projects

- [agent-native-im](https://github.com/wzfukui/agent-native-im) — Backend (Go)
- [agent-native-im-web](https://github.com/wzfukui/agent-native-im-web) — Web Frontend (React)
- [agent-native-im-sdk-python](https://github.com/wzfukui/agent-native-im-sdk-python) — Python SDK

## License

MIT
