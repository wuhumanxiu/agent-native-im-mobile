import React, { useCallback, useEffect, useState, useMemo } from 'react'
import {
  View, Text, TextInput, Pressable, FlatList, StyleSheet, RefreshControl, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
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
  const { conversations, setConversations, setActive } = useConversationsStore()
  const { setOnline } = usePresenceStore()
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

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

    return (
      <Pressable
        onPress={() => handleSelectConversation(conv)}
        style={({ pressed }) => [
          styles.convItem,
          {
            backgroundColor: pressed ? colors.bgTertiary : 'transparent',
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
            <Text style={[styles.convTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.convTime, { color: colors.textMuted }]}>{time}</Text>
          </View>
          <View style={styles.convBottomRow}>
            <Text style={[styles.convPreview, { color: colors.textSecondary }]} numberOfLines={1}>
              {preview || ' '}
            </Text>
            {unread > 0 && <Badge count={unread} />}
          </View>
        </View>
      </Pressable>
    )
  }, [entity?.id, colors, handleSelectConversation])

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgPrimary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('conversation.messages')}
        </Text>
        <Pressable
          onPress={() => {
            Alert.prompt(
              t('conversation.newChat'),
              t('conversation.newChatHint'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('common.create'),
                  onPress: async (title) => {
                    if (!title?.trim() || !token) return
                    const res = await api.createConversation(token, {
                      title: title.trim(),
                      conv_type: 'group',
                    })
                    if (res.ok && res.data) {
                      await loadConversations()
                      navigation.navigate('Chat', { conversationId: res.data.id })
                    }
                  },
                },
              ],
              'plain-text',
              '',
              'default',
            )
          }}
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
  convTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
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
})
