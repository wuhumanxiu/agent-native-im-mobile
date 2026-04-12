import { create } from 'zustand'
import type { Entity, FriendRequest, NotificationRecord } from '../lib/types'

interface NotificationSnapshot {
  trackedEntityIds: number[]
  actingEntities: Entity[]
  notifications: NotificationRecord[]
  pendingFriendRequests: FriendRequest[]
}

interface NotificationState extends NotificationSnapshot {
  unreadCount: number
  friendRequestCount: number
  dirtyVersion: number
  hydrateSnapshot: (snapshot: NotificationSnapshot) => void
  upsertNotification: (notification: NotificationRecord) => void
  applyNotificationRead: (notification: NotificationRecord) => void
  applyNotificationReadById: (notificationId: number, recipientEntityId?: number) => void
  applyNotificationReadAll: (recipientEntityId?: number) => void
  upsertFriendRequest: (request: FriendRequest) => void
  removeFriendRequest: (requestId: number) => void
  markDirty: () => void
  reset: () => void
}

function sortNotifications(notifications: NotificationRecord[]): NotificationRecord[] {
  return [...notifications].sort((a, b) => {
    const byCreatedAt = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (byCreatedAt !== 0) return byCreatedAt
    return b.id - a.id
  })
}

function dedupeNotifications(notifications: NotificationRecord[]): NotificationRecord[] {
  const byId = new Map<number, NotificationRecord>()
  for (const notification of notifications) {
    byId.set(notification.id, notification)
  }
  return sortNotifications(Array.from(byId.values()))
}

function dedupePendingRequests(requests: FriendRequest[]): FriendRequest[] {
  const byId = new Map<number, FriendRequest>()
  for (const request of requests) {
    if (request.status === 'pending') byId.set(request.id, request)
  }
  return Array.from(byId.values()).sort((a, b) => {
    const byCreatedAt = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (byCreatedAt !== 0) return byCreatedAt
    return b.id - a.id
  })
}

function unreadCountFor(notifications: NotificationRecord[]): number {
  return notifications.reduce((sum, notification) => sum + (notification.status === 'unread' ? 1 : 0), 0)
}

function withDerived(snapshot: NotificationSnapshot, dirtyVersion = 0) {
  const notifications = dedupeNotifications(snapshot.notifications)
  const pendingFriendRequests = dedupePendingRequests(snapshot.pendingFriendRequests)
  const actingEntities = Array.from(new Map(snapshot.actingEntities.map((entity) => [entity.id, entity])).values())
  return {
    trackedEntityIds: Array.from(new Set(snapshot.trackedEntityIds)),
    actingEntities,
    notifications,
    pendingFriendRequests,
    unreadCount: unreadCountFor(notifications),
    friendRequestCount: pendingFriendRequests.length,
    dirtyVersion,
  }
}

const emptyState = withDerived({
  trackedEntityIds: [],
  actingEntities: [],
  notifications: [],
  pendingFriendRequests: [],
})

export const useNotificationsStore = create<NotificationState>((set) => ({
  ...emptyState,

  hydrateSnapshot: (snapshot) => set((state) => ({
    ...withDerived(snapshot, state.dirtyVersion),
  })),

  upsertNotification: (notification) => set((state) => ({
    ...withDerived({
      trackedEntityIds: state.trackedEntityIds,
      actingEntities: state.actingEntities,
      notifications: [notification, ...state.notifications.filter((item) => item.id !== notification.id)],
      pendingFriendRequests: state.pendingFriendRequests,
    }, state.dirtyVersion),
  })),

  applyNotificationRead: (notification) => set((state) => ({
    ...withDerived({
      trackedEntityIds: state.trackedEntityIds,
      actingEntities: state.actingEntities,
      notifications: [notification, ...state.notifications.filter((item) => item.id !== notification.id)],
      pendingFriendRequests: state.pendingFriendRequests,
    }, state.dirtyVersion),
  })),

  applyNotificationReadById: (notificationId, recipientEntityId) => set((state) => ({
    ...withDerived({
      trackedEntityIds: state.trackedEntityIds,
      actingEntities: state.actingEntities,
      notifications: state.notifications.map((notification) => {
        if (notification.id !== notificationId) return notification
        if (recipientEntityId != null && notification.recipient_entity_id !== recipientEntityId) return notification
        return {
          ...notification,
          status: 'read',
          read_at: notification.read_at || new Date().toISOString(),
        }
      }),
      pendingFriendRequests: state.pendingFriendRequests,
    }, state.dirtyVersion),
  })),

  applyNotificationReadAll: (recipientEntityId) => set((state) => ({
    ...withDerived({
      trackedEntityIds: state.trackedEntityIds,
      actingEntities: state.actingEntities,
      notifications: state.notifications.map((notification) => {
        if (recipientEntityId != null && notification.recipient_entity_id !== recipientEntityId) return notification
        if (notification.status === 'read') return notification
        return {
          ...notification,
          status: 'read',
          read_at: notification.read_at || new Date().toISOString(),
        }
      }),
      pendingFriendRequests: state.pendingFriendRequests,
    }, state.dirtyVersion),
  })),

  upsertFriendRequest: (request) => set((state) => ({
    ...withDerived({
      trackedEntityIds: state.trackedEntityIds,
      actingEntities: state.actingEntities,
      notifications: state.notifications,
      pendingFriendRequests: request.status === 'pending' && state.trackedEntityIds.includes(request.target_entity_id)
        ? [request, ...state.pendingFriendRequests.filter((item) => item.id !== request.id)]
        : state.pendingFriendRequests.filter((item) => item.id !== request.id),
    }, state.dirtyVersion + 1),
  })),

  removeFriendRequest: (requestId) => set((state) => ({
    ...withDerived({
      trackedEntityIds: state.trackedEntityIds,
      actingEntities: state.actingEntities,
      notifications: state.notifications,
      pendingFriendRequests: state.pendingFriendRequests.filter((item) => item.id !== requestId),
    }, state.dirtyVersion + 1),
  })),

  markDirty: () => set((state) => ({ dirtyVersion: state.dirtyVersion + 1 })),

  reset: () => set({ ...emptyState }),
}))
