import { beforeEach, describe, expect, it } from 'vitest'
import { useNotificationsStore } from './notifications'

describe('notifications store', () => {
  beforeEach(() => {
    useNotificationsStore.getState().reset()
  })

  it('hydrates unread and pending request counts from a snapshot', () => {
    useNotificationsStore.getState().hydrateSnapshot({
      trackedEntityIds: [1, 2],
      actingEntities: [
        { id: 1, name: 'alice', display_name: 'Alice', entity_type: 'user', metadata: {}, created_at: '', updated_at: '' } as never,
      ],
      notifications: [
        { id: 1, recipient_entity_id: 1, kind: 'friend.request.received', status: 'unread', title: '', body: '', created_at: '2026-03-29T00:00:00Z', updated_at: '2026-03-29T00:00:00Z' },
        { id: 2, recipient_entity_id: 2, kind: 'invite.joined', status: 'read', title: '', body: '', created_at: '2026-03-28T00:00:00Z', updated_at: '2026-03-28T00:00:00Z' },
      ],
      pendingFriendRequests: [
        { id: 9, source_entity_id: 7, target_entity_id: 1, status: 'pending', created_at: '2026-03-29T00:00:00Z', updated_at: '2026-03-29T00:00:00Z' },
      ],
    })

    const state = useNotificationsStore.getState()
    expect(state.unreadCount).toBe(1)
    expect(state.friendRequestCount).toBe(1)
    expect(state.notifications[0]?.id).toBe(1)
  })

  it('marks targeted notifications as read without affecting other recipients', () => {
    useNotificationsStore.getState().hydrateSnapshot({
      trackedEntityIds: [1, 2],
      actingEntities: [],
      notifications: [
        { id: 1, recipient_entity_id: 1, kind: 'generic', status: 'unread', title: '', body: '', created_at: '2026-03-29T00:00:00Z', updated_at: '2026-03-29T00:00:00Z' },
        { id: 2, recipient_entity_id: 2, kind: 'generic', status: 'unread', title: '', body: '', created_at: '2026-03-28T00:00:00Z', updated_at: '2026-03-28T00:00:00Z' },
      ],
      pendingFriendRequests: [],
    })

    useNotificationsStore.getState().applyNotificationReadAll(1)

    const state = useNotificationsStore.getState()
    expect(state.notifications.find((item) => item.id === 1)?.status).toBe('read')
    expect(state.notifications.find((item) => item.id === 2)?.status).toBe('unread')
  })
})
