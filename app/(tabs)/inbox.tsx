import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Bell, Check, CheckCheck, MessageSquareText, X } from 'lucide-react-native'
import { useAuthStore } from '../../src/store/auth'
import { useNotificationsStore } from '../../src/store/notifications'
import { useThemeColors } from '../../src/lib/theme'
import { EntityAvatar } from '../../src/components/ui/EntityAvatar'
import { EmptyState } from '../../src/components/ui/EmptyState'
import * as api from '../../src/lib/api'
import type { Entity, NotificationRecord } from '../../src/lib/types'

type Filter = 'unread' | 'all'
type Scope = 'all' | number

function entityDisplayName(entity?: Entity | null): string {
  if (!entity) return '?'
  return entity.display_name || entity.name || '?'
}

function notificationRecipientEntityId(notification: NotificationRecord): number {
  return notification.recipient_entity?.id || notification.recipient_entity_id
}

function notificationRequestId(notification: NotificationRecord): number | null {
  const raw = notification.data?.request_id
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw)
  return null
}

function notificationConversationId(notification: NotificationRecord): number | null {
  const raw = notification.data?.conversation_id
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw)
  return null
}

function notificationLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  notification: NotificationRecord,
): string {
  const actor = notification.actor_entity ? entityDisplayName(notification.actor_entity) : t('inbox.someone')
  switch (notification.kind) {
    case 'friend.request.received':
      return t('inbox.friendRequestReceived', { actor })
    case 'friend.request.accepted':
      return t('inbox.friendRequestAccepted', { actor })
    case 'friend.request.rejected':
      return t('inbox.friendRequestRejected', { actor })
    case 'friend.request.canceled':
      return t('inbox.friendRequestCanceled', { actor })
    case 'invite.joined':
      return t('inbox.inviteJoined', { actor })
    case 'conversation.change_request':
      return t('inbox.changeRequested', { actor })
    case 'conversation.change_approved':
      return t('inbox.changeApproved', { actor })
    case 'conversation.change_rejected':
      return t('inbox.changeRejected', { actor })
    case 'task.handover':
      return t('inbox.taskHandover', { actor })
    case 'public.bot_session_created':
      return t('inbox.publicBotSessionCreated')
    default:
      return notification.title || t('inbox.generic')
  }
}

