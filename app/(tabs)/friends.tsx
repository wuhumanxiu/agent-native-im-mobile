import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Search, UserCheck, UserPlus, Users, X } from 'lucide-react-native'
import { useAuthStore } from '../../src/store/auth'
import { useConversationsStore } from '../../src/store/conversations'
import { useNotificationsStore } from '../../src/store/notifications'
import { usePresenceStore } from '../../src/store/presence'
import { useThemeColors } from '../../src/lib/theme'
import { EntityAvatar } from '../../src/components/ui/EntityAvatar'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { openOrCreateDirectConversation } from '../../src/lib/direct-conversation'
import * as api from '../../src/lib/api'
import type { Entity, FriendRequest } from '../../src/lib/types'

type Tab = 'friends' | 'requests'

function entityDisplayName(entity?: Entity | null): string {
  if (!entity) return '?'
  return entity.display_name || entity.name || '?'
}

function secondaryLabelOf(entity?: Entity | null): string {
  if (!entity) return ''
  if (entity.bot_id) return entity.bot_id
  if (entity.public_id) return entity.public_id
  return `@${entity.name}`
}

export default function FriendsTab() {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useThemeColors()
  const token = useAuthStore((s) => s.token)!
  const me = useAuthStore((s) => s.entity)!
  const conversations = useConversationsStore((s) => s.conversations)
  const addConversation = useConversationsStore((s) => s.addConversation)
  const getPresenceState = usePresenceStore((s) => s.getPresenceState)
  const setPresenceBatch = usePresenceStore((s) => s.setPresenceBatch)
  const setPresenceUnknown = usePresenceStore((s) => s.setPresenceUnknown)
  const actingEntities = useNotificationsStore((s) => s.actingEntities)
  const removeFriendRequestFromStore = useNotificationsStore((s) => s.removeFriendRequest)
  const markNotificationsDirty = useNotificationsStore((s) => s.markDirty)
  const dirtyVersion = useNotificationsStore((s) => s.dirtyVersion)
  const [tab, setTab] = useState<Tab>('friends')
  const [actingEntityId, setActingEntityId] = useState<number>(me.id)
  const [friends, setFriends] = useState<Entity[]>([])
  const [incoming, setIncoming] = useState<FriendRequest[]>([])
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([])
  const [discoverable, setDiscoverable] = useState<Entity[]>([])
  const [query, setQuery] = useState('')
  const [searchedQuery, setSearchedQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [submittingId, setSubmittingId] = useState<number | null>(null)

  const actingOptions = useMemo(() => (
    actingEntities.length === 0 ? [me] : actingEntities
  ), [actingEntities, me])
  const actingEntity = useMemo(
    () => actingOptions.find((entity) => entity.id === actingEntityId) || me,
    [actingEntityId, actingOptions, me],
  )

  const loadSocial = useCallback(async () => {
    setLoading(true)
    const [friendsRes, incomingRes, outgoingRes] = await Promise.all([
      api.listFriends(token, actingEntityId),
      api.listFriendRequests(token, { entityId: actingEntityId, direction: 'incoming', status: 'pending' }),
      api.listFriendRequests(token, { entityId: actingEntityId, direction: 'outgoing', status: 'pending' }),
    ])
    if (friendsRes.ok && friendsRes.data) {
      setFriends(friendsRes.data)
      const friendIds = friendsRes.data.map((item) => item.id)
      if (friendIds.length > 0) {
        const presenceRes = await api.batchPresence(token, friendIds)
        if (presenceRes.ok && presenceRes.data?.presence) {
          const onlineIds = friendIds.filter((friendId) => !!presenceRes.data?.presence[String(friendId)])
          setPresenceBatch(friendIds, onlineIds)
        } else {
          setPresenceUnknown(friendIds)
        }
      }
    }
    if (incomingRes.ok && incomingRes.data) setIncoming(incomingRes.data)
    if (outgoingRes.ok && outgoingRes.data) setOutgoing(outgoingRes.data)
    setLoading(false)
  }, [actingEntityId, setPresenceBatch, setPresenceUnknown, token])

  useEffect(() => {
    void loadSocial()
  }, [dirtyVersion, loadSocial])

  const runSearch = useCallback(async () => {
    const trimmed = query.trim()
    if (!trimmed) {
      setSearchedQuery('')
      setDiscoverable([])
      return
    }
    setSearching(true)
    setSearchedQuery(trimmed)
    const res = await api.searchDiscoverableEntities(token, trimmed, 20)
    if (res.ok && res.data) {
      setDiscoverable(res.data.filter((entity) => entity.id !== actingEntityId))
    } else {
      setDiscoverable([])
    }
    setSearching(false)
  }, [actingEntityId, query, token])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadSocial()
    } finally {
      setRefreshing(false)
    }
  }, [loadSocial])

  const sendRequest = useCallback(async (targetId: number) => {
    setSubmittingId(targetId)
    await api.createFriendRequest(token, {
      source_entity_id: actingEntityId === me.id ? undefined : actingEntityId,
      target_entity_id: targetId,
    })
    setSubmittingId(null)
    await loadSocial()
    setQuery('')
    setSearchedQuery('')
    setDiscoverable([])
    markNotificationsDirty()
  }, [actingEntityId, loadSocial, me.id, markNotificationsDirty, token])

  const acceptRequest = useCallback(async (id: number) => {
    setSubmittingId(id)
    const res = await api.acceptFriendRequest(token, id, actingEntityId === me.id ? undefined : actingEntityId)
    setSubmittingId(null)
    if (res.ok) {
      setIncoming((items) => items.filter((item) => item.id !== id))
      removeFriendRequestFromStore(id)
      markNotificationsDirty()
      await loadSocial()
    }
  }, [actingEntityId, loadSocial, me.id, markNotificationsDirty, removeFriendRequestFromStore, token])

  const rejectRequest = useCallback(async (id: number) => {
    setSubmittingId(id)
    const res = await api.rejectFriendRequest(token, id, actingEntityId === me.id ? undefined : actingEntityId)
    setSubmittingId(null)
    if (res.ok) {
      setIncoming((items) => items.filter((item) => item.id !== id))
      removeFriendRequestFromStore(id)
      markNotificationsDirty()
    }
  }, [actingEntityId, me.id, markNotificationsDirty, removeFriendRequestFromStore, token])

  const cancelRequest = useCallback(async (id: number) => {
    setSubmittingId(id)
    const res = await api.cancelFriendRequest(token, id, actingEntityId === me.id ? undefined : actingEntityId)
    setSubmittingId(null)
    if (res.ok) {
      setOutgoing((items) => items.filter((item) => item.id !== id))
      removeFriendRequestFromStore(id)
      markNotificationsDirty()
    }
  }, [actingEntityId, me.id, markNotificationsDirty, removeFriendRequestFromStore, token])

  const removeFriend = useCallback(async (id: number) => {
    setSubmittingId(id)
    const res = await api.deleteFriend(token, id, actingEntityId === me.id ? undefined : actingEntityId)
    setSubmittingId(null)
    if (res.ok) await loadSocial()
  }, [actingEntityId, loadSocial, me.id, token])

  const openDirect = useCallback(async (target: Entity, mode: 'smart' | 'existing' | 'new' = 'smart') => {
    setSubmittingId(target.id)
    const conversation = await openOrCreateDirectConversation({
      token,
      t,
      actingEntity,
      target,
      conversations,
      addConversation,
      mode,
    })
    setSubmittingId(null)
    if (conversation) router.push(`/chat/${conversation.id}`)
  }, [actingEntity, addConversation, conversations, router, t, token])

  const outgoingTargets = new Set(outgoing.map((req) => req.target_entity_id))
  const friendIds = new Set(friends.map((entity) => entity.id))

  const renderDiscoverable = () => {
    if (!searchedQuery) return null
    return (
      <View style={styles.section}>
        {discoverable.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <Text style={[styles.mutedText, { color: colors.textMuted }]}>{t('friends.noResults')}</Text>
          </View>
        ) : discoverable.map((item) => {
          const pending = outgoingTargets.has(item.id)
          const isFriend = friendIds.has(item.id)
          return (
            <View key={item.id} style={[styles.card, { backgroundColor: colors.bgSecondary }]}>
              <View style={styles.row}>
                <View style={styles.avatarColumn}>
                  <EntityAvatar entity={item} size="md" showStatus presenceState={getPresenceState(item.id)} />
                </View>
                <View style={[styles.contentCard, { borderBottomColor: `${colors.border}B3` }]}>
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <Text style={[styles.title, { color: colors.text }]}>{entityDisplayName(item)}</Text>
                      <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>{secondaryLabelOf(item)}</Text>
                    </View>
                    {isFriend ? (
                      <Pressable onPress={() => void openDirect(item)} style={[styles.smallBtn, { backgroundColor: colors.accentDim }]}>
                        <MessageSquare size={14} color={colors.accent} />
                      </Pressable>
                    ) : pending ? (
                      <View style={[styles.pendingPill, { backgroundColor: colors.bgHover }]}>
                        <Text style={[styles.pendingPillText, { color: colors.textMuted }]}>{t('friends.requestPending')}</Text>
                      </View>
                    ) : (
                      <Pressable onPress={() => void sendRequest(item.id)} disabled={submittingId === item.id} style={[styles.primaryBtn, { backgroundColor: colors.accent }]}>
                        {submittingId === item.id ? <ActivityIndicator size="small" color="#fff" /> : <UserPlus size={14} color="#fff" />}
                        <Text style={styles.primaryBtnText}>{t('friends.sendRequest')}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            </View>
          )
        })}
      </View>
    )
  }

  const renderFriendItem = ({ item }: { item: Entity }) => (
    <View style={[styles.card, { backgroundColor: colors.bgSecondary }]}>
      <View style={styles.row}>
        <View style={styles.avatarColumn}>
          <EntityAvatar entity={item} size="md" showStatus presenceState={getPresenceState(item.id)} />
        </View>
        <View style={[styles.contentCard, { borderBottomColor: `${colors.border}B3` }]}>
          <View style={styles.flex}>
            <Text style={[styles.title, { color: colors.text }]}>{entityDisplayName(item)}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>{secondaryLabelOf(item)}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={() => void openDirect(item)} disabled={submittingId === item.id} style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.bg }]}>
              <MessageSquare size={14} color={colors.textSecondary} />
              <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>{t('friends.message')}</Text>
            </Pressable>
            <Pressable onPress={() => void removeFriend(item.id)} disabled={submittingId === item.id} style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.bg }]}>
              {submittingId === item.id ? <ActivityIndicator size="small" color={colors.textMuted} /> : <X size={14} color={colors.textMuted} />}
              <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>{t('friends.removeFriend')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  )

  const renderRequest = (request: FriendRequest, direction: 'incoming' | 'outgoing') => {
    const entity = direction === 'incoming' ? request.source_entity : request.target_entity
    return (
      <View key={request.id} style={[styles.card, { backgroundColor: colors.bgSecondary }]}>
        <View style={styles.row}>
          <View style={styles.avatarColumn}>
            <EntityAvatar entity={entity || null} size="md" showStatus presenceState={entity ? getPresenceState(entity.id) : 'unknown'} />
          </View>
          <View style={[styles.contentCard, { borderBottomColor: `${colors.border}B3` }]}>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]}>{entityDisplayName(entity || null)}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>{secondaryLabelOf(entity || null)}</Text>
            </View>
            <View style={styles.actions}>
              {direction === 'incoming' ? (
                <>
                  <Pressable onPress={() => void acceptRequest(request.id)} disabled={submittingId === request.id} style={[styles.primaryBtn, { backgroundColor: colors.accent }]}>
                    {submittingId === request.id ? <ActivityIndicator size="small" color="#fff" /> : <UserCheck size={14} color="#fff" />}
                    <Text style={styles.primaryBtnText}>{t('friends.accept')}</Text>
                  </Pressable>
                  <Pressable onPress={() => void rejectRequest(request.id)} disabled={submittingId === request.id} style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.bg }]}>
                    <X size={14} color={colors.textMuted} />
                    <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>{t('friends.reject')}</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={() => void cancelRequest(request.id)} disabled={submittingId === request.id} style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.bg }]}>
                  {submittingId === request.id ? <ActivityIndicator size="small" color={colors.textMuted} /> : <X size={14} color={colors.textMuted} />}
                  <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>{t('friends.cancelRequest')}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>{t('friends.title')}</Text>
        <Text style={[styles.screenSubtitle, { color: colors.textMuted }]}>{t('friends.subtitle')}</Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.searchBox, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('friends.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            returnKeyType="search"
            onSubmitEditing={() => void runSearch()}
          />
          <Pressable onPress={() => void runSearch()} disabled={searching || !query.trim()} style={[styles.searchBtn, { backgroundColor: colors.accent }]}>
            {searching ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.searchBtnText}>{t('friends.searchAction')}</Text>}
          </Pressable>
        </View>
        <Text style={[styles.helpText, { color: colors.textMuted }]}>{t('friends.searchHelp')}</Text>

        <View style={styles.actingRow}>
          {actingOptions.map((entity) => {
            const active = actingEntityId === entity.id
            return (
              <Pressable
                key={entity.id}
                onPress={() => setActingEntityId(entity.id)}
                style={[styles.actorChip, { backgroundColor: active ? colors.accentDim : colors.bgSecondary, borderColor: active ? `${colors.accent}55` : colors.border }]}
              >
                <Text style={[styles.actorChipText, { color: active ? colors.accent : colors.textSecondary }]}>
                  {entity.id === me.id ? t('friends.actAsSelf', { name: entityDisplayName(entity) }) : t('friends.actAsBot', { name: entityDisplayName(entity) })}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {renderDiscoverable()}

        <View style={styles.tabs}>
          {(['friends', 'requests'] as Tab[]).map((item) => {
            const active = tab === item
            return (
              <Pressable key={item} onPress={() => setTab(item)} style={[styles.tabBtn, { backgroundColor: active ? colors.accent : colors.bgSecondary }]}>
                <Text style={[styles.tabBtnText, { color: active ? '#fff' : colors.textSecondary }]}>
                  {item === 'friends' ? t('friends.friendsTab') : t('friends.requestsTab')}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {tab === 'friends' ? (
          <FlatList
            data={friends}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderFriendItem}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
            contentContainerStyle={friends.length === 0 ? styles.emptyContainer : styles.list}
            ListEmptyComponent={
              loading ? (
                <View style={styles.loadingWrap}><ActivityIndicator size="small" color={colors.textMuted} /></View>
              ) : (
                <EmptyState
                  icon={<Users size={28} color={colors.textMuted} />}
                  title={t('friends.noFriends')}
                />
              )
            }
          />
        ) : (
          <FlatList
            data={[{ id: 'incoming' }, { id: 'outgoing' }]}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
            renderItem={({ item }) => (
              <View style={styles.requestSection}>
                <Text style={[styles.requestTitle, { color: colors.text }]}>
                  {item.id === 'incoming' ? t('friends.incomingRequests') : t('friends.outgoingRequests')}
                </Text>
                {item.id === 'incoming'
                  ? (incoming.length === 0 ? <Text style={[styles.mutedText, { color: colors.textMuted }]}>{t('friends.noIncomingRequests')}</Text> : incoming.map((request) => renderRequest(request, 'incoming')))
                  : (outgoing.length === 0 ? <Text style={[styles.mutedText, { color: colors.textMuted }]}>{t('friends.noOutgoingRequests')}</Text> : outgoing.map((request) => renderRequest(request, 'outgoing')))
                }
              </View>
            )}
            contentContainerStyle={styles.list}
            ListEmptyComponent={loading ? <View style={styles.loadingWrap}><ActivityIndicator size="small" color={colors.textMuted} /></View> : null}
          />
        )}
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
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  screenSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    minHeight: 20,
  },
  searchBtn: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  actingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  actorChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actorChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    marginTop: 12,
    gap: 8,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 12,
  },
  tabBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 24,
    gap: 10,
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
  contentCard: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  flex: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
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
  pendingPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pendingPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  requestSection: {
    gap: 8,
    marginBottom: 16,
  },
  requestTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  mutedText: {
    fontSize: 12,
  },
  smallBtn: {
    borderRadius: 10,
    padding: 10,
  },
})
