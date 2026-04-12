# ANI Mobile Product Parity Baseline

Last updated: 2026-04-04

This document promotes the recent mobile parity decisions from `_experience` into the mobile repository's formal docs.

## Position

Mobile is the compact-layout implementation of ANI.

It is not expected to be pixel-identical to web/PWA desktop, but it is expected to preserve the same product model and the same high-value user workflows.

## Reference Surfaces

Primary comparison targets:

- `dev/agent-native-im-web`
- current production PWA behavior on `agent-native.im`

## Current Alignment Decisions

### 1. Primary navigation

Mobile treats these as first-class product areas:

- Chats
- Friends
- Inbox
- Bots
- Settings

This replaces the older three-tab shell and keeps mobile aligned with the current product model.

### 2. Chats on compact layout

Compact layout keeps direct and group conversations unified under `Chats`.

This is intentional.

Desktop may split navigation into separate `Direct` and `Groups` surfaces, but compact/mobile keeps a unified conversation list.

### 3. Friends is a primary workflow

Mobile must support:

- discoverable entity search
- friend request send / accept / reject / cancel
- friend removal
- open or reuse direct conversations from friends

### 4. Inbox is a primary workflow

Mobile must support:

- unread and all filters
- scope switching across self and acting bot identities
- per-item read actions
- mark-all-read
- conversation deep links
- friend-request handling from inbox

### 4.1 Presence must be tri-state on compact layout

Mobile must treat direct-peer presence as:

- `online`
- `offline`
- `unknown`

Compact layout must not silently collapse `unknown` into `offline`.

### 5. Bot identity and access policy

Mobile must preserve the current bot contract:

- explicit `bot_id`
- visible `public_id`
- discoverability controls
- explicit `friend_request_policy`
- explicit `direct_message_policy`
- external access policy
- public access link creation / deletion

Mobile bot settings should present these in three grouped concepts:

- Platform Visibility
- Platform Interaction
- External Access

Compact layout may use touch-first toggles instead of desktop selects, but it must preserve the same semantics.

### 6. Debug and runtime diagnostics

Mobile should expose:

- version / commit / build info
- developer-mode gating for debug tools
- chat-level debug export actions

## Accepted Differences

The following do not count as parity failures by themselves:

- touch-first denser layouts
- reduced secondary metadata density
- unified `Chats` on compact layout while desktop splits `Direct` and `Groups`

## Validation Standard

Before shipping a mobile parity change:

```bash
cd dev/agent-native-im-mobile
npm test
expo export --platform ios --platform android --output-dir /tmp/ani-mobile-check
```

Use [MOBILE_PARITY_TEST_CASES_2026-03-29.md](/Users/donaldford/code/SuperBody/dev/agent-native-im-mobile/docs/MOBILE_PARITY_TEST_CASES_2026-03-29.md) as the current execution checklist.

For the longer-lived canonical validation set, also use [TEST_CASES.md](/Users/donaldford/code/SuperBody/dev/agent-native-im-mobile/docs/TEST_CASES.md).