export default function InboxTab() {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useThemeColors()
  const token = useAuthStore((s) => s.token)!
  const me = useAuthStore((s) => s.entity)!
  const actingEntities = useNotificationsStore((s) => s.actingEntities)
  const notifications = useNotificationsStore((s) => s.notifications)
  const unreadCount = useNotificationsStore((s) => s.unreadCount)
  const hydrateSnapshot = useNotificationsStore((s) => s.hydrateSnapshot)
  const applyNotificationRead = useNotificationsStore((s) => s.applyNotificationRead)
  const applyNotificationReadAll = useNotificationsStore((s) => s.applyNotificationReadAll)
  const markDirty = useNotificationsStore((s) => s.markDirty)
  const [scope, setScope] = useState<Scope>('all')
  const [filter, setFilter] = useState<Filter>('unread')
  const [actingId, setActingId] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const scopeOptions = useMemo(() => (
    actingEntities.length === 0 ? [me] : actingEntities
  ), [actingEntities, me])

  const visibleNotifications = useMemo(() => {
    const targetIds = scope === 'all'
      ? new Set(scopeOptions.map((entity) => entity.id))
      : new Set([scope])
    return notifications.filter((notification) => {
      if (!targetIds.has(notificationRecipientEntityId(notification))) return false
      if (filter === 'unread' && notification.status !== 'unread') return false
      return true
    })
  }, [filter, notifications, scope, scopeOptions])

  const refreshSnapshot = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await api.getInboxSnapshot(token)
      if (res.ok && res.data) {
        hydrateSnapshot({
          trackedEntityIds: res.data.tracked_entity_ids,
          actingEntities: res.data.acting_entities,
          notifications: res.data.notifications,
          pendingFriendRequests: res.data.pending_friend_requests,
        })
      }
    } finally {
      setRefreshing(false)
    }
  }, [hydrateSnapshot, token])

  const markRead = useCallback(async (notification: NotificationRecord) => {
    const recipientEntityId = notificationRecipientEntityId(notification)
    setActingId(notification.id)
    const res = await api.markNotificationRead(
      token,
      notification.id,
      recipientEntityId === me.id ? undefined : recipientEntityId,
    )
    if (res.ok && res.data) {
      applyNotificationRead(res.data)
    }
    setActingId(null)
  }, [applyNotificationRead, me.id, token])

  const markAllRead = useCallback(async () => {
    const targetIds = scope === 'all'
      ? Array.from(new Set(scopeOptions.map((entity) => entity.id)))
      : [scope]
    setActingId(-1)
    await Promise.all(targetIds.map((entityId) => (
      api.markAllNotificationsRead(token, entityId === me.id ? undefined : entityId)
    )))
    targetIds.forEach((entityId) => applyNotificationReadAll(entityId))
    setActingId(null)
  }, [applyNotificationReadAll, me.id, scope, scopeOptions, token])

  const handleFriendAction = useCallback(async (
    notification: NotificationRecord,
    action: 'accept' | 'reject',
  ) => {
    const requestId = notificationRequestId(notification)
    if (!requestId) return
    const recipientEntityId = notificationRecipientEntityId(notification)
    setActingId(notification.id)
    if (action === 'accept') {
      await api.acceptFriendRequest(token, requestId, recipientEntityId === me.id ? undefined : recipientEntityId)
    } else {
      await api.rejectFriendRequest(token, requestId, recipientEntityId === me.id ? undefined : recipientEntityId)
    }
    const readRes = await api.markNotificationRead(
      token,
      notification.id,
      recipientEntityId === me.id ? undefined : recipientEntityId,
    )
    if (readRes.ok && readRes.data) {
      applyNotificationRead(readRes.data)
    } else {
      applyNotificationReadAll(recipientEntityId)
    }
    markDirty()
    setActingId(null)
  }, [applyNotificationRead, applyNotificationReadAll, markDirty, me.id, token])

  const openConversation = useCallback((notification: NotificationRecord) => {
    const conversationId = notificationConversationId(notification)
    if (!conversationId) return
    router.push(`/chat/${conversationId}`)
  }, [router])

  const renderNotification = ({ item }: { item: NotificationRecord }) => {
    const isUnread = item.status === 'unread'
    const isPendingRequest = item.kind === 'friend.request.received'
    const actor = item.actor_entity
    const recipient = item.recipient_entity
    const conversationId = notificationConversationId(item)
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.bgSecondary,
          },
        ]}
      >
        <View style={styles.row}>
          <View style={styles.avatarColumn}>
            <EntityAvatar entity={actor || recipient} size="md" />
          </View>
          <View style={[styles.contentCard, { borderBottomColor: isUnread ? `${colors.accent}33` : `${colors.border}B3` }]}>
            <View style={styles.titleRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{notificationLabel(t, item)}</Text>
              {isUnread ? <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} /> : null}
            </View>
            {recipient && scope === 'all' ? (
              <Text style={[styles.forEntity, { color: colors.textMuted }]}>
                {t('inbox.forEntity', { name: entityDisplayName(recipient) })}
              </Text>
            ) : null}
            <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
              {item.body || notificationLabel(t, item)}
            </Text>
            <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
            <View style={styles.actions}>
              {isPendingRequest ? (
                <>
                  <Pressable
                    onPress={() => void handleFriendAction(item, 'accept')}
                    disabled={actingId === item.id}
                    style={[styles.primaryBtn, { backgroundColor: colors.success }]}
                  >
                    {actingId === item.id ? <ActivityIndicator size="small" color="#fff" /> : <Check size={14} color="#fff" />}
                    <Text style={styles.primaryBtnText}>{t('friends.accept')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleFriendAction(item, 'reject')}
                    disabled={actingId === item.id}
                    style={[styles.secondaryBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
                  >
                    <X size={14} color={colors.textMuted} />
                    <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>{t('friends.reject')}</Text>
                  </Pressable>
                </>
              ) : null}

              {!isPendingRequest && isUnread ? (
                <Pressable
                  onPress={() => void markRead(item)}
                  disabled={actingId === item.id}
                  style={[styles.secondaryBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
                >
                  {actingId === item.id ? <ActivityIndicator size="small" color={colors.textMuted} /> : <Check size={14} color={colors.textSecondary} />}
                  <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>{t('inbox.markRead')}</Text>
                </Pressable>
              ) : null}

              {conversationId ? (
                <Pressable
                  onPress={() => openConversation(item)}
                  style={[styles.secondaryBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
                >
                  <MessageSquareText size={14} color={colors.textSecondary} />
                  <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>{t('inbox.openConversation')}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>{t('inbox.title')}</Text>
          {unreadCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.accentDim }]}>
              <Text style={[styles.badgeText, { color: colors.accent }]}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.screenSubtitle, { color: colors.textMuted }]}>{t('inbox.subtitle')}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.segmentRow}>
          <Pressable
            onPress={() => setScope('all')}
            style={[styles.segmentBtn, { backgroundColor: scope === 'all' ? colors.accent : colors.bgSecondary }]}
          >
            <Text style={[styles.segmentBtnText, { color: scope === 'all' ? '#fff' : colors.textSecondary }]}>
              {t('inbox.scopeAll')}
            </Text>
          </Pressable>
          {scopeOptions.map((entity) => {
            const active = scope === entity.id
            return (
              <Pressable
                key={entity.id}
                onPress={() => setScope(entity.id)}
                style={[styles.segmentBtn, { backgroundColor: active ? colors.accent : colors.bgSecondary }]}
              >
                <Text style={[styles.segmentBtnText, { color: active ? '#fff' : colors.textSecondary }]}>
                  {entity.id === me.id ? t('friends.actAsSelf', { name: entityDisplayName(entity) }) : t('friends.actAsBot', { name: entityDisplayName(entity) })}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.toolbar}>
          <View style={styles.segmentRow}>
            {(['unread', 'all'] as Filter[]).map((item) => {
              const active = filter === item
              return (
                <Pressable
                  key={item}
                  onPress={() => setFilter(item)}
                  style={[styles.segmentBtn, { backgroundColor: active ? colors.accent : colors.bgSecondary }]}
                >
                  <Text style={[styles.segmentBtnText, { color: active ? '#fff' : colors.textSecondary }]}>
                    {item === 'unread' ? t('inbox.filterUnread') : t('inbox.filterAll')}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {unreadCount > 0 ? (
            <Pressable
              onPress={() => void markAllRead()}
              disabled={actingId === -1}
              style={[styles.secondaryBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
            >
              {actingId === -1 ? <ActivityIndicator size="small" color={colors.textMuted} /> : <CheckCheck size={14} color={colors.textSecondary} />}
              <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>{t('inbox.markAllRead')}</Text>
            </Pressable>
          ) : null}
        </View>

        <FlatList
          data={visibleNotifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderNotification}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshSnapshot} tintColor={colors.accent} />}
          contentContainerStyle={visibleNotifications.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={(
            <EmptyState
              icon={<Bell size={28} color={colors.textMuted} />}
              title={t('inbox.emptyTitle')}
              description={t('inbox.emptyDesc')}
            />
          )}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  screenSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  toolbar: {
    marginTop: 12,
    marginBottom: 12,
    gap: 10,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentBtn: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 24,
    gap: 10,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  card: {
    borderRadius: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarColumn: {
    marginTop: 8,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  contentCard: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  forEntity: {
    fontSize: 11,
    marginTop: 4,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  cardMeta: {
    fontSize: 11,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
})
