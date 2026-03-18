import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Users, Settings, Search } from 'lucide-react-native'
import { MessageBubble } from './MessageBubble'
import { StreamingBubble } from './StreamingBubble'
import { MessageComposer, type UploadedAttachment } from './MessageComposer'
import { SkeletonLoader } from '../ui/SkeletonLoader'
import { EntityAvatar } from '../ui/EntityAvatar'
import type { Conversation, Message, ActiveStream, Entity, Participant } from '../../lib/types'

// ─── Utility ─────────────────────────────────────────────────────

function entityDisplayName(entity?: Entity | null): string {
  if (!entity) return 'Unknown'
  return entity.display_name || entity.name
}

function isBotOrService(entity?: { entity_type?: string } | null): boolean {
  return entity?.entity_type === 'bot' || entity?.entity_type === 'service'
}

// ─── Props ───────────────────────────────────────────────────────

interface Props {
  conversation: Conversation
  messages: Message[]
  streams?: ActiveStream[]
  myEntityId: number
  myEntity: Entity
  loading?: boolean
  hasMore?: boolean
  isOnline?: boolean
  typingText?: string | null
  readReceipts?: Record<number, number>
  isArchived?: boolean
  onBack?: () => void
  onSettings?: () => void
  onLoadMore?: () => void
  onSend: (text: string, attachments?: UploadedAttachment[], mentions?: number[]) => void
  onAudioSend?: (blob: any, duration: number) => void
  onFileUpload?: (file: { uri: string; name: string; type: string; size: number }) => Promise<string | null>
  onTyping?: () => void
  onRevoke?: (msgId: number) => void
  onReply?: (msg: Message) => void
  onReact?: (msgId: number, emoji: string) => void
  onRetryOutbox?: (tempId: string) => void
  onCancelStream?: (streamId: string, conversationId: number) => void
  onMarkAsRead?: (conversationId: number, messageId: number) => void
}

// ─── Component ───────────────────────────────────────────────────

