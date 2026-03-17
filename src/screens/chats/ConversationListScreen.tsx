import React, { useCallback, useEffect, useState, useMemo } from 'react'
import {
  View, Text, TextInput, Pressable, FlatList, StyleSheet, RefreshControl, Alert,
  ActionSheetIOS, Platform, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../theme/ThemeContext'
import { useAuthStore } from '../../store/auth'
import { useConversationsStore } from '../../store/conversations'
import { usePresenceStore } from '../../store/presence'
import { EntityAvatar } from '../../components/entity/EntityAvatar'
import { Badge } from '../../components/ui/Badge'
import { entityDisplayName, formatTime, truncate } from '../../lib/utils'
import * as api from '../../lib/api'
import type { Conversation, Entity } from '../../lib/types'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

type ChatsStackParamList = {
  ConversationList: undefined
  Chat: { conversationId: number }
  ChatSettings: { conversationId: number }
}

type Props = NativeStackScreenProps<ChatsStackParamList, 'ConversationList'>

function getConversationDisplayEntity(conv: Conversation, myId: number): Entity | undefined {
  if (conv.conv_type === 'direct') {
    const other = conv.participants?.find((p) => p.entity_id !== myId)
    return other?.entity
  }
  return undefined
}

function getConversationTitle(conv: Conversation, myId: number): string {
  if (conv.title) return conv.title
  if (conv.conv_type === 'direct') {
    const other = conv.participants?.find((p) => p.entity_id !== myId)
    return entityDisplayName(other?.entity) || 'Chat'
  }
  return 'Group Chat'
}

function getLastMessagePreview(conv: Conversation): string {
  const msg = conv.last_message
  if (!msg) return ''
  if (msg.revoked_at) return 'Message revoked'
  const text = msg.layers?.summary || (msg.layers?.data?.body as string) || ''
  if (text) return truncate(text, 60)
  if (msg.attachments?.length) return `[${msg.attachments[0].type || 'Attachment'}]`
  return ''
}

export function ConversationListScreen({ navigation }: Props) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const token = useAuthStore((s) => s.token)
  const entity = useAuthStore((s) => s.entity)
  const { conversations, setConversations, setActive, removeConversation, updateConversation, mutedIds, toggleMute } = useConversationsStore()
  const { setOnline } = usePresenceStore()
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [newChatTitle, setNewChatTitle] = useState('')

  const loadConversations = useCallback(async () => {
    if (!token || !entity) return
    const res = await api.listConversations(token)
    if (res.ok && res.data) {
      const convs = Array.isArray(res.data) ? res.data : []
      setConversations(convs)

      // Load presence
      const entityIds = new Set<number>()
      for (const conv of convs) {
        for (const p of conv.participants || []) {
          if (p.entity_id !== entity.id) entityIds.add(p.entity_id)
        }
      }
      if (entityIds.size > 0) {
        const presRes = await api.batchPresence(token, Array.from(entityIds))
        if (presRes.ok && presRes.data?.presence) {
          for (const [idStr, isOnline] of Object.entries(presRes.data.presence)) {
            setOnline(Number(idStr), isOnline as boolean)
          }
        }
      }
    }
  }, [token, entity])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadConversations()
    setRefreshing(false)
  }, [loadConversations])

  // ── Conversation actions ──────────────────────────────────────────
  const handleArchive = useCallback(async (convId: number) => {
    if (!token) return
    const res = await api.archiveConversation(token, convId)
    if (res.ok) {
      removeConversation(convId)
    }
  }, [token, removeConversation])

  const handlePin = useCallback(async (convId: number) => {
    if (!token || !entity) return
    const res = await api.pinConversation(token, convId)
    if (res.ok) {
      const conv = conversations.find((c) => c.id === convId)
      if (conv) {
        updateConversation(convId, {
          participants: conv.participants?.map((p) =>
            p.entity_id === entity.id ? { ...p, pinned_at: new Date().toISOString() } : p
          ),
        })
      }
    }
  }, [token, entity, conversations, updateConversation])

  const handleUnpin = useCallback(async (convId: number) => {
    if (!token || !entity) return
    const res = await api.unpinConversation(token, convId)
    if (res.ok) {
      const conv = conversations.find((c) => c.id === convId)
      if (conv) {
        updateConversation(convId, {
          participants: conv.participants?.map((p) =>
            p.entity_id === entity.id ? { ...p, pinned_at: undefined } : p
          ),
        })
      }
    }
  }, [token, entity, conversations, updateConversation])

  const handleLeave = useCallback(async (convId: number) => {
    if (!token) return
    Alert.alert(t('conversation.leave'), t('conversation.leaveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('conversation.leave'),
        style: 'destructive',
        onPress: async () => {
          const res = await api.leaveConversation(token, convId)
          if (res.ok) {
            removeConversation(convId)
          }
        },
      },
    ])
  }, [token, t, removeConversation])

  const handleConversationLongPress = useCallback((conv: Conversation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const isPinned = conv.participants?.find((p) => p.entity_id === entity?.id)?.pinned_at
    const isMuted = mutedIds.has(conv.id)

    if (Platform.OS === 'ios') {
      const options = [
        isPinned ? t('conversation.unpin') : t('conversation.pin'),
        isMuted ? t('conversation.unmute') : t('conversation.mute'),
        t('conversation.archive'),
        t('conversation.leave'),
        t('common.cancel'),
      ]
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 4,
          destructiveButtonIndex: 3,
        },
        (idx) => {
          if (idx === 0) {
            if (isPinned) handleUnpin(conv.id)
            else handlePin(conv.id)
          } else if (idx === 1) {
            toggleMute(conv.id)
          } else if (idx === 2) {
            handleArchive(conv.id)
          } else if (idx === 3) {
            handleLeave(conv.id)
          }
        },
      )
    } else {
      Alert.alert('', undefined, [
        { text: isPinned ? t('conversation.unpin') : t('conversation.pin'), onPress: () => isPinned ? handleUnpin(conv.id) : handlePin(conv.id) },
        { text: isMuted ? t('conversation.unmute') : t('conversation.mute'), onPress: () => toggleMute(conv.id) },
        { text: t('conversation.archive'), onPress: () => handleArchive(conv.id) },
        { text: t('conversation.leave'), style: 'destructive', onPress: () => handleLeave(conv.id) },
        { text: t('common.cancel'), style: 'cancel' },
      ])
    }
  }, [entity?.id, mutedIds, t, handlePin, handleUnpin, handleArchive, handleLeave, toggleMute])

  const sortedConversations = useMemo(() => {
    let list = [...conversations]
    // Sort by pinned first, then by updated_at
    list.sort((a, b) => {
      const aPinned = a.participants?.find((p) => p.entity_id === entity?.id)?.pinned_at
      const bPinned = b.participants?.find((p) => p.entity_id === entity?.id)?.pinned_at
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c) => {
        const title = getConversationTitle(c, entity?.id || 0).toLowerCase()
        return title.includes(q)
      })
    }
    return list
  }, [conversations, search, entity?.id])

  const handleSelectConversation = useCallback((conv: Conversation) => {
    setActive(conv.id)
    navigation.navigate('Chat', { conversationId: conv.id })
  }, [navigation, setActive])

  const renderItem = useCallback(({ item: conv }: { item: Conversation }) => {
    const displayEntity = getConversationDisplayEntity(conv, entity?.id || 0)
    const title = getConversationTitle(conv, entity?.id || 0)
    const preview = getLastMessagePreview(conv)
    const time = conv.last_message ? formatTime(conv.last_message.created_at) : formatTime(conv.updated_at)
    const unread = conv.unread_count || 0
    const isPinned = !!conv.participants?.find((p) => p.entity_id === entity?.id)?.pinned_at
    const isMuted = mutedIds.has(conv.id)

    return (
      <Pressable
        onPress={() => handleSelectConversation(conv)}
        onLongPress={() => handleConversationLongPress(conv)}
        style={({ pressed }) => [
          styles.convItem,
          {
            backgroundColor: pressed ? colors.bgTertiary : isPinned ? colors.bgSecondary : 'transparent',
          },
        ]}
      >
        <EntityAvatar
          entity={displayEntity || { id: conv.id, name: title, display_name: title, entity_type: 'user', status: 'active', metadata: {}, created_at: '', updated_at: '' } as Entity}
          size="md"
          showOnline={conv.conv_type === 'direct'}
        />
        <View style={styles.convContent}>
          <View style={styles.convTopRow}>
            <View style={styles.titleRow}>
              {isPinned && (
                <Text style={[styles.pinIcon, { color: colors.textMuted }]}>{'\u{1F4CC}'}</Text>
              )}
              <Text style={[styles.convTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {title}
              </Text>
            </View>
            <Text style={[styles.convTime, { color: colors.textMuted }]}>{time}</Text>
          </View>
          <View style={styles.convBottomRow}>
            <Text style={[styles.convPreview, { color: isMuted ? colors.textMuted : colors.textSecondary }]} numberOfLines={1}>
              {preview || ' '}
            </Text>
            {isMuted && <Text style={[styles.muteIcon, { color: colors.textMuted }]}>{'\u{1F515}'}</Text>}
            {unread > 0 && !isMuted && <Badge count={unread} />}
          </View>
        </View>
      </Pressable>
    )
  }, [entity?.id, colors, mutedIds, handleSelectConversation, handleConversationLongPress])

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgPrimary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('conversation.messages')}
        </Text>
        <Pressable
          onPress={() => setShowNewChat(true)}
          style={({ pressed }) => [
            styles.newChatBtn,
            { backgroundColor: colors.accent, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={styles.newChatBtnText}>+</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.bgSecondary }]}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('conversation.search')}
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.textPrimary, backgroundColor: colors.bgTertiary }]}
        />
      </View>

      {/* List */}
      <FlatList
        data={sortedConversations}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {search ? t('conversation.noMatches') : t('conversation.noConversations')}
            </Text>
          </View>
        }
        contentContainerStyle={sortedConversations.length === 0 ? styles.emptyList : undefined}
      />
      {/* New Chat Modal */}
      <Modal visible={showNewChat} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowNewChat(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.bgSecondary }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('conversation.newChat')}</Text>
            <TextInput
              value={newChatTitle}
              onChangeText={setNewChatTitle}
              placeholder={t('conversation.newChatHint')}
              placeholderTextColor={colors.textMuted}
              style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgTertiary }]}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable onPress={() => { setShowNewChat(false); setNewChatTitle('') }} style={[styles.modalBtn, { backgroundColor: colors.bgTertiary }]}>
                <Text style={{ color: colors.textSecondary }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (!newChatTitle.trim() || !token) return
                  const res = await api.createConversation(token, { title: newChatTitle.trim(), conv_type: 'group' })
                  if (res.ok && res.data) {
                    setShowNewChat(false)
                    setNewChatTitle('')
                    await loadConversations()
                    navigation.navigate('Chat', { conversationId: res.data.id })
                  }
                }}
                style={[styles.modalBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>{t('common.create')}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  newChatBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatBtnText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 24,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: {
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  convContent: {
    flex: 1,
    gap: 4,
  },
  convTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    gap: 4,
  },
  pinIcon: {
    fontSize: 10,
  },
  convTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  convTime: {
    fontSize: 12,
  },
  convBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convPreview: {
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  muteIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
  },
  emptyList: {
    flexGrow: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
})
