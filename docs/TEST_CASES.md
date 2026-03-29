# ANI Mobile Test Cases

Last updated: 2026-03-29

This document is the current formal mobile validation baseline.

It supersedes using date-stamped parity notes as the only mobile test reference.

## 1. Navigation

### TC-MOBILE-NAV-001: Primary tab bar exposes the current product areas

Preconditions:

- user is logged in

Steps:

1. Open the app
2. Inspect the bottom tab bar

Expected:

- tabs are visible for `Chats`, `Friends`, `Inbox`, `Bots`, and `Settings`

### TC-MOBILE-NAV-002: Unread badges appear on the correct tabs

Preconditions:

- unread conversation exists
- pending friend request exists
- unread notification exists

Steps:

1. Open the app

Expected:

- `Chats` shows conversation unread badge
- `Friends` shows pending friend-request badge
- `Inbox` shows notification unread badge

## 2. Chats

### TC-MOBILE-CHAT-001: Compact layout unifies direct and group conversations

Preconditions:

- at least one direct conversation exists
- at least one group conversation exists

Steps:

1. Open `Chats`

Expected:

- direct and group conversations appear in the same conversation surface
- entries remain visually distinguishable by title/avatar/subtitle cues

### TC-MOBILE-CHAT-002: Message send clears pending UI cleanly

Preconditions:

- a writable conversation is open

Steps:

1. Type a message
2. Tap send

Expected:

- message enters optimistic state and then settles
- input field clears
- keyboard dismisses after send

### TC-MOBILE-CHAT-003: Pull to refresh reloads the active conversation

Preconditions:

- conversation already contains messages

Steps:

1. Open the conversation
2. Pull down to refresh

Expected:

- refresh control appears
- latest conversation state is reloaded
- no duplicate message insertion occurs

### TC-MOBILE-CHAT-004: Connection instability does not immediately degrade to failed delivery

Preconditions:

- authenticated chat session exists

Steps:

1. Open a conversation
2. Observe connection behavior during normal usage
3. Send a message during a short reconnect window if available

Expected:

- transient reconnects do not immediately produce repeated `deliver failed`
- messages do not remain stuck in `sending` indefinitely when the connection recovers

### TC-MOBILE-CHAT-005: Chat debug tools are gated behind Developer Mode

Preconditions:

- Developer Mode is off

Steps:

1. Open a conversation
2. Check the chat header
3. Enable Developer Mode from Settings
4. Return to the conversation

Expected:

- debug action is hidden when Developer Mode is off
- debug action appears when Developer Mode is on

### TC-MOBILE-CHAT-006: Debug export actions provide visible feedback

Preconditions:

- Developer Mode is on
- conversation is open

Steps:

1. Open the chat debug menu
2. Trigger `Copy debug report`

Expected:

- a visible success or failure state is shown
- the app does not silently ignore the action

## 3. Friends

### TC-MOBILE-FRIEND-001: Discoverable search returns candidate entities

Preconditions:

- at least one discoverable entity exists

Steps:

1. Open `Friends`
2. Enter a query
3. Submit search

Expected:

- matching discoverable entities are listed

### TC-MOBILE-FRIEND-002: Send friend request

Preconditions:

- search result is not already a friend

Steps:

1. From Friends search results, tap `Send Request`

Expected:

- request is created
- result changes to pending state

### TC-MOBILE-FRIEND-003: Accept incoming request

Preconditions:

- incoming pending friend request exists

Steps:

1. Open `Friends`
2. Switch to `Requests`
3. Tap `Accept`

Expected:

- request disappears from incoming list
- new friend appears in Friends after refresh

### TC-MOBILE-FRIEND-004: Reject incoming request

Preconditions:

- incoming pending friend request exists

Steps:

1. Open `Friends`
2. Switch to `Requests`
3. Tap `Reject`

Expected:

- request disappears from incoming list

### TC-MOBILE-FRIEND-005: Cancel outgoing request

Preconditions:

- outgoing pending friend request exists

Steps:

1. Open `Friends`
2. Switch to `Requests`
3. Tap `Cancel Request`

Expected:

- request disappears from outgoing list

### TC-MOBILE-FRIEND-006: Direct chat launch reuses existing 1:1 conversation

Preconditions:

- friend exists

Steps:

1. Tap `Message` from Friends

Expected:

- existing direct conversation is reused when present
- otherwise a new direct conversation is created
- app navigates into that conversation

## 4. Inbox

### TC-MOBILE-INBOX-001: Default filter favors unread work

Preconditions:

- at least one unread notification and one read notification exist

Steps:

1. Open `Inbox`

Expected:

- unread items are shown by default
- read-only items remain hidden until filter changes to `All`

### TC-MOBILE-INBOX-002: Scope switching changes visible inbox content

Preconditions:

- user owns at least one acting bot identity with notifications

Steps:

1. Open `Inbox`
2. Switch between `All` and a specific identity

Expected:

- list content updates to match selected scope

### TC-MOBILE-INBOX-003: Mark a single notification as read

Preconditions:

- unread notification exists

Steps:

1. Open `Inbox`
2. Tap `Mark Read` on an unread item

Expected:

- item becomes read
- unread badge count decreases

### TC-MOBILE-INBOX-004: Mark all read

Preconditions:

- multiple unread notifications exist

Steps:

1. Open `Inbox`
2. Tap `Mark All Read`

Expected:

- all visible unread notifications become read
- Inbox unread badge clears for the targeted scope

### TC-MOBILE-INBOX-005: Friend request actions work from Inbox

Preconditions:

- unread `friend.request.received` notification exists

Steps:

1. Open `Inbox`
2. Tap `Accept` or `Reject`

Expected:

- action succeeds
- notification becomes read or no longer actionable
- Friends reflects the resulting relationship state after refresh

### TC-MOBILE-INBOX-006: Linked conversation opens from inbox item

Preconditions:

- notification payload includes `conversation_id`

Steps:

1. Open `Inbox`
2. Tap `Open Conversation`

Expected:

- app navigates to the referenced chat thread

## 5. Bot Management

### TC-MOBILE-BOT-001: Bot creation requires a valid `bot_id`

Preconditions:

- user is creating a bot

Steps:

1. Open bot creation
2. Leave `bot_id` empty or invalid
3. Submit

Expected:

- validation blocks submission

### TC-MOBILE-BOT-002: Bot detail shows current identity contract

Preconditions:

- a bot exists

Steps:

1. Open bot detail

Expected:

- page shows `bot_id`
- page shows `public_id`
- page shows discoverability and access-policy controls

### TC-MOBILE-BOT-003: Public access link actions work

Preconditions:

- owned bot detail is open

Steps:

1. Create a public access link
2. Copy the link
3. Delete the link

Expected:

- link is created successfully
- copy action provides visible feedback
- deleted link disappears from the list

## 6. Diagnostics And Release State

### TC-MOBILE-DIAG-001: About screen exposes runtime identity

Steps:

1. Open `Settings`
2. Navigate to About / build information surface

Expected:

- app version is visible
- runtime version is visible
- commit/build identity is visible

### TC-MOBILE-DIAG-002: OTA validation baseline

Required local validation before OTA:

```bash
cd dev/agent-native-im-mobile
npm test
expo export --platform ios --platform android --output-dir /tmp/ani-mobile-check
```

### TC-MOBILE-DIAG-003: Post-OTA runtime verification

Steps:

1. Install or open a production-capable build on the current runtime
2. Pull the OTA
3. Cold launch twice if needed
4. Inspect About / build information

Expected:

- runtime version matches the intended native generation
- build or commit identity reflects the OTA payload rather than an older embedded bundle