export function ChatThread({
  conversation,
  messages,
  streams,
  myEntityId,
  myEntity,
  loading = false,
  hasMore = true,
  isOnline = false,
  typingText,
  readReceipts,
  isArchived,
  onBack,
  onSettings,
  onLoadMore,
  onSend,
  onAudioSend,
  onFileUpload,
  onTyping,
  onRevoke,
  onReply: onReplyProp,
  onReact,
  onRetryOutbox,
  onCancelStream,
  onMarkAsRead,
}: Props) {
  const { t } = useTranslation()
  const flatListRef = useRef<FlatList>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)

  const isGroup = conversation?.conv_type === 'group' || conversation?.conv_type === 'channel'
  const otherParticipant = (conversation?.participants || []).find((p) => p.entity_id !== myEntityId)?.entity
  const myParticipant = (conversation?.participants || []).find((p) => p.entity_id === myEntityId)
  const isObserver = myParticipant?.role === 'observer'

  // Active streams for this conversation
  const convStreams = useMemo<ActiveStream[]>(
    () => (streams || []).filter((s) => s.conversation_id === conversation.id),
    [streams, conversation.id],
  )

  // Message map for reply lookups
  const messageMap = useMemo(() => {
    const map = new Map<number, Message>()
    messages.forEach((m) => map.set(m.id, m))
    return map
  }, [messages])

  // Check if a message has been read (for read receipt)
  const isMessageRead = useCallback((msgId: number): boolean => {
    if (!readReceipts) return false
    return Object.values(readReceipts).some((lastRead) => lastRead >= msgId)
  }, [readReceipts])

  // Mark as read on new messages
  useEffect(() => {
    if (messages.length === 0) return
    const lastMsg = messages[messages.length - 1]
    const timer = setTimeout(() => {
      onMarkAsRead?.(conversation.id, lastMsg.id)
    }, 300)
    return () => clearTimeout(timer)
  }, [messages, conversation.id, onMarkAsRead])

  // Reset reply on conversation switch
  useEffect(() => {
    setReplyTo(null)
  }, [conversation.id])

  // Handle reply
  const handleReply = useCallback((msg: Message) => {
    if (isArchived) return
    setReplyTo(msg)
    onReplyProp?.(msg)
  }, [isArchived, onReplyProp])

  // Handle send (wraps to clear reply)
  const handleSend = useCallback((text: string, attachments?: UploadedAttachment[], mentions?: number[]) => {
    onSend(text, attachments, mentions)
    setReplyTo(null)
  }, [onSend])

  // Load more messages
  const handleEndReached = useCallback(() => {
    if (!loading && hasMore && onLoadMore) {
      onLoadMore()
    }
  }, [loading, hasMore, onLoadMore])

  // Determine if we should show sender (group messages from different sender)
  const shouldShowSender = useCallback((index: number, msg: Message, allMessages: Message[]): boolean => {
    if (index === 0) return true
    // In inverted list, previous message is at index + 1 since data is reversed
    const prevMsg = allMessages[index - 1]
    if (!prevMsg) return true
    if (prevMsg.sender_id !== msg.sender_id) return true
    // Show sender if more than 5 minutes gap
    const gap = new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()
    return Math.abs(gap) > 5 * 60 * 1000
  }, [])

  // Inverted data (newest first for FlatList inverted)
  const invertedMessages = useMemo(() => [...messages].reverse(), [messages])

  // Render message item
  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isSelf = item.sender_id === myEntityId
    const showSender = isGroup ? shouldShowSender(index, item, invertedMessages) : (index === invertedMessages.length - 1 || invertedMessages[index + 1]?.sender_id !== item.sender_id)
    const replyMessage = item.reply_to ? messageMap.get(item.reply_to) : undefined

    return (
      <View style={itemStyles.container}>
        <MessageBubble
          message={item}
          isSelf={isSelf}
          myEntityId={myEntityId}
          replyMessage={replyMessage}
          showSender={showSender}
          isRead={isSelf ? isMessageRead(item.id) : undefined}
          onRevoke={isArchived ? undefined : onRevoke}
          onReply={isArchived ? undefined : handleReply}
          onReact={isArchived ? undefined : onReact}
          onRetryOutbox={isArchived ? undefined : onRetryOutbox}
        />
      </View>
    )
  }, [myEntityId, isGroup, shouldShowSender, invertedMessages, messageMap, isMessageRead, isArchived, onRevoke, handleReply, onReact, onRetryOutbox])

  // Render streaming bubbles at the top (bottom visually in inverted list)
  const renderHeader = useCallback(() => {
    if (convStreams.length === 0 && !typingText) return null
    return (
      <View style={itemStyles.headerContainer}>
        {/* Typing indicator */}
        {typingText && (
          <View style={itemStyles.typingRow}>
            <Text style={itemStyles.typingText}>{typingText}</Text>
          </View>
        )}
        {/* Streaming bubbles */}
        {convStreams.map((stream) => {
          const sender = conversation.participants?.find((p) => p.entity_id === stream.sender_id)?.entity
          return (
            <StreamingBubble
              key={stream.stream_id}
              stream={stream}
              sender={sender}
              onCancel={onCancelStream}
            />
          )
        })}
      </View>
    )
  }, [convStreams, typingText, conversation.participants, onCancelStream])

  // Render loading more indicator
  const renderFooter = useCallback(() => {
    if (!loading || messages.length === 0) return null
    return (
      <View style={itemStyles.loadingMore}>
        <ActivityIndicator size="small" color="#6366f1" />
      </View>
    )
  }, [loading, messages.length])

  const keyExtractor = useCallback((item: Message) => String(item.id) + (item.temp_id || ''), [])

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <Pressable
            style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
            onPress={onBack}
          >
            <ArrowLeft size={20} color="#64748b" />
          </Pressable>
        )}

        {/* Title area */}
        <Pressable style={styles.titleArea} onPress={onSettings}>
          {isGroup ? (
            <View style={styles.groupIconContainer}>
              <Users size={16} color="#6366f1" />
            </View>
          ) : (
            <EntityAvatar entity={otherParticipant} size="sm" showStatus isOnline={isOnline} />
          )}

          <View style={styles.titleContent}>
            <Text style={styles.titleText} numberOfLines={1}>
              {conversation.title || entityDisplayName(otherParticipant)}
            </Text>
            <Text style={styles.subtitleText}>
              {isGroup
                ? t('conversation.participants', { count: conversation.participants?.length || 0 })
                : isOnline
                  ? t('common.online')
                  : t('common.offline')
              }
            </Text>
          </View>
        </Pressable>

        {onSettings && (
          <Pressable
            style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
            onPress={onSettings}
          >
            <Settings size={20} color="#94a3b8" />
          </Pressable>
        )}
      </View>

      {/* Messages */}
      {loading && messages.length === 0 ? (
        <SkeletonLoader variant="chat-messages" />
      ) : (
        <FlatList
          ref={flatListRef}
          data={invertedMessages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          inverted
          contentContainerStyle={styles.messageList}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={Platform.OS !== 'web'}
          maxToRenderPerBatch={15}
          windowSize={11}
          initialNumToRender={20}
        />
      )}

      {/* Composer */}
      <MessageComposer
        conversationId={conversation.id}
        onSend={handleSend}
        onAudioSend={onAudioSend}
        onFileUpload={onFileUpload}
        onTyping={onTyping}
        placeholder={t('conversation.typeMessage')}
        participants={conversation.participants}
        isObserver={isObserver || isArchived}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </KeyboardAvoidingView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerButtonPressed: {
    backgroundColor: '#f1f5f9',
  },
  titleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  groupIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleContent: {
    flex: 1,
    minWidth: 0,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  subtitleText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  messageList: {
    paddingVertical: 8,
    gap: 4,
  },
})

const itemStyles = StyleSheet.create({
  container: {
    paddingVertical: 2,
  },
  headerContainer: {
    gap: 8,
    paddingBottom: 4,
  },
  typingRow: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  typingText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#94a3b8',
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: 'center',
  },
})
