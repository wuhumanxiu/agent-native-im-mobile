import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import {
  View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../theme/ThemeContext'
import { useAuthStore } from '../../store/auth'
import { useConversationsStore } from '../../store/conversations'
import { useMessagesStore } from '../../store/messages'
import { usePresenceStore } from '../../store/presence'
import { MessageBubble } from '../../components/chat/MessageBubble'
import { MessageComposer } from '../../components/chat/MessageComposer'
import { EntityAvatar } from '../../components/entity/EntityAvatar'
import { entityDisplayName, isBotOrService } from '../../lib/utils'
import * as api from '../../lib/api'
import type { Message, Conversation, Entity } from '../../lib/types'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

type ChatsStackParamList = {
  ConversationList: undefined
  Chat: { conversationId: number }
  ChatSettings: { conversationId: number }
}

type Props = NativeStackScreenProps<ChatsStackParamList, 'Chat'>

function getConversationTitle(conv: Conversation, myId: number): string {
  if (conv.title) return conv.title
  if (conv.conv_type === 'direct') {
    const other = conv.participants?.find((p) => p.entity_id !== myId)
    return entityDisplayName(other?.entity) || 'Chat'
  }
  return 'Group Chat'
}

function getOtherEntity(conv: Conversation, myId: number): Entity | undefined {
  if (conv.conv_type === 'direct') {
    return conv.participants?.find((p) => p.entity_id !== myId)?.entity
  }
  return undefined
}

export function ChatScreen({ route, navigation }: Props) {
  const { conversationId } = route.params
  const { colors } = useTheme()
  const { t } = useTranslation()
  const token = useAuthStore((s) => s.token)
  const entity = useAuthStore((s) => s.entity)
  const conversations = useConversationsStore((s) => s.conversations)
  const updateConversation = useConversationsStore((s) => s.updateConversation)
  const messages = useMessagesStore((s) => s.byConv[conversationId] || [])
  const hasMore = useMessagesStore((s) => s.hasMore[conversationId] ?? true)
  const streams = useMessagesStore((s) => s.streams)
  const progress = useMessagesStore((s) => s.progress[conversationId])
  const { setMessages, prependMessages, addOptimisticMessage, replaceOptimisticMessage, clearSentState } = useMessagesStore()
  const online = usePresenceStore((s) => s.online)

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const flatListRef = useRef<FlatList>(null)
  const tempIdCounter = useRef(0)

  const conv = conversations.find((c) => c.id === conversationId)
  const title = conv ? getConversationTitle(conv, entity?.id || 0) : 'Chat'
  const otherEntity = conv ? getOtherEntity(conv, entity?.id || 0) : undefined
  const isOtherOnline = otherEntity ? online.has(otherEntity.id) : false

  // Active streams for this conversation
  const activeStreams = useMemo(() => {
    return Object.values(streams).filter((s) => s.conversation_id === conversationId)
  }, [streams, conversationId])

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const res = await api.listMessages(token, conversationId)
    if (res.ok && res.data) {
      setMessages(conversationId, res.data.messages || [], res.data.has_more)
    }
    setLoading(false)
  }, [token, conversationId, setMessages])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // Mark as read
  useEffect(() => {
    if (!token || messages.length === 0) return
    const lastMsg = messages[messages.length - 1]
    if (lastMsg && lastMsg.sender_id !== entity?.id) {
      api.markAsRead(token, conversationId, lastMsg.id).catch(() => {})
      updateConversation(conversationId, { unread_count: 0 })
    }
  }, [token, messages, conversationId, entity?.id])

  // Load more (older messages)
  const handleLoadMore = useCallback(async () => {
    if (!token || !hasMore || loadingMore || messages.length === 0) return
    setLoadingMore(true)
    const oldest = messages[0]
    const res = await api.listMessages(token, conversationId, oldest.id)
    if (res.ok && res.data) {
      prependMessages(conversationId, res.data.messages || [], res.data.has_more)
    }
    setLoadingMore(false)
  }, [token, hasMore, loadingMore, messages, conversationId, prependMessages])

  // Send message
  const handleSend = useCallback(async (text: string) => {
    if (!token || !entity) return

    const tempId = `tmp_${Date.now()}_${tempIdCounter.current++}`
    const optimisticMsg: Message = {
      id: -(Date.now() + tempIdCounter.current),
      conversation_id: conversationId,
      sender_id: entity.id,
      sender: entity,
      content_type: 'text',
      layers: { summary: text.length > 100 ? text.slice(0, 100) + '...' : text, data: { body: text } },
      created_at: new Date().toISOString(),
    }

    addOptimisticMessage(tempId, optimisticMsg)

    const res = await api.sendMessage(token, {
      conversation_id: conversationId,
      content_type: 'text',
      layers: {
        summary: text.length > 100 ? text.slice(0, 100) + '...' : text,
        data: { body: text },
      },
    })

    if (res.ok && res.data) {
      replaceOptimisticMessage(tempId, res.data)
      setTimeout(() => clearSentState(tempId), 2000)
    }
  }, [token, entity, conversationId, addOptimisticMessage, replaceOptimisticMessage, clearSentState])

  // Handle attachment
  const handleAttach = useCallback(async (file: { uri: string; name: string; type: string }) => {
    if (!token || !entity) return
    const uploadRes = await api.uploadFile(token, file)
    if (uploadRes.ok && uploadRes.data?.url) {
      const isImage = file.type.startsWith('image/')
      await api.sendMessage(token, {
        conversation_id: conversationId,
        content_type: isImage ? 'image' : 'file',
        layers: { summary: file.name },
        attachments: [{
          type: isImage ? 'image' : 'file',
          url: uploadRes.data.url,
          filename: file.name,
          mime_type: file.type,
        }],
      })
    }
  }, [token, entity, conversationId])

  // Long press on message
  const handleMessageLongPress = useCallback((msg: Message) => {
    const options = ['Copy Text', 'Cancel'] as string[]
    const cancelIndex = 1

    Alert.alert('Message', undefined, [
      {
        text: 'Copy Text',
        onPress: () => {
          const text = (msg.layers?.data?.body as string) || msg.layers?.summary || ''
          Clipboard.setStringAsync(text)
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }, [])

  // Determine if we should show sender/avatar
  const shouldShowSender = useCallback((index: number, msg: Message) => {
    if (index === 0) return true
    const prev = messages[index - 1]
    if (!prev) return true
    return prev.sender_id !== msg.sender_id
  }, [messages])

  // Reversed list renders newest at bottom
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages])

  const renderItem = useCallback(({ item: msg, index }: { item: Message; index: number }) => {
    // In inverted list, index 0 = newest. We need to check the *next* item for grouping
    const realIndex = messages.length - 1 - index
    const isSelf = msg.sender_id === entity?.id
    const showSender = shouldShowSender(realIndex, msg)
    const showAvatar = showSender

    return (
      <MessageBubble
        message={msg}
        isSelf={isSelf}
        showSender={showSender}
        showAvatar={showAvatar}
        token={token}
        onLongPress={handleMessageLongPress}
      />
    )
  }, [messages, entity?.id, token, shouldShowSender, handleMessageLongPress])

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgPrimary }]} edges={['bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgSecondary, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
          <Text style={[styles.backArrow, { color: colors.accent }]}>{'<'}</Text>
        </Pressable>

        <Pressable
          style={styles.headerCenter}
          onPress={() => {
            if (conv) navigation.navigate('ChatSettings', { conversationId })
          }}
        >
          <EntityAvatar entity={otherEntity} size="sm" showOnline />
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {title}
            </Text>
            {conv?.conv_type === 'direct' && (
              <Text style={[styles.headerSubtitle, { color: isOtherOnline ? colors.success : colors.textMuted }]}>
                {isOtherOnline ? t('conversation.online') : t('conversation.offline')}
              </Text>
            )}
            {conv?.conv_type === 'group' && (
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                {t('conversation.participants', { count: conv.participants?.length || 0 })}
              </Text>
            )}
          </View>
        </Pressable>
      </View>

      {/* Messages */}
      {loading && messages.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={reversedMessages}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          inverted
          contentContainerStyle={styles.messageList}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator color={colors.accent} size="small" />
              </View>
            ) : null
          }
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
        />
      )}

      {/* Active stream indicator */}
      {activeStreams.length > 0 && (
        <View style={[styles.streamIndicator, { backgroundColor: colors.bgSecondary }]}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={[styles.streamText, { color: colors.textSecondary }]}>
            {t('chat.thinking')}
          </Text>
        </View>
      )}

      {/* Progress indicator */}
      {progress && (
        <View style={[styles.streamIndicator, { backgroundColor: colors.bgSecondary }]}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={[styles.streamText, { color: colors.textSecondary }]}>
            {progress.status.text || progress.status.phase || t('chat.processing')}
          </Text>
        </View>
      )}

      {/* Composer */}
      <MessageComposer
        onSend={handleSend}
        onAttach={handleAttach}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 24,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    paddingVertical: 8,
  },
  loadingMore: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  streamIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  streamText: {
    fontSize: 13,
  },
})
