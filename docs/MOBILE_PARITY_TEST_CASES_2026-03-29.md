# ANI Mobile Parity Test Cases (2026-03-29)

These test cases cover the product-alignment work that brings the mobile app back in line with current web/PWA behavior.

## 1. Tab Bar Parity

### Case 1.1

- Preconditions: user is logged in
- Steps:
  - open the app
  - inspect the bottom tab bar
- Expected:
  - tabs are visible for Chat, Friends, Inbox, Bots, and Settings

### Case 1.2

- Preconditions: unread conversation exists, pending friend request exists, unread notification exists
- Steps:
  - open the app
- Expected:
  - Chat tab shows conversation unread badge
  - Friends tab shows pending friend-request badge
  - Inbox tab shows notification unread badge

## 2. Friends Flow

### Case 2.1 Search discoverable entities

- Preconditions: at least one discoverable entity exists
- Steps:
  - open Friends
  - enter a query
  - submit search
- Expected:
  - matching discoverable entities are listed

### Case 2.2 Send friend request

- Preconditions: search result is not already a friend
- Steps:
  - from Friends search results, tap Send Request
- Expected:
  - request is created
  - result changes to pending state

### Case 2.3 Accept request

- Preconditions: an incoming pending friend request exists
- Steps:
  - open Friends
  - switch to Requests
  - tap Accept
- Expected:
  - request disappears from incoming list
  - new friend appears in Friends list after refresh

### Case 2.4 Reject request

- Preconditions: an incoming pending friend request exists
- Steps:
  - open Friends
  - switch to Requests
  - tap Reject
- Expected:
  - request disappears from incoming list

### Case 2.5 Cancel outgoing request

- Preconditions: an outgoing pending friend request exists
- Steps:
  - open Friends
  - switch to Requests
  - tap Cancel Request
- Expected:
  - request disappears from outgoing list

### Case 2.6 Open direct conversation

- Preconditions: a friend exists
- Steps:
  - from Friends, tap Message
- Expected:
  - existing direct conversation is reused when present
  - otherwise a new direct conversation is created
  - the app navigates into that conversation

## 3. Inbox Flow

### Case 3.1 Unread filter

- Preconditions: at least one unread notification and one read notification exist
- Steps:
  - open Inbox
  - verify default filter
- Expected:
  - unread items are shown by default
  - read-only items are hidden until filter changes to All

### Case 3.2 Switch inbox scope

- Preconditions: user owns at least one acting bot identity with notifications
- Steps:
  - open Inbox
  - switch between All and a specific identity
- Expected:
  - list content updates to match selected scope

### Case 3.3 Mark single notification read

- Preconditions: unread notification exists
- Steps:
  - open Inbox
  - tap Mark Read on an unread item
- Expected:
  - item becomes read
  - unread badge count decreases

### Case 3.4 Mark all read

- Preconditions: multiple unread notifications exist
- Steps:
  - open Inbox
  - tap Mark All Read
- Expected:
  - all visible unread notifications become read
  - Inbox unread badge clears for the targeted scope

### Case 3.5 Accept request from inbox

- Preconditions: unread `friend.request.received` notification exists
- Steps:
  - open Inbox
  - tap Accept
- Expected:
  - request is accepted
  - notification becomes read
  - Friends list reflects the new relationship after refresh

### Case 3.6 Open linked conversation

- Preconditions: notification payload includes `conversation_id`
- Steps:
  - open Inbox
  - tap Open Conversation
- Expected:
  - app navigates to the referenced chat thread

## 4. Bot Identity Contract

### Case 4.1 Bot ID required on create

- Preconditions: user is creating a bot
- Steps:
  - open bot creation
  - leave `bot_id` empty or invalid
  - submit
- Expected:
  - validation blocks submission

### Case 4.2 Bot access policy visible on detail

- Preconditions: a bot exists
- Steps:
  - open bot detail
- Expected:
  - page shows `bot_id`
  - page shows `public_id`
  - page shows discoverability and access-policy controls

## 5. Release Validation

Required local validation before OTA:

```bash
cd dev/agent-native-im-mobile
npm test
expo export --platform ios --platform android --output-dir /tmp/ani-mobile-check
```
