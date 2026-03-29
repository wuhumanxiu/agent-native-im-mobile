# ANI Mobile User Stories

Last updated: 2026-03-29

This document captures the current mobile-specific user journeys that must remain aligned with ANI's compact-layout product behavior.

## 1. Navigation

### Story: I can reach every primary ANI area from the mobile tab bar

As a daily ANI user,
I want chat, friends, inbox, bots, and settings to be first-class tabs,
so I do not need a desktop browser just to reach core product areas.

Acceptance cues:

- the tab bar exposes `Chats`, `Friends`, `Inbox`, `Bots`, and `Settings`
- unread badges appear on the tabs that matter

## 2. Chats

### Story: I can treat direct and group conversations as one compact chat surface

As a mobile user,
I want one unified `Chats` surface,
so I can work quickly without extra navigation depth.

Acceptance cues:

- direct and group conversations appear in the same conversation surface
- conversation identity remains clear from title, avatar, and subtitle cues
- this compact behavior does not change the underlying ANI conversation model

## 3. Friends

### Story: I can discover people and bots from my phone

As a user managing relationships on mobile,
I want to search discoverable entities and send friend requests,
so I can start collaboration workflows without leaving the app.

Acceptance cues:

- discoverable search works
- pending outgoing requests are visible
- requests can be sent as self or as an owned bot when applicable

### Story: I can process relationship requests on mobile

As a user,
I want to accept, reject, or cancel friend requests on mobile,
so the social graph is not blocked on desktop access.

Acceptance cues:

- incoming requests can be accepted or rejected
- outgoing requests can be canceled
- Friends reflects the result after refresh

### Story: I can move directly from Friends into a 1:1 conversation

As a user,
I want the Friends surface to open or reuse a direct chat,
so relationship management and messaging stay part of one workflow.

Acceptance cues:

- tapping `Message` reuses an existing direct conversation when present
- otherwise a new direct conversation is created

## 4. Inbox

### Story: I can use Inbox as a real working surface on mobile

As a user,
I want unread activity and system events collected in one place,
so I do not need to inspect every chat manually.

Acceptance cues:

- unread and all filters work
- scope can switch across self and acting bot identities
- notifications can be marked read individually or in bulk
- linked conversations open directly from inbox items

### Story: I can act on friend requests from Inbox

As a user,
I want friend request notifications to be actionable,
so Inbox is not just a passive log.

Acceptance cues:

- incoming friend request notifications offer accept/reject handling
- actions update unread state and downstream friend lists

## 5. Bot Management

### Story: Bot identity rules stay consistent on mobile

As a bot owner,
I want bot creation and detail screens to enforce the same identity rules as web,
so mobile does not become an inconsistent management surface.

Acceptance cues:

- bot creation requires valid `bot_...` identifier input
- bot detail exposes `bot_id` and `public_id`
- access policy controls remain visible and editable

## 6. Diagnostics

### Story: I can inspect build and debug state when mobile behavior is wrong

As an operator or advanced user,
I want version and debug tools on mobile,
so I can verify runtime state and capture diagnostics without desktop-only tooling.

Acceptance cues:

- About screen exposes version / runtime / commit / build info
- developer mode can reveal debug actions
- chat-level debug export can capture actionable runtime state
