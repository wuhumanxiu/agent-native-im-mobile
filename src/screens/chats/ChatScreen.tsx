import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import {
  View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator, Alert, ActionSheetIOS, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../theme/ThemeContext'
import { useAuthStore } from '../../store/auth'
import { useConversationsStore } from '../../store/conversations'
import { useMessagesStore } from '../../store/messages'
import { usePresenceStore } from '../../store/presence'
import { useWSContext } from '../../navigation/RootNavigator'
import { MessageBubble } from '../../components/chat/MessageBubble'
import { MessageComposer } from '../../components/chat/MessageComposer'
import { StreamingBubble } from '../../components/chat/StreamingBubble'
import { TypingIndicator } from '../../components/chat/TypingIndicator'
import { DateSeparator } from '../../components/chat/DateSeparator'
import { ReplyPreview } from '../../components/chat/ReplyPreview'
import { EntityAvatar } from '../../components/entity/EntityAvatar'
import { entityDisplayName, isBotOrService, formatDateSeparator, canRevokeMessage } from '../../lib/utils'
import * as api from '../../lib/api'
import type { Message, Conversation, Entity, ActiveStream } from '../../lib/types'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

const QUICK_EMOJIS = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83C\uDF89', '\uD83E\uDD14', '\uD83D\uDC40']

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

type ListItem =
  | { type: 'message'; message: Message; showSender: boolean; showAvatar: boolean }
  | { type: 'date-sep'; label: string; key: string }
  | { type: 'stream'; stream: ActiveStream; sender?: Entity }

export function ChatScreen({ route, navigation }: Props) {
  const { conversationId } = route.params
  const { colors } = useTheme()
  const { t } = useTranslation()
  const token = useAuthStore((s) => s.token)
  const entity = useAuthStore((s) => s.entity)
  const conversations = useConversationsStore((s) => s.conversations)
  const updateConversation = useConversationsStore((s) => s.updateConversation)
  const setActive = useConversationsStore((s) => s.setActive)
  const EMPTY_MSGS: import('../../lib/types').Message[] = useMemo(() => [], [])
  const messages = useMessagesStore(useCallback((s: any) => s.byConv[conversationId] || EMPTY_MSGS, [conversationId, EMPTY_MSGS]))
  const hasMore = useMessagesStore(useCallback((s: any) => s.hasMore[conversationId] ?? true, [conversationId]))
  const streams = useMessagesStore((s) => s.streams)
  const progress = useMessagesStore(useCallback((s: any) => s.progress[conversationId], [conversationId]))
  const { setMessages, prependMessages, addOptimisticMessage, replaceOptimisticMessage, clearSentState } = useMessagesStore()
  const online = usePresenceStore((s) => s.online)
  const { sendTyping, sendCancelStream, typingMap } = useWSContext()

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const flatListRef = useRef<FlatList>(null)
  const tempIdCounter = useRef(0)

  const conv = conversations.find((c) => c.id === conversationId)
  const title = conv ? getConversationTitle(conv, entity?.id || 0) : 'Chat'
  const otherEntity = conv ? getOtherEntity(conv, entity?.id || 0) : undefined
  const isOtherOnline = otherEntity ? online.has(otherEntity.id) : false

  // Set active conversation for unread tracking
  useEffect(() => {
    setActive(conversationId)
    return () => setActive(null)
  }, [conversationId, setActive])

  // Active streams for this conversation
  const activeStreams = useMemo(() => {
    return Object.values(streams).filter((s) => s.conversation_id === conversationId)
  }, [streams, conversationId])

  // Typing entries for this conversation
  const convTyping = typingMap.get(conversationId)

  // Resolve sender entity for streams
  const findEntity = useCallback((senderId: number): Entity | undefined => {
    return conv?.participants?.find(p => p.entity_id === senderId)?.entity
  }, [conv?.participants])

  // Build message map for reply previews
  const messageMap = useMemo(() => {
    const map = new Map<number, Message>()
    for (const msg of messages) map.set(msg.id, msg)
    return map
  }, [messages])

  // Build list items with date separators
  const listItems = useMemo((): ListItem[] => {
    const items: ListItem[] = []

    // Add streams at the "bottom" (which is index 0 in inverted list)
    for (const stream of activeStreams) {
      items.push({ type: 'stream', stream, sender: findEntity(stream.sender_id) })
    }

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      const prev = i > 0 ? messages[i - 1] : null

      // Determine if sender name/avatar should be shown
      let showSender = true
      if (prev && prev.sender_id === msg.sender_id) {
        const gap = new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()
        if (gap < 300000) showSender = false
      }

      items.push({
        type: 'message',
        message: msg,
        showSender,
        showAvatar: showSender,
      })

      // Add date separator between this message and the previous one
      if (prev) {
        const msgDate = new Date(msg.created_at).toDateString()
        const prevDate = new Date(prev.created_at).toDateString()
        if (msgDate !== prevDate) {
          items.push({
            type: 'date-sep',
            label: formatDateSeparator(msg.created_at, t('app.today'), t('app.yesterday')),
            key: `sep-${msgDate}`,
          })
        }
      }
    }

    // Date separator for the oldest message
    if (messages.length > 0) {
      const oldest = messages[0]
      items.push({
        type: 'date-sep',
        label: formatDateSeparator(oldest.created_at, t('app.today'), t('app.yesterday')),
        key: `sep-${new Date(oldest.created_at).toDateString()}`,
      })
    }

    return items
  }, [messages, activeStreams, findEntity, t])

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
      reply_to: replyTo?.id,
      created_at: new Date().toISOString(),
    }

    addOptimisticMessage(tempId, optimisticMsg)
    const currentReplyTo = replyTo
    setReplyTo(null)

    const res = await api.sendMessage(token, {
      conversation_id: conversationId,
      content_type: 'text',
      layers: {
        summary: text.length > 100 ? text.slice(0, 100) + '...' : text,
        data: { body: text },
      },
      reply_to: currentReplyTo?.id,
    })

    if (res.ok && res.data) {
      replaceOptimisticMessage(tempId, res.data)
      setTimeout(() => clearSentState(tempId), 2000)
    }
  }, [token, entity, conversationId, replyTo, addOptimisticMessage, replaceOptimisticMessage, clearSentState])

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

  // Handle typing
  const handleTyping = useCallback(() => {
    sendTyping(conversationId)
  }, [sendTyping, conversationId])

  // Handle reaction
  const handleReact = useCallback(async (msgId: number, emoji: string) => {
    if (!token) return
    const res = await api.toggleReaction(token, msgId, emoji)
    if (res.ok && res.data?.reactions) {
      useMessagesStore.getState().updateMessageReactions(conversationId, msgId, res.data.reactions)
    }
  }, [token, conversationId])

  // Handle revoke
  const handleRevoke = useCallback(async (msgId: number) => {
    if (!token) return
    const res = await api.revokeMessage(token, msgId)
    if (res.ok) {
      useMessagesStore.getState().revokeMessage(conversationId, msgId)
    }
  }, [token, conversationId])

  // Long press on message — action sheet with copy, reply, react, revoke
  const handleMessageLongPress = useCallback((msg: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const text = (msg.layers?.data?.body as string) || msg.layers?.summary || ''
    const isSelf = msg.sender_id === entity?.id
    const canRevoke = isSelf && canRevokeMessage(msg.created_at) && !msg.revoked_at

    if (Platform.OS === 'ios') {
      const options = [
        t('message.copyText'),
        t('message.reply'),
        t('message.react'),
        ...(canRevoke ? [t('message.revoke')] : []),
        t('common.cancel'),
      ]
      const cancelButtonIndex = options.length - 1
      const destructiveButtonIndex = canRevoke ? options.length - 2 : undefined

      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex, destructiveButtonIndex },
        (idx) => {
          if (idx === 0) {
            Clipboard.setStringAsync(text)
          } else if (idx === 1) {
            setReplyTo(msg)
          } else if (idx === 2) {
            showEmojiPicker(msg)
          } else if (canRevoke && idx === 3) {
            Alert.alert(t('message.revoke'), t('message.revokeConfirm'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('message.revoke'), style: 'destructive', onPress: () => handleRevoke(msg.id) },
            ])
          }
        },
      )
    } else {
      Alert.alert('', undefined, [
        { text: t('message.copyText'), onPress: () => Clipboard.setStringAsync(text) },
        { text: t('message.reply'), onPress: () => setReplyTo(msg) },
        { text: t('message.react'), onPress: () => showEmojiPicker(msg) },
        ...(canRevoke ? [{
          text: t('message.revoke'),
          style: 'destructive' as const,
          onPress: () => {
            Alert.alert(t('message.revoke'), t('message.revokeConfirm'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('message.revoke'), style: 'destructive', onPress: () => handleRevoke(msg.id) },
            ])
          },
        }] : []),
        { text: t('common.cancel'), style: 'cancel' },
      ])
    }
  }, [entity?.id, t, handleRevoke])

  const showEmojiPicker = useCallback((msg: Message) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...QUICK_EMOJIS, t('common.cancel')],
          cancelButtonIndex: QUICK_EMOJIS.length,
        },
        (idx) => {
          if (idx < QUICK_EMOJIS.length) {
            handleReact(msg.id, QUICK_EMOJIS[idx])
          }
        },
      )
    } else {
      Alert.alert(t('message.react'), undefined,
        QUICK_EMOJIS.map((emoji) => ({
          text: emoji,
          onPress: () => handleReact(msg.id, emoji),
        })).concat({ text: t('common.cancel'), onPress: () => {}, style: 'cancel' } as never),
      )
    }
  }, [handleReact, t])

  // Handle tapping on existing reaction
  const handleReactionTap = useCallback((msgId: number, emoji: string) => {
    handleReact(msgId, emoji)
  }, [handleReact])

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'date-sep') {
      return <DateSeparator label={item.label} />
    }

    if (item.type === 'stream') {
      return (
        <StreamingBubble
          stream={item.stream}
          sender={item.sender}
          onCancel={sendCancelStream}
        />
      )
    }

    const { message: msg, showSender, showAvatar } = item
    const isSelf = msg.sender_id === entity?.id

    // Resolve reply-to message
    const replyMessage = msg.reply_to ? messageMap.get(msg.reply_to) : undefined

    return (
      <MessageBubble
        message={msg}
        isSelf={isSelf}
        showSender={showSender}
        showAvatar={showAvatar}
        token={token}
        replyMessage={replyMessage}
        myEntityId={entity?.id || 0}
        onLongPress={handleMessageLongPress}
        onReactionTap={handleReactionTap}
      />
    )
  }, [entity?.id, token, messageMap, handleMessageLongPress, handleReactionTap, sendCancelStream])

  const getItemKey = useCallback((item: ListItem) => {
    if (item.type === 'date-sep') return item.key
    if (item.type === 'stream') return `stream-${item.stream.stream_id}`
    return String(item.message.id)
  }, [])

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
          data={listItems}
          keyExtractor={getItemKey}
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

      {/* Progress indicator (when no streams active) */}
      {progress && activeStreams.length === 0 && (
        <View style={[styles.streamIndicator, { backgroundColor: colors.bgSecondary }]}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={[styles.streamText, { color: colors.textSecondary }]}>
            {progress.status.text || progress.status.phase || t('chat.processing')}
          </Text>
        </View>
      )}

      {/* Typing indicator */}
      <TypingIndicator typingEntities={convTyping} />

      {/* Reply preview */}
      {replyTo && <ReplyPreview message={replyTo} onClear={() => setReplyTo(null)} />}

      {/* Composer */}
      <MessageComposer
        onSend={handleSend}
        onAttach={handleAttach}
        onTyping={handleTyping}
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
